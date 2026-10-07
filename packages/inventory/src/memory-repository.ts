import { Inventory, InventoryItem, InventoryItemStatus, AdjustStockInput } from './types.js';
import { InventoryRepository } from './inventory-repository.js';
import { InventoryItemRepository } from './inventory-item-repository.js';
import {
  InventoryNotFoundError,
  InsufficientStockError,
  InvalidReservationError,
} from './errors.js';
import {
  validateQuantity,
  validatePositiveAmount,
  validateInventoryInvariants,
} from './validation.js';

/**
 * High-fidelity in-memory Inventory Repository with concurrency-safe mutex locking.
 * Enforces tenant boundary isolation and PostgreSQL table-level constraints.
 */
export class InMemoryInventoryRepository implements InventoryRepository {
  private readonly records = new Map<string, Inventory>();
  private readonly productIndex = new Map<string, string>(); // storeId:productId -> id
  private readonly locks = new Map<string, Promise<void>>();

  /**
   * Acquires a serialized mutex lock on a storeId:productId key.
   * Simulates PostgreSQL row-level locks (SELECT ... FOR UPDATE).
   */
  private async acquireLock(key: string): Promise<() => void> {
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }

    let release!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      release = () => {
        this.locks.delete(key);
        resolve();
      };
    });

    this.locks.set(key, lockPromise);
    return release;
  }

  async create(storeId: string, inventory: Inventory): Promise<Inventory> {
    if (inventory.storeId !== storeId) {
      throw new Error(
        `Inventory storeId ${inventory.storeId} does not match repository storeId ${storeId}`,
      );
    }

    const key = `${storeId}:${inventory.productId}`;
    if (this.productIndex.has(key)) {
      throw new Error(
        `Inventory already exists for product ${inventory.productId} in store ${storeId}`,
      );
    }

    validateInventoryInvariants(inventory.quantityOnHand, inventory.quantityReserved);

    const record = Object.freeze({ ...inventory });
    this.records.set(inventory.id, record);
    this.productIndex.set(key, inventory.id);
    return record;
  }

  async findById(storeId: string, id: string): Promise<Inventory | null> {
    const record = this.records.get(id);
    if (!record || record.storeId !== storeId) {
      return null;
    }
    return record;
  }

  async findByProductId(storeId: string, productId: string): Promise<Inventory | null> {
    const key = `${storeId}:${productId}`;
    const id = this.productIndex.get(key);
    if (!id) return null;
    return this.findById(storeId, id);
  }

  async list(storeId: string): Promise<readonly Inventory[]> {
    const results: Inventory[] = [];
    for (const record of this.records.values()) {
      if (record.storeId === storeId) {
        results.push(record);
      }
    }
    return results;
  }

  async update(
    storeId: string,
    id: string,
    data: Partial<Omit<Inventory, 'id' | 'storeId' | 'productId'>>,
  ): Promise<Inventory> {
    const existing = await this.findById(storeId, id);
    if (!existing) {
      throw new InventoryNotFoundError(id);
    }

    const onHand =
      data.quantityOnHand !== undefined ? data.quantityOnHand : existing.quantityOnHand;
    const reserved =
      data.quantityReserved !== undefined ? data.quantityReserved : existing.quantityReserved;

    validateInventoryInvariants(onHand, reserved);

    const updated: Inventory = Object.freeze({
      ...existing,
      ...data,
      id: existing.id,
      storeId: existing.storeId,
      productId: existing.productId,
      quantityOnHand: onHand,
      quantityReserved: reserved,
      updatedAt: new Date().toISOString(),
    });

    this.records.set(id, updated);
    return updated;
  }

  async atomicAdjustStock(
    storeId: string,
    productId: string,
    operation: AdjustStockInput,
  ): Promise<Inventory> {
    const key = `${storeId}:${productId}`;
    const releaseLock = await this.acquireLock(key);

    try {
      const existing = await this.findByProductId(storeId, productId);
      if (!existing) {
        throw new InventoryNotFoundError(productId);
      }

      validateQuantity(operation.quantity, 'adjustment quantity');

      let newOnHand: number;
      switch (operation.type) {
        case 'INCREASE':
          newOnHand = existing.quantityOnHand + operation.quantity;
          break;
        case 'DECREASE':
          newOnHand = existing.quantityOnHand - operation.quantity;
          break;
        case 'SET':
          newOnHand = operation.quantity;
          break;
        default:
          throw new Error(
            `Unsupported stock adjustment type: ${(operation as { type: string }).type}`,
          );
      }

      validateInventoryInvariants(newOnHand, existing.quantityReserved);

      const updated: Inventory = Object.freeze({
        ...existing,
        quantityOnHand: newOnHand,
        updatedAt: new Date().toISOString(),
      });

      this.records.set(existing.id, updated);
      return updated;
    } finally {
      releaseLock();
    }
  }

  async atomicReserve(storeId: string, productId: string, amount: number): Promise<Inventory> {
    const key = `${storeId}:${productId}`;
    const releaseLock = await this.acquireLock(key);

    try {
      const existing = await this.findByProductId(storeId, productId);
      if (!existing) {
        throw new InventoryNotFoundError(productId);
      }

      const validatedAmount = validatePositiveAmount(amount, 'reservation amount');
      const available = existing.quantityOnHand - existing.quantityReserved;

      if (available < validatedAmount) {
        throw new InsufficientStockError(validatedAmount, available, productId);
      }

      const newReserved = existing.quantityReserved + validatedAmount;
      validateInventoryInvariants(existing.quantityOnHand, newReserved);

      const updated: Inventory = Object.freeze({
        ...existing,
        quantityReserved: newReserved,
        updatedAt: new Date().toISOString(),
      });

      this.records.set(existing.id, updated);
      return updated;
    } finally {
      releaseLock();
    }
  }

  async atomicRelease(storeId: string, productId: string, amount: number): Promise<Inventory> {
    const key = `${storeId}:${productId}`;
    const releaseLock = await this.acquireLock(key);

    try {
      const existing = await this.findByProductId(storeId, productId);
      if (!existing) {
        throw new InventoryNotFoundError(productId);
      }

      const validatedAmount = validatePositiveAmount(amount, 'release amount');

      if (validatedAmount > existing.quantityReserved) {
        throw new InvalidReservationError(
          `Cannot release ${validatedAmount} units; only ${existing.quantityReserved} units currently reserved`,
          { requested: validatedAmount, reserved: existing.quantityReserved },
        );
      }

      const newReserved = existing.quantityReserved - validatedAmount;
      validateInventoryInvariants(existing.quantityOnHand, newReserved);

      const updated: Inventory = Object.freeze({
        ...existing,
        quantityReserved: newReserved,
        updatedAt: new Date().toISOString(),
      });

      this.records.set(existing.id, updated);
      return updated;
    } finally {
      releaseLock();
    }
  }

  async atomicConsume(
    storeId: string,
    productId: string,
    amount: number,
    fromReserved: boolean,
  ): Promise<Inventory> {
    const key = `${storeId}:${productId}`;
    const releaseLock = await this.acquireLock(key);

    try {
      const existing = await this.findByProductId(storeId, productId);
      if (!existing) {
        throw new InventoryNotFoundError(productId);
      }

      const validatedAmount = validatePositiveAmount(amount, 'consumption amount');

      let newOnHand: number;
      let newReserved: number;

      if (fromReserved) {
        if (validatedAmount > existing.quantityReserved) {
          throw new InsufficientStockError(validatedAmount, existing.quantityReserved, productId);
        }
        newReserved = existing.quantityReserved - validatedAmount;
        newOnHand = existing.quantityOnHand - validatedAmount;
      } else {
        const available = existing.quantityOnHand - existing.quantityReserved;
        if (available < validatedAmount) {
          throw new InsufficientStockError(validatedAmount, available, productId);
        }
        newReserved = existing.quantityReserved;
        newOnHand = existing.quantityOnHand - validatedAmount;
      }

      validateInventoryInvariants(newOnHand, newReserved);

      const updated: Inventory = Object.freeze({
        ...existing,
        quantityOnHand: newOnHand,
        quantityReserved: newReserved,
        updatedAt: new Date().toISOString(),
      });

      this.records.set(existing.id, updated);
      return updated;
    } finally {
      releaseLock();
    }
  }

  clear(): void {
    this.records.clear();
    this.productIndex.clear();
    this.locks.clear();
  }
}

/**
 * In-memory repository for individual single-use inventory items (e.g. digital credentials/keys).
 * Enforces tenant boundary isolation and lifecycle status transitions.
 */
export class InMemoryInventoryItemRepository implements InventoryItemRepository {
  private readonly items = new Map<string, InventoryItem>();

  async create(storeId: string, item: InventoryItem): Promise<InventoryItem> {
    if (item.storeId !== storeId) {
      throw new Error(
        `InventoryItem storeId ${item.storeId} does not match repository storeId ${storeId}`,
      );
    }

    if (this.items.has(item.id)) {
      throw new Error(`Inventory item with id ${item.id} already exists`);
    }

    const record = Object.freeze({ ...item });
    this.items.set(item.id, record);
    return record;
  }

  async findById(storeId: string, id: string): Promise<InventoryItem | null> {
    const item = this.items.get(id);
    if (!item || item.storeId !== storeId) {
      return null;
    }
    return item;
  }

  async listByProductId(
    storeId: string,
    productId: string,
    status?: InventoryItemStatus,
  ): Promise<readonly InventoryItem[]> {
    const results: InventoryItem[] = [];
    for (const item of this.items.values()) {
      if (item.storeId === storeId && item.productId === productId) {
        if (!status || item.status === status) {
          results.push(item);
        }
      }
    }
    return results;
  }

  async updateStatus(
    storeId: string,
    id: string,
    status: InventoryItemStatus,
    patch?: {
      readonly reservedOrderId?: string | null | undefined;
      readonly assignedOrderId?: string | null | undefined;
      readonly reservedAt?: string | null | undefined;
      readonly reservedUntil?: string | null | undefined;
      readonly assignedAt?: string | null | undefined;
    },
  ): Promise<InventoryItem> {
    const existing = await this.findById(storeId, id);
    if (!existing) {
      throw new InventoryNotFoundError(`Item ${id}`);
    }

    const updated: InventoryItem = Object.freeze({
      ...existing,
      status,
      reservedOrderId:
        patch?.reservedOrderId !== undefined ? patch.reservedOrderId : existing.reservedOrderId,
      assignedOrderId:
        patch?.assignedOrderId !== undefined ? patch.assignedOrderId : existing.assignedOrderId,
      reservedAt: patch?.reservedAt !== undefined ? patch.reservedAt : existing.reservedAt,
      reservedUntil:
        patch?.reservedUntil !== undefined ? patch.reservedUntil : existing.reservedUntil,
      assignedAt: patch?.assignedAt !== undefined ? patch.assignedAt : existing.assignedAt,
      updatedAt: new Date().toISOString(),
    });

    this.items.set(id, updated);
    return updated;
  }

  async countByStatus(
    storeId: string,
    productId: string,
    status: InventoryItemStatus,
  ): Promise<number> {
    let count = 0;
    for (const item of this.items.values()) {
      if (item.storeId === storeId && item.productId === productId && item.status === status) {
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.items.clear();
  }
}

import {
  Inventory,
  InventoryRepository,
  AdjustStockInput,
  InsufficientStockError,
  NegativeStockError,
  InvalidQuantityError,
  InvalidReservationError,
} from '@bintang/inventory';
import { PostgrestClient } from '../client.js';
import { DbInventory } from '../types.js';
import { isMissingRpcError } from '../errors.js';

function toDomain(row: DbInventory | readonly DbInventory[]): Inventory {
  const r = Array.isArray(row) ? row[0] : row;
  if (!r) throw new Error('Inventory row is empty');
  return {
    id: r.id,
    storeId: r.store_id,
    productId: r.product_id,
    quantityOnHand: r.quantity_on_hand,
    quantityReserved: r.quantity_reserved,
    updatedAt: r.updated_at,
  };
}

export class SupabaseInventoryRepository implements InventoryRepository {
  private readonly client: PostgrestClient;

  constructor(client: PostgrestClient) {
    this.client = client;
  }

  async create(storeId: string, inventory: Inventory): Promise<Inventory> {
    const payload: Partial<DbInventory> = {
      id: inventory.id,
      store_id: storeId,
      product_id: inventory.productId,
      quantity_on_hand: inventory.quantityOnHand,
      quantity_reserved: inventory.quantityReserved,
    };

    const inserted = await this.client.from<DbInventory>('inventory').insert(payload);
    const row = inserted[0];
    if (!row) {
      throw new Error('Failed to insert inventory: empty response');
    }
    return toDomain(row);
  }

  async findById(storeId: string, id: string): Promise<Inventory | null> {
    const row = await this.client
      .from<DbInventory>('inventory')
      .select('*')
      .eq('store_id', storeId)
      .eq('id', id)
      .maybeSingle();
    return row ? toDomain(row) : null;
  }

  async findByProductId(storeId: string, productId: string): Promise<Inventory | null> {
    const row = await this.client
      .from<DbInventory>('inventory')
      .select('*')
      .eq('store_id', storeId)
      .eq('product_id', productId)
      .maybeSingle();
    return row ? toDomain(row) : null;
  }

  async list(storeId: string): Promise<readonly Inventory[]> {
    const rows = await this.client
      .from<DbInventory>('inventory')
      .select('*')
      .eq('store_id', storeId)
      .execute();
    return Object.freeze(rows.map(toDomain));
  }

  async update(
    storeId: string,
    id: string,
    data: Partial<Omit<Inventory, 'id' | 'storeId' | 'productId'>>,
  ): Promise<Inventory> {
    const updatePayload: Partial<DbInventory> = {
      updated_at: new Date().toISOString(),
    };
    if (data.quantityOnHand !== undefined) updatePayload.quantity_on_hand = data.quantityOnHand;
    if (data.quantityReserved !== undefined)
      updatePayload.quantity_reserved = data.quantityReserved;

    const rows = await this.client
      .from<DbInventory>('inventory')
      .eq('store_id', storeId)
      .eq('id', id)
      .update(updatePayload);

    const row = rows[0];
    if (!row) {
      throw new Error(`Inventory not found for update: ${id}`);
    }
    return toDomain(row);
  }

  async atomicAdjustStock(
    storeId: string,
    productId: string,
    operation: AdjustStockInput,
  ): Promise<Inventory> {
    try {
      const row = await this.client.rpc<DbInventory>('rpc_atomic_adjust_stock', {
        p_store_id: storeId,
        p_product_id: productId,
        p_adjustment_type: operation.type,
        p_quantity: operation.quantity,
      });
      return toDomain(row);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('negative') || msg.includes('22003')) {
        throw new NegativeStockError(msg);
      }
      if (msg.includes('below currently reserved') || msg.includes('P0001')) {
        throw new InvalidQuantityError(msg);
      }
      if (!isMissingRpcError(err)) {
        throw err;
      }
      // Mock / fallback path
      const current = await this.findByProductId(storeId, productId);
      if (!current) {
        throw new Error(`Inventory record not found for product: ${productId}`);
      }

      let newOnHand: number;
      switch (operation.type) {
        case 'SET':
          newOnHand = operation.quantity;
          break;
        case 'INCREASE':
          newOnHand = current.quantityOnHand + operation.quantity;
          break;
        case 'DECREASE':
          newOnHand = current.quantityOnHand - operation.quantity;
          break;
        default:
          throw new Error(`Unknown adjustment type: ${String(operation.type)}`);
      }

      if (newOnHand < 0) {
        throw new NegativeStockError(
          `Quantity on hand cannot become negative (current: ${current.quantityOnHand}, change: ${operation.quantity})`,
        );
      }

      if (newOnHand < current.quantityReserved) {
        throw new InvalidQuantityError(
          `Cannot reduce stock below currently reserved quantity (${current.quantityReserved})`,
        );
      }

      return this.update(storeId, current.id, { quantityOnHand: newOnHand });
    }
  }

  async atomicReserve(storeId: string, productId: string, amount: number): Promise<Inventory> {
    if (amount <= 0) {
      throw new InvalidQuantityError('Reservation amount must be positive');
    }

    try {
      const row = await this.client.rpc<DbInventory>('rpc_atomic_reserve_stock', {
        p_store_id: storeId,
        p_product_id: productId,
        p_amount: amount,
      });
      return toDomain(row);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Insufficient stock') || msg.includes('P0001')) {
        throw new InsufficientStockError(amount, 0, productId);
      }
      if (!isMissingRpcError(err)) {
        throw err;
      }
      // Mock / fallback path
      const current = await this.findByProductId(storeId, productId);
      if (!current) {
        throw new Error(`Inventory record not found for product: ${productId}`);
      }

      const available = current.quantityOnHand - current.quantityReserved;
      if (available < amount) {
        throw new InsufficientStockError(amount, available, productId);
      }

      const newReserved = current.quantityReserved + amount;
      return this.update(storeId, current.id, { quantityReserved: newReserved });
    }
  }

  async atomicRelease(storeId: string, productId: string, amount: number): Promise<Inventory> {
    if (amount <= 0) {
      throw new InvalidQuantityError('Release amount must be positive');
    }

    try {
      const row = await this.client.rpc<DbInventory>('rpc_atomic_release_stock', {
        p_store_id: storeId,
        p_product_id: productId,
        p_amount: amount,
      });
      return toDomain(row);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Cannot release') || msg.includes('P0001')) {
        throw new InvalidReservationError(msg);
      }
      if (!isMissingRpcError(err)) {
        throw err;
      }
      // Mock / fallback path
      const current = await this.findByProductId(storeId, productId);
      if (!current) {
        throw new Error(`Inventory record not found for product: ${productId}`);
      }

      if (current.quantityReserved < amount) {
        throw new InvalidReservationError(
          `Cannot release ${amount} units; only ${current.quantityReserved} currently reserved`,
        );
      }

      const newReserved = current.quantityReserved - amount;
      return this.update(storeId, current.id, { quantityReserved: newReserved });
    }
  }

  async atomicConsume(
    storeId: string,
    productId: string,
    amount: number,
    fromReserved: boolean,
  ): Promise<Inventory> {
    if (amount <= 0) {
      throw new InvalidQuantityError('Consumption amount must be positive');
    }

    try {
      const row = await this.client.rpc<DbInventory>('rpc_atomic_consume_stock', {
        p_store_id: storeId,
        p_product_id: productId,
        p_amount: amount,
        p_from_reserved: fromReserved,
      });
      return toDomain(row);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Cannot consume') || msg.includes('P0001')) {
        if (msg.includes('on hand')) {
          throw new NegativeStockError(msg);
        }
        throw new InvalidReservationError(msg);
      }
      if (msg.includes('Insufficient stock')) {
        throw new InsufficientStockError(amount, 0, productId);
      }
      if (!isMissingRpcError(err)) {
        throw err;
      }
      // Mock / fallback path
      const current = await this.findByProductId(storeId, productId);
      if (!current) {
        throw new Error(`Inventory record not found for product: ${productId}`);
      }

      if (fromReserved) {
        if (current.quantityReserved < amount) {
          throw new InvalidReservationError(
            `Cannot consume ${amount} reserved units; only ${current.quantityReserved} reserved`,
          );
        }
        if (current.quantityOnHand < amount) {
          throw new NegativeStockError('Cannot consume more stock than is on hand');
        }

        const newReserved = current.quantityReserved - amount;
        const newOnHand = current.quantityOnHand - amount;
        return this.update(storeId, current.id, {
          quantityOnHand: newOnHand,
          quantityReserved: newReserved,
        });
      } else {
        const available = current.quantityOnHand - current.quantityReserved;
        if (available < amount) {
          throw new InsufficientStockError(amount, available, productId);
        }

        const newOnHand = current.quantityOnHand - amount;
        return this.update(storeId, current.id, { quantityOnHand: newOnHand });
      }
    }
  }
}

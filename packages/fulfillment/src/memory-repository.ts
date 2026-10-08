import {
  Fulfillment,
  FulfillmentItem,
  FulfillmentWithItems,
  FulfillmentStatus,
  FulfillmentFilter,
} from './types.js';
import { FulfillmentRepository, UpdateFulfillmentStatusPatch } from './fulfillment-repository.js';
import {
  FulfillmentItemRepository,
  UpdateFulfillmentItemPatch,
} from './fulfillment-item-repository.js';
import {
  FulfillmentIdempotencyRecord,
  FulfillmentIdempotencyRepository,
} from './idempotency-repository.js';
import {
  FulfillmentNotFoundError,
  FulfillmentStoreMismatchError,
  FulfillmentAlreadyExistsError,
} from './errors.js';
import {
  validateFulfillmentStateTransition,
  validateFulfillmentItemStateTransition,
} from './validation.js';

export class InMemoryFulfillmentRepository implements FulfillmentRepository {
  private readonly records = new Map<string, Fulfillment>(); // storeId:id -> Fulfillment
  private readonly itemsMap = new Map<string, FulfillmentItem[]>(); // storeId:fulfillmentId -> FulfillmentItem[]
  private readonly locks = new Map<string, Promise<void>>();

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

  async create(
    storeId: string,
    fulfillment: Fulfillment,
    items: readonly FulfillmentItem[],
  ): Promise<FulfillmentWithItems> {
    if (fulfillment.storeId !== storeId) {
      throw new FulfillmentStoreMismatchError(
        `Fulfillment store "${fulfillment.storeId}" does not match target store "${storeId}"`,
      );
    }

    const orderLockKey = `${storeId}:order:${fulfillment.orderId}`;
    const releaseOrderLock = await this.acquireLock(orderLockKey);

    try {
      // Enforce: only one active/completed fulfillment per order
      const existing = await this.findActiveByOrderId(storeId, fulfillment.orderId);
      if (existing) {
        throw new FulfillmentAlreadyExistsError(fulfillment.orderId, existing.id);
      }

      const key = `${storeId}:${fulfillment.id}`;
      if (this.records.has(key)) {
        throw new FulfillmentAlreadyExistsError(fulfillment.orderId, fulfillment.id);
      }

      const frozenFulfillment = Object.freeze({ ...fulfillment });
      const frozenItems = items.map((item) => {
        if (item.storeId !== storeId) {
          throw new FulfillmentStoreMismatchError(
            `FulfillmentItem store "${item.storeId}" does not match target store "${storeId}"`,
          );
        }
        return Object.freeze({ ...item });
      });

      this.records.set(key, frozenFulfillment);
      this.itemsMap.set(key, frozenItems);

      return {
        ...frozenFulfillment,
        items: frozenItems,
      };
    } finally {
      releaseOrderLock();
    }
  }

  async findById(storeId: string, id: string): Promise<FulfillmentWithItems | null> {
    const key = `${storeId}:${id}`;
    const fulfillment = this.records.get(key);
    if (!fulfillment) {
      return null;
    }

    const items = this.itemsMap.get(key) ?? [];
    return {
      ...fulfillment,
      items: [...items],
    };
  }

  async findByOrderId(storeId: string, orderId: string): Promise<readonly FulfillmentWithItems[]> {
    const results: FulfillmentWithItems[] = [];
    for (const [key, fulfillment] of this.records.entries()) {
      if (fulfillment.storeId === storeId && fulfillment.orderId === orderId) {
        const items = this.itemsMap.get(key) ?? [];
        results.push({
          ...fulfillment,
          items: [...items],
        });
      }
    }
    return results;
  }

  async findActiveByOrderId(
    storeId: string,
    orderId: string,
  ): Promise<FulfillmentWithItems | null> {
    const all = await this.findByOrderId(storeId, orderId);
    return (
      all.find(
        (f) =>
          f.status === 'PENDING' ||
          f.status === 'PROCESSING' ||
          f.status === 'FULFILLED' ||
          f.status === 'MANUAL_REVIEW',
      ) ?? null
    );
  }

  async updateStatus(
    storeId: string,
    id: string,
    targetStatus: FulfillmentStatus,
    patch?: UpdateFulfillmentStatusPatch | undefined,
  ): Promise<FulfillmentWithItems> {
    const key = `${storeId}:${id}`;
    const releaseLock = await this.acquireLock(key);

    try {
      const existing = this.records.get(key);
      if (!existing) {
        throw new FulfillmentNotFoundError(id);
      }

      validateFulfillmentStateTransition(existing.status, targetStatus);

      const now = new Date().toISOString();
      const updated: Fulfillment = Object.freeze({
        ...existing,
        status: targetStatus,
        failureReason:
          patch?.failureReason !== undefined ? patch.failureReason : existing.failureReason,
        trackingInfo: patch?.trackingInfo
          ? Object.freeze({ ...existing.trackingInfo, ...patch.trackingInfo })
          : existing.trackingInfo,
        metadata: patch?.metadata
          ? Object.freeze({ ...existing.metadata, ...patch.metadata })
          : existing.metadata,
        updatedAt: now,
      });

      this.records.set(key, updated);

      const items = this.itemsMap.get(key) ?? [];
      return {
        ...updated,
        items: [...items],
      };
    } finally {
      releaseLock();
    }
  }

  async list(
    storeId: string,
    filter?: FulfillmentFilter | undefined,
  ): Promise<readonly FulfillmentWithItems[]> {
    const results: FulfillmentWithItems[] = [];

    for (const [key, record] of this.records.entries()) {
      if (record.storeId !== storeId) continue;

      if (filter?.orderId && record.orderId !== filter.orderId) continue;
      if (filter?.status && record.status !== filter.status) continue;
      if (filter?.strategy && record.strategy !== filter.strategy) continue;

      const items = this.itemsMap.get(key) ?? [];
      results.push({
        ...record,
        items: [...items],
      });
    }

    return results;
  }

  // Helper method for item repository to update memory items
  internalUpdateItem(
    storeId: string,
    id: string,
    patch: UpdateFulfillmentItemPatch,
  ): FulfillmentItem {
    for (const items of this.itemsMap.values()) {
      const index = items.findIndex((i) => i.id === id && i.storeId === storeId);
      if (index !== -1) {
        const current = items[index];
        if (!current) continue;

        if (patch.status) {
          validateFulfillmentItemStateTransition(current.status, patch.status);
        }

        const updated: FulfillmentItem = Object.freeze({
          id: current.id,
          storeId: current.storeId,
          fulfillmentId: current.fulfillmentId,
          orderItemId: current.orderItemId,
          itemType: current.itemType,
          status: patch.status ?? current.status,
          payloadReference:
            patch.payloadReference !== undefined
              ? patch.payloadReference
              : current.payloadReference,
          inventoryItemId:
            patch.inventoryItemId !== undefined ? patch.inventoryItemId : current.inventoryItemId,
          createdAt: current.createdAt,
        });

        items[index] = updated;
        return updated;
      }
    }

    throw new FulfillmentNotFoundError(`Fulfillment item "${id}" not found`);
  }

  internalFindItemById(storeId: string, id: string): FulfillmentItem | null {
    for (const items of this.itemsMap.values()) {
      const item = items.find((i) => i.id === id && i.storeId === storeId);
      if (item) return item;
    }
    return null;
  }

  internalListItemsByFulfillmentId(
    storeId: string,
    fulfillmentId: string,
  ): readonly FulfillmentItem[] {
    const key = `${storeId}:${fulfillmentId}`;
    return this.itemsMap.get(key) ?? [];
  }
}

export class InMemoryFulfillmentItemRepository implements FulfillmentItemRepository {
  constructor(private readonly fulfillmentRepo: InMemoryFulfillmentRepository) {}

  async findById(storeId: string, id: string): Promise<FulfillmentItem | null> {
    return this.fulfillmentRepo.internalFindItemById(storeId, id);
  }

  async listByFulfillmentId(
    storeId: string,
    fulfillmentId: string,
  ): Promise<readonly FulfillmentItem[]> {
    return this.fulfillmentRepo.internalListItemsByFulfillmentId(storeId, fulfillmentId);
  }

  async updateItem(
    storeId: string,
    id: string,
    patch: UpdateFulfillmentItemPatch,
  ): Promise<FulfillmentItem> {
    return this.fulfillmentRepo.internalUpdateItem(storeId, id, patch);
  }
}

export class InMemoryFulfillmentIdempotencyRepository implements FulfillmentIdempotencyRepository {
  private readonly records = new Map<string, FulfillmentIdempotencyRecord>();
  private readonly locks = new Map<string, Promise<void>>();

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

  async get(
    storeId: string,
    actorId: string,
    key: string,
  ): Promise<FulfillmentIdempotencyRecord | null> {
    const compositeKey = `${storeId}:${actorId}:${key}`;
    return this.records.get(compositeKey) ?? null;
  }

  async set(record: FulfillmentIdempotencyRecord): Promise<void> {
    const compositeKey = `${record.storeId}:${record.actorId}:${record.key}`;
    const releaseLock = await this.acquireLock(compositeKey);

    try {
      this.records.set(compositeKey, Object.freeze({ ...record }));
    } finally {
      releaseLock();
    }
  }
}

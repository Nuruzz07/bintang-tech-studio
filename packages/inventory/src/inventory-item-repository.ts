import { InventoryItem, InventoryItemStatus } from './types.js';

export interface CreateInventoryItemInput {
  readonly productId: string;
  readonly inventoryId?: string | null | undefined;
  readonly itemType?: string | undefined;
  readonly secretReference: string;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Tenant-scoped Inventory Item Repository interface.
 * Manages unique single-use credentials/assets (e.g. license keys, accounts, vouchers).
 * All operations require an explicit storeId to enforce tenant boundary isolation.
 */
export interface InventoryItemRepository {
  /**
   * Persists a new individual inventory item entity.
   */
  create(storeId: string, item: InventoryItem): Promise<InventoryItem>;

  /**
   * Retrieves an inventory item by ID within a store boundary.
   */
  findById(storeId: string, id: string): Promise<InventoryItem | null>;

  /**
   * Lists inventory items for a specific product and optional status within a store.
   */
  listByProductId(
    storeId: string,
    productId: string,
    status?: InventoryItemStatus,
  ): Promise<readonly InventoryItem[]>;

  /**
   * Updates an item's lifecycle status and reservation/assignment metadata.
   */
  updateStatus(
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
  ): Promise<InventoryItem>;

  /**
   * Counts the number of items for a product with a given status within a store.
   */
  countByStatus(storeId: string, productId: string, status: InventoryItemStatus): Promise<number>;
}

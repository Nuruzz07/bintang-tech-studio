import { Inventory, AdjustStockInput } from './types.js';

/**
 * Tenant-scoped Inventory Repository interface.
 * All operations require an explicit storeId to enforce tenant boundary isolation.
 */
export interface InventoryRepository {
  /**
   * Persists a new inventory record for a product within a store.
   */
  create(storeId: string, inventory: Inventory): Promise<Inventory>;

  /**
   * Retrieves an inventory record by primary ID within a store boundary.
   */
  findById(storeId: string, id: string): Promise<Inventory | null>;

  /**
   * Retrieves an inventory record for a specific product within a store boundary.
   */
  findByProductId(storeId: string, productId: string): Promise<Inventory | null>;

  /**
   * Lists all inventory records for a store.
   */
  list(storeId: string): Promise<readonly Inventory[]>;

  /**
   * Updates an existing inventory record.
   * Modifying storeId or productId is strictly prohibited.
   */
  update(
    storeId: string,
    id: string,
    data: Partial<Omit<Inventory, 'id' | 'storeId' | 'productId'>>,
  ): Promise<Inventory>;

  /**
   * Atomically adjusts quantity on hand (INCREASE, DECREASE, SET) while preserving invariants.
   */
  atomicAdjustStock(
    storeId: string,
    productId: string,
    operation: AdjustStockInput,
  ): Promise<Inventory>;

  /**
   * Atomically reserves a quantity of stock.
   * Fails if available (on_hand - reserved) < amount.
   */
  atomicReserve(storeId: string, productId: string, amount: number): Promise<Inventory>;

  /**
   * Atomically releases a previously reserved quantity.
   * Fails if reserved < amount.
   */
  atomicRelease(storeId: string, productId: string, amount: number): Promise<Inventory>;

  /**
   * Atomically consumes/deducts stock.
   * fromReserved === true: deducts from both quantityReserved and quantityOnHand.
   * fromReserved === false: deducts from quantityOnHand directly (available >= amount).
   */
  atomicConsume(
    storeId: string,
    productId: string,
    amount: number,
    fromReserved: boolean,
  ): Promise<Inventory>;
}

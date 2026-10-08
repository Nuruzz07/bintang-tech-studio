import { Order, OrderItem, OrderWithItems, OrderFilter, OrderStatus } from './types.js';

/**
 * Tenant-scoped Order Repository contract.
 * All operations require an explicit storeId to enforce tenant boundary isolation.
 */
export interface OrderRepository {
  /**
   * Persists an order aggregate and its line item snapshots atomically.
   */
  create(storeId: string, order: Order, items: readonly OrderItem[]): Promise<OrderWithItems>;

  /**
   * Retrieves an order with its line items by primary ID within a store boundary.
   */
  findById(storeId: string, id: string): Promise<OrderWithItems | null>;

  /**
   * Retrieves an order with its line items by human-readable orderNumber within a store boundary.
   */
  findByOrderNumber(storeId: string, orderNumber: string): Promise<OrderWithItems | null>;

  /**
   * Lists orders for a store matching the given filter.
   */
  list(storeId: string, filter?: OrderFilter): Promise<readonly OrderWithItems[]>;

  /**
   * Lists orders belonging to a specific customer within a store.
   */
  listByCustomerId(
    storeId: string,
    customerId: string,
    filter?: OrderFilter,
  ): Promise<readonly OrderWithItems[]>;

  /**
   * Atomically updates an order's status and updates timestamp within a store boundary.
   */
  updateStatus(
    storeId: string,
    id: string,
    status: OrderStatus,
    metadata?: Readonly<Record<string, unknown>> | undefined,
  ): Promise<OrderWithItems>;
}

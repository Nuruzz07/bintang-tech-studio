import { Order, OrderItem, OrderWithItems, OrderFilter, OrderStatus, Customer } from './types.js';
import { OrderRepository } from './order-repository.js';
import { CustomerRepository } from './customer-repository.js';
import { IdempotencyRepository, IdempotencyRecord } from './idempotency-repository.js';
import { OrderNotFoundError, OrderCreationConflictError } from './errors.js';
import { validateOrderStateTransition } from './validation.js';

/**
 * Concurrency-safe in-memory implementation of OrderRepository.
 * Enforces tenant boundary isolation, unique order numbers per store, and atomic state transitions.
 */
export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();
  private readonly items = new Map<string, OrderItem[]>(); // orderId -> OrderItem[]
  private readonly orderNumberIndex = new Map<string, string>(); // `${storeId}:${orderNumber}` -> orderId
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
    order: Order,
    items: readonly OrderItem[],
  ): Promise<OrderWithItems> {
    if (order.storeId !== storeId) {
      throw new Error(
        `Order storeId ${order.storeId} does not match repository storeId ${storeId}`,
      );
    }

    const orderNumberKey = `${storeId}:${order.orderNumber}`;
    if (this.orderNumberIndex.has(orderNumberKey)) {
      throw new OrderCreationConflictError(
        `Order with number ${order.orderNumber} already exists in store ${storeId}`,
      );
    }

    const frozenOrder = Object.freeze({ ...order });
    const frozenItems = Object.freeze(items.map((i) => Object.freeze({ ...i })));

    this.orders.set(order.id, frozenOrder);
    this.items.set(order.id, [...frozenItems]);
    this.orderNumberIndex.set(orderNumberKey, order.id);

    return {
      ...frozenOrder,
      items: frozenItems,
    };
  }

  async findById(storeId: string, id: string): Promise<OrderWithItems | null> {
    const order = this.orders.get(id);
    if (!order || order.storeId !== storeId) {
      return null;
    }

    const orderItems = this.items.get(id) ?? [];
    return {
      ...order,
      items: Object.freeze([...orderItems]),
    };
  }

  async findByOrderNumber(storeId: string, orderNumber: string): Promise<OrderWithItems | null> {
    const orderNumberKey = `${storeId}:${orderNumber}`;
    const orderId = this.orderNumberIndex.get(orderNumberKey);
    if (!orderId) {
      return null;
    }

    return this.findById(storeId, orderId);
  }

  async list(storeId: string, filter?: OrderFilter): Promise<readonly OrderWithItems[]> {
    const results: OrderWithItems[] = [];

    const filterStatuses = filter?.status
      ? Array.isArray(filter.status)
        ? filter.status
        : [filter.status]
      : null;

    for (const order of this.orders.values()) {
      if (order.storeId !== storeId) continue;

      if (filterStatuses && !filterStatuses.includes(order.status)) {
        continue;
      }

      if (filter?.customerId && order.customerId !== filter.customerId) {
        continue;
      }

      const orderItems = this.items.get(order.id) ?? [];
      results.push({
        ...order,
        items: Object.freeze([...orderItems]),
      });
    }

    // Sort descending by createdAt
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    let sliced = results;
    if (filter?.offset) {
      sliced = sliced.slice(filter.offset);
    }
    if (filter?.limit) {
      sliced = sliced.slice(0, filter.limit);
    }

    return Object.freeze(sliced);
  }

  async listByCustomerId(
    storeId: string,
    customerId: string,
    filter?: OrderFilter,
  ): Promise<readonly OrderWithItems[]> {
    return this.list(storeId, { ...filter, customerId });
  }

  async updateStatus(
    storeId: string,
    id: string,
    status: OrderStatus,
    metadata?: Readonly<Record<string, unknown>> | undefined,
  ): Promise<OrderWithItems> {
    const releaseLock = await this.acquireLock(id);

    try {
      const existing = await this.findById(storeId, id);
      if (!existing) {
        throw new OrderNotFoundError(id);
      }

      validateOrderStateTransition(existing.status, status);

      const updated: Order = Object.freeze({
        ...existing,
        status,
        metadata: metadata
          ? Object.freeze({ ...existing.metadata, ...metadata })
          : existing.metadata,
        updatedAt: new Date().toISOString(),
      });

      this.orders.set(id, updated);

      const orderItems = this.items.get(id) ?? [];
      return {
        ...updated,
        items: Object.freeze([...orderItems]),
      };
    } finally {
      releaseLock();
    }
  }

  clear(): void {
    this.orders.clear();
    this.items.clear();
    this.orderNumberIndex.clear();
    this.locks.clear();
  }
}

/**
 * Concurrency-safe in-memory implementation of CustomerRepository.
 */
export class InMemoryCustomerRepository implements CustomerRepository {
  private readonly customers = new Map<string, Customer>();

  async create(storeId: string, customer: Customer): Promise<Customer> {
    if (customer.storeId !== storeId) {
      throw new Error(
        `Customer storeId ${customer.storeId} does not match repository storeId ${storeId}`,
      );
    }

    const record = Object.freeze({ ...customer });
    this.customers.set(customer.id, record);
    return record;
  }

  async findById(storeId: string, id: string): Promise<Customer | null> {
    const customer = this.customers.get(id);
    if (!customer || customer.storeId !== storeId) {
      return null;
    }
    return customer;
  }

  async findByEmail(storeId: string, email: string): Promise<Customer | null> {
    const normalized = email.trim().toLowerCase();
    for (const cust of this.customers.values()) {
      if (cust.storeId === storeId && cust.email?.trim().toLowerCase() === normalized) {
        return cust;
      }
    }
    return null;
  }

  async list(storeId: string): Promise<readonly Customer[]> {
    const results: Customer[] = [];
    for (const cust of this.customers.values()) {
      if (cust.storeId === storeId) {
        results.push(cust);
      }
    }
    return Object.freeze(results);
  }

  clear(): void {
    this.customers.clear();
  }
}

/**
 * In-memory implementation of IdempotencyRepository scoped by (storeId, actorId, key).
 */
export class InMemoryIdempotencyRepository implements IdempotencyRepository {
  private readonly records = new Map<string, IdempotencyRecord>();

  private buildKey(storeId: string, actorId: string, key: string): string {
    return `${storeId}:${actorId}:${key.trim()}`;
  }

  async get(storeId: string, actorId: string, key: string): Promise<IdempotencyRecord | null> {
    const compoundKey = this.buildKey(storeId, actorId, key);
    const record = this.records.get(compoundKey);
    return record ?? null;
  }

  async set(record: IdempotencyRecord): Promise<void> {
    const compoundKey = this.buildKey(record.storeId, record.actorId, record.key);
    this.records.set(compoundKey, Object.freeze({ ...record }));
  }

  clear(): void {
    this.records.clear();
  }
}

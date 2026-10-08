import {
  AuthenticatedStoreContext,
  StoreContext,
  createAuthenticatedStoreContext,
} from '@bintang/tenancy';
import { AuthorizationService } from '@bintang/authorization';
import { ProductRepository } from '@bintang/commerce';
import { InventoryService } from '@bintang/inventory';
import {
  Order,
  OrderItem,
  OrderWithItems,
  OrderFilter,
  OrderStatus,
  CreateOrderInput,
  OrderCaller,
} from './types.js';
import { OrderRepository } from './order-repository.js';
import { CustomerRepository } from './customer-repository.js';
import { IdempotencyRepository } from './idempotency-repository.js';
import {
  OrderNotFoundError,
  CustomerNotFoundError,
  ProductUnavailableError,
  EmptyOrderItemsError,
  IdempotencyConflictError,
  CustomerOrderAccessDeniedError,
  OrderAlreadyCancelledError,
  OrderAlreadyFulfilledError,
  InvalidOrderStateTransitionError,
} from './errors.js';
import {
  validateOrderQuantity,
  validateOrderStateTransition,
  generateUUID,
  generateOrderNumber,
} from './validation.js';
import { normalizeMoney, multiplyMoney, addMoney, subtractMoney } from './money.js';

export interface OrderServiceOptions {
  readonly orderRepository: OrderRepository;
  readonly customerRepository: CustomerRepository;
  readonly productRepository: ProductRepository;
  readonly inventoryService: InventoryService;
  readonly authorizationService: AuthorizationService;
  readonly idempotencyRepository?: IdempotencyRepository | undefined;
}

/**
 * Tenant-scoped Order Application Service.
 * Coordinates order creation, snapshots, inventory reservation, state transitions,
 * customer ownership, seller authorization, and idempotency.
 */
export class OrderService {
  private readonly orderRepo: OrderRepository;
  private readonly customerRepo: CustomerRepository;
  private readonly productRepo: ProductRepository;
  private readonly inventoryService: InventoryService;
  private readonly authService: AuthorizationService;
  private readonly idempotencyRepo?: IdempotencyRepository | undefined;
  private readonly inFlightLocks = new Map<string, Promise<void>>();

  constructor(options: OrderServiceOptions) {
    this.orderRepo = options.orderRepository;
    this.customerRepo = options.customerRepository;
    this.productRepo = options.productRepository;
    this.inventoryService = options.inventoryService;
    this.authService = options.authorizationService;
    this.idempotencyRepo = options.idempotencyRepository;
  }

  private async acquireInFlightLock(key: string): Promise<() => void> {
    while (this.inFlightLocks.has(key)) {
      await this.inFlightLocks.get(key);
    }

    let release!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      release = () => {
        this.inFlightLocks.delete(key);
        resolve();
      };
    });

    this.inFlightLocks.set(key, lockPromise);
    return release;
  }

  /**
   * Helper to derive the inventory execution context.
   * If caller is a merchant seller, uses their context.
   * If caller is a customer, constructs an internal store service context scoped strictly to the store.
   */
  private getInventoryContext(
    storeId: string,
    caller: OrderCaller,
  ): AuthenticatedStoreContext | StoreContext {
    if (
      caller.type === 'SELLER' &&
      'role' in caller.context &&
      caller.context.role !== 'STORE_STAFF'
    ) {
      return caller.context;
    }
    return createAuthenticatedStoreContext({
      storeId,
      userId: `system:order-engine:${storeId}`,
      membershipId: `sys_mem_${storeId}`,
      role: 'STORE_ADMIN',
    });
  }

  /**
   * Creates an order with immutable line item snapshots and atomic inventory reservations.
   */
  async createOrder(caller: OrderCaller, input: CreateOrderInput): Promise<OrderWithItems> {
    let storeId: string;
    let customerId: string;
    let actorId: string;

    // 1. Context Resolution & Authorization
    if (caller.type === 'CUSTOMER') {
      storeId = caller.context.storeId;
      customerId = caller.context.customerId;
      actorId = caller.context.customerId;
    } else {
      storeId = caller.context.storeId;
      if (!input.customerId) {
        throw new CustomerNotFoundError('customerId is required for merchant-created order');
      }
      customerId = input.customerId;
      actorId = caller.context.userId ?? 'anonymous';

      await this.authService.assertAuthorizedStoreAction({
        context: caller.context,
        permission: 'orders.update',
        targetStoreId: storeId,
      });
    }

    // 2. Customer Verification
    const customer = await this.customerRepo.findById(storeId, customerId);
    if (!customer) {
      throw new CustomerNotFoundError(customerId);
    }

    // Acquire in-flight lock if idempotencyKey is provided to prevent concurrent duplicate orders
    let releaseLock: (() => void) | undefined;
    if (input.idempotencyKey) {
      const lockKey = `${storeId}:${actorId}:${input.idempotencyKey.trim()}`;
      releaseLock = await this.acquireInFlightLock(lockKey);
    }

    try {
      // 3. Idempotency Check
      let requestPayloadHash = '';
      if (input.idempotencyKey && this.idempotencyRepo) {
        requestPayloadHash = JSON.stringify({
          storeId,
          customerId,
          items: input.items,
          currency: input.currency ?? 'IDR',
        });

        const existingRecord = await this.idempotencyRepo.get(
          storeId,
          actorId,
          input.idempotencyKey,
        );
        if (existingRecord) {
          if (existingRecord.requestHash !== requestPayloadHash) {
            throw new IdempotencyConflictError(
              `Idempotency key "${input.idempotencyKey}" was previously used with a different request payload`,
            );
          }
          return existingRecord.response as OrderWithItems;
        }
      }

      // 4. Validate Items Non-Empty
      if (!input.items || input.items.length === 0) {
        throw new EmptyOrderItemsError();
      }

      // 5. Load Products, Validate Status, and Prepare Snapshots
      const inventoryCtx = this.getInventoryContext(storeId, caller);
      const lineItemSnapshots: Array<{
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: string;
        subtotal: string;
        metadata: Readonly<Record<string, unknown>>;
        stockMode: string;
      }> = [];

      for (const itemInput of input.items) {
        const quantity = validateOrderQuantity(
          itemInput.quantity,
          `Item ${itemInput.productId} quantity`,
        );
        const product = await this.productRepo.findById(storeId, itemInput.productId);

        if (!product) {
          throw new ProductUnavailableError(
            `Product ${itemInput.productId} does not belong to store ${storeId} or does not exist`,
          );
        }

        if (product.status !== 'ACTIVE') {
          throw new ProductUnavailableError(
            `Product "${product.name}" is not active for purchase (status: ${product.status})`,
          );
        }

        // Check stock availability
        const availability = await this.inventoryService.getAvailability(inventoryCtx, product.id);
        if (product.stockMode === 'TRACKED') {
          if (availability.availableQuantity < quantity) {
            throw new ProductUnavailableError(
              `Insufficient stock for "${product.name}" (requested: ${quantity}, available: ${availability.availableQuantity})`,
            );
          }
        }

        const unitPrice = normalizeMoney(product.price, 'product price');
        const subtotal = multiplyMoney(unitPrice, quantity);

        lineItemSnapshots.push({
          productId: product.id,
          productName: product.name,
          quantity,
          unitPrice,
          subtotal,
          metadata: Object.freeze({ ...(itemInput.metadata ?? {}) }),
          stockMode: product.stockMode,
        });
      }

      // 6. Calculate Financial Totals
      let orderSubtotal = '0.00';
      for (const line of lineItemSnapshots) {
        orderSubtotal = addMoney(orderSubtotal, line.subtotal);
      }
      const discountTotal = '0.00';
      const grandTotal = subtractMoney(orderSubtotal, discountTotal);
      const currency = input.currency ?? 'IDR';

      // 7. Atomic Inventory Reservations & Order Persistence (With Compensating Rollback on Failure)
      const orderId = generateUUID();
      const reservedItems: Array<{ productId: string; quantity: number }> = [];

      try {
        for (const line of lineItemSnapshots) {
          if (line.stockMode === 'TRACKED') {
            await this.inventoryService.reserveStock(inventoryCtx, line.productId, {
              amount: line.quantity,
              orderId,
            });
            reservedItems.push({ productId: line.productId, quantity: line.quantity });
          }
        }

        // 8. Persist Order Aggregate and Snapshotted Items
        const now = new Date().toISOString();
        const orderNumber = generateOrderNumber();

        const order: Order = {
          id: orderId,
          storeId,
          customerId,
          orderNumber,
          status: 'PENDING_PAYMENT',
          subtotal: orderSubtotal,
          discountTotal,
          grandTotal,
          currency,
          voucherId: null,
          fulfillmentStatus: 'PENDING',
          metadata: Object.freeze({ ...(input.metadata ?? {}) }),
          createdAt: now,
          updatedAt: now,
        };

        const orderItems: OrderItem[] = lineItemSnapshots.map((line) => ({
          id: generateUUID(),
          storeId,
          orderId,
          productId: line.productId,
          productName: line.productName,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          subtotal: line.subtotal,
          metadata: line.metadata,
          createdAt: now,
        }));

        const createdOrder = await this.orderRepo.create(storeId, order, orderItems);

        // 9. Store Idempotency
        if (input.idempotencyKey && this.idempotencyRepo) {
          await this.idempotencyRepo.set({
            key: input.idempotencyKey,
            storeId,
            actorId,
            requestHash: requestPayloadHash,
            response: createdOrder,
            createdAt: now,
          });
        }

        return createdOrder;
      } catch (operationError) {
        // Compensating transaction: release all reservations made so far for this order
        const rollbackFailures: Array<{ productId: string; error: unknown }> = [];
        for (const rollback of reservedItems) {
          try {
            await this.inventoryService.releaseStock(inventoryCtx, rollback.productId, {
              amount: rollback.quantity,
              orderId,
            });
          } catch (rbError) {
            rollbackFailures.push({ productId: rollback.productId, error: rbError });
          }
        }

        if (rollbackFailures.length > 0) {
          const details = rollbackFailures
            .map(
              (f) =>
                `${f.productId}: ${f.error instanceof Error ? f.error.message : String(f.error)}`,
            )
            .join(', ');
          const compositeError = new Error(
            `Order operation failed and compensating inventory release also partially failed for [${details}]. Original error: ${
              operationError instanceof Error ? operationError.message : String(operationError)
            }`,
          );
          (
            compositeError as unknown as { originalError: unknown; rollbackFailures: unknown }
          ).originalError = operationError;
          (
            compositeError as unknown as { originalError: unknown; rollbackFailures: unknown }
          ).rollbackFailures = rollbackFailures;
          throw compositeError;
        }

        throw operationError;
      }
    } finally {
      if (releaseLock) {
        releaseLock();
      }
    }
  }

  /**
   * Retrieves an order by ID within the caller's store and ownership boundaries.
   */
  async getOrderById(caller: OrderCaller, orderId: string): Promise<OrderWithItems> {
    const storeId = caller.context.storeId;

    if (caller.type === 'SELLER') {
      await this.authService.assertAuthorizedStoreAction({
        context: caller.context,
        permission: 'orders.read',
        targetStoreId: storeId,
      });

      const order = await this.orderRepo.findById(storeId, orderId);
      if (!order) {
        throw new OrderNotFoundError(orderId);
      }
      return order;
    }

    // Customer caller
    const order = await this.orderRepo.findById(storeId, orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }
    if (order.customerId !== caller.context.customerId) {
      throw new CustomerOrderAccessDeniedError();
    }
    return order;
  }

  /**
   * Retrieves an order by human-readable orderNumber within caller's boundaries.
   */
  async getOrderByNumber(caller: OrderCaller, orderNumber: string): Promise<OrderWithItems> {
    const storeId = caller.context.storeId;

    if (caller.type === 'SELLER') {
      await this.authService.assertAuthorizedStoreAction({
        context: caller.context,
        permission: 'orders.read',
        targetStoreId: storeId,
      });

      const order = await this.orderRepo.findByOrderNumber(storeId, orderNumber);
      if (!order) {
        throw new OrderNotFoundError(orderNumber);
      }
      return order;
    }

    // Customer caller
    const order = await this.orderRepo.findByOrderNumber(storeId, orderNumber);
    if (!order) {
      throw new OrderNotFoundError(orderNumber);
    }
    if (order.customerId !== caller.context.customerId) {
      throw new CustomerOrderAccessDeniedError();
    }
    return order;
  }

  /**
   * Lists orders within caller's authorization boundary.
   * Sellers see store-wide orders matching filter.
   * Customers strictly see only their own orders.
   */
  async listOrders(caller: OrderCaller, filter?: OrderFilter): Promise<readonly OrderWithItems[]> {
    const storeId = caller.context.storeId;

    if (caller.type === 'SELLER') {
      await this.authService.assertAuthorizedStoreAction({
        context: caller.context,
        permission: 'orders.read',
        targetStoreId: storeId,
      });

      return this.orderRepo.list(storeId, filter);
    }

    // Customers can ONLY list their own orders
    return this.orderRepo.listByCustomerId(storeId, caller.context.customerId, filter);
  }

  /**
   * Cancels an order and automatically releases reserved inventory if order was in PENDING_PAYMENT.
   */
  async cancelOrder(
    caller: OrderCaller,
    orderId: string,
    reason?: string,
  ): Promise<OrderWithItems> {
    const storeId = caller.context.storeId;

    if (caller.type === 'SELLER') {
      await this.authService.assertAuthorizedStoreAction({
        context: caller.context,
        permission: 'orders.cancel',
        targetStoreId: storeId,
      });
    }

    const order = await this.orderRepo.findById(storeId, orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    if (caller.type === 'CUSTOMER' && order.customerId !== caller.context.customerId) {
      throw new CustomerOrderAccessDeniedError();
    }

    if (order.status === 'CANCELLED') {
      throw new OrderAlreadyCancelledError(orderId);
    }
    if (order.status === 'FULFILLED') {
      throw new OrderAlreadyFulfilledError(orderId);
    }
    if (order.status === 'PAID' || order.status === 'PROCESSING') {
      throw new InvalidOrderStateTransitionError(
        order.status,
        'CANCELLED',
        'Cannot cancel a PAID or PROCESSING order without payment refund processing (M08 dependency)',
      );
    }

    validateOrderStateTransition(order.status, 'CANCELLED');

    // Release inventory reservation if order was in PENDING_PAYMENT
    if (order.status === 'PENDING_PAYMENT') {
      const inventoryCtx = this.getInventoryContext(storeId, caller);
      for (const item of order.items) {
        if (item.productId) {
          const product = await this.productRepo.findById(storeId, item.productId);
          if (product && product.stockMode === 'TRACKED') {
            await this.inventoryService.releaseStock(inventoryCtx, item.productId, {
              amount: item.quantity,
              orderId: order.id,
            });
          }
        }
      }
    }

    return this.orderRepo.updateStatus(storeId, orderId, 'CANCELLED', {
      cancelledAt: new Date().toISOString(),
      cancellationReason: reason ?? 'User requested cancellation',
    });
  }

  /**
   * Transitions an order to a new lifecycle state.
   * Enforces seller authorization (orders.update) and valid state machine transitions.
   */
  async transitionStatus(
    sellerContext: AuthenticatedStoreContext | StoreContext,
    orderId: string,
    targetStatus: OrderStatus,
    metadataPatch?: Readonly<Record<string, unknown>>,
  ): Promise<OrderWithItems> {
    await this.authService.assertAuthorizedStoreAction({
      context: sellerContext,
      permission: 'orders.update',
      targetStoreId: sellerContext.storeId,
    });

    const order = await this.orderRepo.findById(sellerContext.storeId, orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    validateOrderStateTransition(order.status, targetStatus);

    if (order.status === targetStatus) {
      return order;
    }

    const inventoryCtx = this.getInventoryContext(sellerContext.storeId, {
      type: 'SELLER',
      context: sellerContext,
    });

    // If fulfilling, consume reserved stock
    if (targetStatus === 'FULFILLED') {
      for (const item of order.items) {
        if (item.productId) {
          const product = await this.productRepo.findById(sellerContext.storeId, item.productId);
          if (product && product.stockMode === 'TRACKED') {
            await this.inventoryService.consumeReserved(
              inventoryCtx,
              item.productId,
              item.quantity,
              order.id,
            );
          }
        }
      }
    }

    // If cancelling or expiring, release reserved inventory
    if (
      (targetStatus === 'CANCELLED' || targetStatus === 'EXPIRED') &&
      (order.status === 'PENDING_PAYMENT' ||
        order.status === 'PAID' ||
        order.status === 'PROCESSING')
    ) {
      for (const item of order.items) {
        if (item.productId) {
          const product = await this.productRepo.findById(sellerContext.storeId, item.productId);
          if (product && product.stockMode === 'TRACKED') {
            await this.inventoryService.releaseStock(inventoryCtx, item.productId, {
              amount: item.quantity,
              orderId: order.id,
            });
          }
        }
      }
    }

    return this.orderRepo.updateStatus(sellerContext.storeId, orderId, targetStatus, metadataPatch);
  }
}

/**
 * Bintang Tech Studio — Order Foundation Package.
 * Milestone M07: Domain & Service Foundation.
 */

// Types & DTOs
export {
  type Order,
  type OrderItem,
  type OrderWithItems,
  type Customer,
  type OrderStatus,
  type FulfillmentStatus,
  type CreateOrderInput,
  type CreateOrderItemInput,
  type OrderFilter,
  type CustomerContext,
  type OrderCaller,
  ORDER_STATUSES,
  FULFILLMENT_STATUSES,
} from './types.js';

// Errors
export {
  OrderError,
  OrderNotFoundError,
  OrderItemNotFoundError,
  CustomerNotFoundError,
  InvalidOrderQuantityError,
  InvalidOrderStateTransitionError,
  OrderAlreadyCancelledError,
  OrderAlreadyFulfilledError,
  CrossTenantOrderError,
  CustomerOrderAccessDeniedError,
  InsufficientStockError,
  ProductUnavailableError,
  OrderCreationConflictError,
  IdempotencyConflictError,
  EmptyOrderItemsError,
} from './errors.js';

// Money & Math
export { normalizeMoney, multiplyMoney, addMoney, subtractMoney } from './money.js';

// Validation & Generators
export {
  validateOrderQuantity,
  validateOrderStateTransition,
  generateUUID,
  generateOrderNumber,
} from './validation.js';

// Repositories
export { type OrderRepository } from './order-repository.js';
export { type CustomerRepository } from './customer-repository.js';
export { type IdempotencyRepository, type IdempotencyRecord } from './idempotency-repository.js';
export {
  InMemoryOrderRepository,
  InMemoryCustomerRepository,
  InMemoryIdempotencyRepository,
} from './memory-repository.js';

// Application Service
export { OrderService, type OrderServiceOptions } from './order-service.js';

import {
  ApplicationError,
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from '@bintang/shared';
export { InsufficientStockError } from '@bintang/inventory';

/**
 * Base domain error for orders.
 */
export class OrderError extends ApplicationError {
  constructor(message: string, code = 'ORDER_ERROR', statusCode = 400, details?: unknown) {
    super(message, code, statusCode, details);
  }
}

export class OrderNotFoundError extends NotFoundError {
  constructor(orderIdOrNumber: string) {
    super(`Order not found: ${orderIdOrNumber}`, { resource: orderIdOrNumber });
  }
}

export class OrderItemNotFoundError extends NotFoundError {
  constructor(itemId: string) {
    super(`Order item not found: ${itemId}`, { resource: itemId });
  }
}

export class CustomerNotFoundError extends NotFoundError {
  constructor(customerId: string) {
    super(`Customer not found in store: ${customerId}`, { resource: customerId });
  }
}

export class InvalidOrderQuantityError extends ValidationError {
  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}

export class InvalidOrderStateTransitionError extends ConflictError {
  constructor(fromStatus: string, toStatus: string, reason?: string) {
    super(
      `Invalid order state transition from "${fromStatus}" to "${toStatus}"${reason ? `: ${reason}` : ''}`,
      { fromStatus, toStatus, reason },
    );
  }
}

export class OrderAlreadyCancelledError extends ConflictError {
  constructor(orderId: string) {
    super(`Order is already cancelled: ${orderId}`, { orderId });
  }
}

export class OrderAlreadyFulfilledError extends ConflictError {
  constructor(orderId: string) {
    super(`Order is already fulfilled: ${orderId}`, { orderId });
  }
}

export class CrossTenantOrderError extends ForbiddenError {
  constructor(message = 'Order resource does not belong to the current store or does not exist') {
    super(message);
  }
}

export class CustomerOrderAccessDeniedError extends ForbiddenError {
  constructor(message = 'Customer is not authorized to access this order') {
    super(message);
  }
}

export class ProductUnavailableError extends ValidationError {
  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}

export class OrderCreationConflictError extends ConflictError {
  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}

export class IdempotencyConflictError extends ConflictError {
  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}

export class EmptyOrderItemsError extends ValidationError {
  constructor(message = 'Order must contain at least one item') {
    super(message);
  }
}

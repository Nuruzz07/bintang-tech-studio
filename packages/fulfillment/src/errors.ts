import { FulfillmentStatus, FulfillmentItemStatus } from './types.js';

export class FulfillmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FulfillmentError';
  }
}

export class FulfillmentNotFoundError extends FulfillmentError {
  constructor(id: string) {
    super(`Fulfillment "${id}" not found`);
    this.name = 'FulfillmentNotFoundError';
  }
}

export class FulfillmentOrderNotFoundError extends FulfillmentError {
  constructor(orderId: string) {
    super(`Order "${orderId}" not found for fulfillment`);
    this.name = 'FulfillmentOrderNotFoundError';
  }
}

export class FulfillmentOrderNotPayableError extends FulfillmentError {
  constructor(orderId: string, currentStatus: string) {
    super(
      `Order "${orderId}" in status "${currentStatus}" cannot be fulfilled. Payment prerequisite not met (must be PAID).`,
    );
    this.name = 'FulfillmentOrderNotPayableError';
  }
}

export class FulfillmentOrderInvalidStateError extends FulfillmentError {
  constructor(orderId: string, currentStatus: string) {
    super(`Order "${orderId}" is in terminal or invalid state "${currentStatus}" for fulfillment.`);
    this.name = 'FulfillmentOrderInvalidStateError';
  }
}

export class FulfillmentStoreMismatchError extends FulfillmentError {
  constructor(message: string) {
    super(message);
    this.name = 'FulfillmentStoreMismatchError';
  }
}

export class FulfillmentCustomerAccessDeniedError extends FulfillmentError {
  constructor(message = 'Access to this fulfillment is denied for this customer context') {
    super(message);
    this.name = 'FulfillmentCustomerAccessDeniedError';
  }
}

export class FulfillmentStateTransitionError extends FulfillmentError {
  constructor(from: FulfillmentStatus, to: FulfillmentStatus, reason?: string) {
    super(`Cannot transition fulfillment from "${from}" to "${to}"${reason ? `: ${reason}` : ''}`);
    this.name = 'FulfillmentStateTransitionError';
  }
}

export class FulfillmentItemStateTransitionError extends FulfillmentError {
  constructor(from: FulfillmentItemStatus, to: FulfillmentItemStatus, reason?: string) {
    super(
      `Cannot transition fulfillment item from "${from}" to "${to}"${reason ? `: ${reason}` : ''}`,
    );
    this.name = 'FulfillmentItemStateTransitionError';
  }
}

export class FulfillmentAlreadyCompletedError extends FulfillmentError {
  constructor(fulfillmentId: string) {
    super(`Fulfillment "${fulfillmentId}" is already FULFILLED and cannot be re-executed`);
    this.name = 'FulfillmentAlreadyCompletedError';
  }
}

export class FulfillmentAlreadyExistsError extends FulfillmentError {
  constructor(orderId: string, fulfillmentId: string) {
    super(`Order "${orderId}" already has active or completed fulfillment "${fulfillmentId}"`);
    this.name = 'FulfillmentAlreadyExistsError';
  }
}

export class FulfillmentProviderUnsupportedError extends FulfillmentError {
  constructor(provider: string) {
    super(`Fulfillment provider "${provider}" is not registered or supported`);
    this.name = 'FulfillmentProviderUnsupportedError';
  }
}

export class FulfillmentExecutionError extends FulfillmentError {
  readonly failureCode: string;
  readonly retryable: boolean;

  constructor(message: string, failureCode: string, retryable: boolean) {
    super(message);
    this.name = 'FulfillmentExecutionError';
    this.failureCode = failureCode;
    this.retryable = retryable;
  }
}

export class FulfillmentRetryNotAllowedError extends FulfillmentError {
  constructor(status: FulfillmentStatus, reason?: string) {
    super(
      `Cannot retry fulfillment in status "${status}"${reason ? `: ${reason}` : ' (only FAILED fulfillments can be retried)'}`,
    );
    this.name = 'FulfillmentRetryNotAllowedError';
  }
}

export class FulfillmentInventoryItemUnavailableError extends FulfillmentError {
  constructor(productId: string) {
    super(`No available digital inventory items found for tracked product "${productId}"`);
    this.name = 'FulfillmentInventoryItemUnavailableError';
  }
}

export class FulfillmentCrossTenantItemError extends FulfillmentError {
  constructor(message: string) {
    super(message);
    this.name = 'FulfillmentCrossTenantItemError';
  }
}

export class FulfillmentIdempotencyConflictError extends FulfillmentError {
  constructor(key: string, reason?: string) {
    super(
      `Idempotency conflict for key "${key}"${reason ? `: ${reason}` : ' with mutated payload'}`,
    );
    this.name = 'FulfillmentIdempotencyConflictError';
  }
}

export class FulfillmentDuplicateDeliveryError extends FulfillmentError {
  constructor(fulfillmentId: string) {
    super(`Duplicate delivery detected for fulfillment "${fulfillmentId}"`);
    this.name = 'FulfillmentDuplicateDeliveryError';
  }
}

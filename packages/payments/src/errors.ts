import { ApplicationError } from '@bintang/shared';

export class PaymentError extends ApplicationError {
  constructor(message: string, code = 'PAYMENT_ERROR', statusCode = 400, details?: unknown) {
    super(message, code, statusCode, details);
    this.name = 'PaymentError';
  }
}

export class PaymentNotFoundError extends PaymentError {
  constructor(identifier: string) {
    super(`Payment not found: ${identifier}`, 'PAYMENT_NOT_FOUND');
    this.name = 'PaymentNotFoundError';
  }
}

export class PaymentAccountNotFoundError extends PaymentError {
  constructor(identifier: string) {
    super(`Payment account not found: ${identifier}`, 'PAYMENT_ACCOUNT_NOT_FOUND');
    this.name = 'PaymentAccountNotFoundError';
  }
}

export class PaymentIntentNotFoundError extends PaymentError {
  constructor(identifier: string) {
    super(`Payment intent not found: ${identifier}`, 'PAYMENT_INTENT_NOT_FOUND');
    this.name = 'PaymentIntentNotFoundError';
  }
}

export class PaymentAttemptNotFoundError extends PaymentError {
  constructor(identifier: string) {
    super(`Payment attempt not found: ${identifier}`, 'PAYMENT_ATTEMPT_NOT_FOUND');
    this.name = 'PaymentAttemptNotFoundError';
  }
}

export class PaymentEventDuplicateError extends PaymentError {
  constructor(provider: string, eventId: string) {
    super(
      `Payment event "${eventId}" for provider "${provider}" has already been received`,
      'PAYMENT_EVENT_DUPLICATE',
    );
    this.name = 'PaymentEventDuplicateError';
  }
}

export class PaymentEventConflictError extends PaymentError {
  constructor(provider: string, eventId: string, reason: string) {
    super(
      `Payment event "${eventId}" for provider "${provider}" conflicts with previously received event: ${reason}`,
      'PAYMENT_EVENT_CONFLICT',
    );
    this.name = 'PaymentEventConflictError';
  }
}

export class PaymentAmountMismatchError extends PaymentError {
  constructor(expected: string, received: string) {
    super(
      `Payment amount mismatch: expected authoritative order amount ${expected}, received ${received}`,
      'PAYMENT_AMOUNT_MISMATCH',
    );
    this.name = 'PaymentAmountMismatchError';
  }
}

export class PaymentCurrencyMismatchError extends PaymentError {
  constructor(expected: string, received: string) {
    super(
      `Payment currency mismatch: expected authoritative order currency "${expected}", received "${received}"`,
      'PAYMENT_CURRENCY_MISMATCH',
    );
    this.name = 'PaymentCurrencyMismatchError';
  }
}

export class PaymentStoreMismatchError extends PaymentError {
  constructor(message = 'Payment operation crosses tenant store boundaries') {
    super(message, 'PAYMENT_STORE_MISMATCH');
    this.name = 'PaymentStoreMismatchError';
  }
}

export class PaymentOrderMismatchError extends PaymentError {
  constructor(message = 'Order does not belong to target store or does not match payment intent') {
    super(message, 'PAYMENT_ORDER_MISMATCH');
    this.name = 'PaymentOrderMismatchError';
  }
}

export class PaymentCustomerAccessDeniedError extends PaymentError {
  constructor(message = 'Customer is not authorized to access this payment resource') {
    super(message, 'PAYMENT_CUSTOMER_ACCESS_DENIED');
    this.name = 'PaymentCustomerAccessDeniedError';
  }
}

export class PaymentStateTransitionError extends PaymentError {
  constructor(fromStatus: string, toStatus: string, details?: string) {
    super(
      `Cannot transition payment status from "${fromStatus}" to "${toStatus}"${details ? `: ${details}` : ''}`,
      'PAYMENT_STATE_TRANSITION_ERROR',
    );
    this.name = 'PaymentStateTransitionError';
  }
}

export class PaymentProviderUnsupportedError extends PaymentError {
  constructor(provider: string) {
    super(
      `Payment provider "${provider}" is not registered or supported`,
      'PAYMENT_PROVIDER_UNSUPPORTED',
    );
    this.name = 'PaymentProviderUnsupportedError';
  }
}

export class PaymentCapabilityUnsupportedError extends PaymentError {
  constructor(provider: string, capability: string) {
    super(
      `Payment provider "${provider}" does not support capability "${capability}"`,
      'PAYMENT_CAPABILITY_UNSUPPORTED',
    );
    this.name = 'PaymentCapabilityUnsupportedError';
  }
}

export class PaymentIdempotencyConflictError extends PaymentError {
  constructor(message: string) {
    super(message, 'PAYMENT_IDEMPOTENCY_CONFLICT');
    this.name = 'PaymentIdempotencyConflictError';
  }
}

export class PaymentAlreadyProcessedError extends PaymentError {
  constructor(paymentIntentId: string) {
    super(
      `Payment intent "${paymentIntentId}" has already been processed or completed`,
      'PAYMENT_ALREADY_PROCESSED',
    );
    this.name = 'PaymentAlreadyProcessedError';
  }
}

export class RefundAmountExceededError extends PaymentError {
  constructor(refundable: string, requested: string) {
    super(
      `Requested refund amount (${requested}) exceeds maximum refundable balance (${refundable})`,
      'REFUND_AMOUNT_EXCEEDED',
    );
    this.name = 'RefundAmountExceededError';
  }
}

export class RefundUnsupportedError extends PaymentError {
  constructor(message = 'Refunds are not supported for this payment account or provider') {
    super(message, 'REFUND_UNSUPPORTED');
    this.name = 'RefundUnsupportedError';
  }
}

export class InvalidPaymentProviderEventError extends PaymentError {
  constructor(message: string) {
    super(message, 'INVALID_PAYMENT_PROVIDER_EVENT');
    this.name = 'InvalidPaymentProviderEventError';
  }
}

export class PaymentSignatureVerificationError extends PaymentError {
  constructor(message = 'Payment webhook signature verification failed') {
    super(message, 'PAYMENT_SIGNATURE_VERIFICATION_ERROR');
    this.name = 'PaymentSignatureVerificationError';
  }
}

export class OrderNotPayableError extends PaymentError {
  constructor(orderId: string, status: string) {
    super(
      `Order "${orderId}" cannot be paid because it is in status "${status}" (must be PENDING_PAYMENT)`,
      'ORDER_NOT_PAYABLE',
    );
    this.name = 'OrderNotPayableError';
  }
}

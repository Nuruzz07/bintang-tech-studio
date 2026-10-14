import { ApiErrorResponse } from './types.js';

export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request', details?: unknown) {
    super(400, 'BAD_REQUEST', message, details);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Authentication required', details?: unknown) {
    super(401, 'UNAUTHORIZED', message, details);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Access forbidden', details?: unknown) {
    super(403, 'FORBIDDEN', message, details);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(404, 'NOT_FOUND', message, details);
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict with current state', details?: unknown) {
    super(409, 'CONFLICT', message, details);
  }
}

export class UnprocessableEntityError extends HttpError {
  constructor(message = 'Unprocessable entity', details?: unknown) {
    super(422, 'UNPROCESSABLE_ENTITY', message, details);
  }
}

export class InternalServerError extends HttpError {
  constructor(message = 'Internal server error', details?: unknown) {
    super(500, 'INTERNAL_SERVER_ERROR', message, details);
  }
}

/**
 * Maps known domain errors and system exceptions to standard HTTP error responses.
 */
export function mapErrorToHttpResponse(
  err: unknown,
  requestId?: string,
): { status: number; body: ApiErrorResponse } {
  if (err instanceof HttpError) {
    return {
      status: err.statusCode,
      body: {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
          ...(requestId ? { requestId } : {}),
        },
      },
    };
  }

  const errorName = err instanceof Error ? err.name : '';
  const errorMessage = err instanceof Error ? err.message : String(err);

  // 400 Bad Request
  if (
    errorName === 'InvalidQuantityError' ||
    errorName === 'InvalidOrderQuantityError' ||
    errorName === 'EmptyOrderItemsError' ||
    errorName === 'InvalidStoreContextError' ||
    errorName === 'InvalidProductDataError' ||
    errorName === 'InvalidCategoryDataError' ||
    errorName === 'ZodError'
  ) {
    return {
      status: 400,
      body: {
        error: {
          code: 'BAD_REQUEST',
          message: errorMessage,
          ...(requestId ? { requestId } : {}),
        },
      },
    };
  }

  // 401 Unauthorized
  if (
    errorName === 'UnauthenticatedError' ||
    errorName === 'CustomerSessionError' ||
    errorName === 'SessionExpiredError' ||
    errorName === 'SessionRevokedError' ||
    errorName === 'PaymentSignatureVerificationError'
  ) {
    return {
      status: 401,
      body: {
        error: {
          code: 'UNAUTHORIZED',
          message: errorMessage,
          ...(requestId ? { requestId } : {}),
        },
      },
    };
  }

  // 403 Forbidden
  if (
    errorName === 'AuthorizationError' ||
    errorName === 'PermissionDeniedError' ||
    errorName === 'CustomerOrderAccessDeniedError' ||
    errorName === 'CustomerAccessDeniedError' ||
    errorName === 'ScopeMismatchError' ||
    errorName === 'EntitlementDeniedError' ||
    errorName === 'PaymentCustomerAccessDeniedError' ||
    errorName === 'PaymentStoreMismatchError' ||
    errorName === 'PaymentOrderMismatchError'
  ) {
    return {
      status: 403,
      body: {
        error: {
          code: 'FORBIDDEN',
          message: errorMessage,
          ...(requestId ? { requestId } : {}),
        },
      },
    };
  }

  // 404 Not Found
  if (
    errorName === 'OrderNotFoundError' ||
    errorName === 'OrderItemNotFoundError' ||
    errorName === 'ProductNotFoundError' ||
    errorName === 'CategoryNotFoundError' ||
    errorName === 'CustomerNotFoundError' ||
    errorName === 'InventoryNotFoundError' ||
    errorName === 'StoreNotFoundError' ||
    errorName === 'PaymentNotFoundError' ||
    errorName === 'PaymentIntentNotFoundError' ||
    errorName === 'PaymentAccountNotFoundError'
  ) {
    return {
      status: 404,
      body: {
        error: {
          code: 'NOT_FOUND',
          message: errorMessage,
          ...(requestId ? { requestId } : {}),
        },
      },
    };
  }

  // 409 Conflict / Idempotency
  if (
    errorName === 'IdempotencyConflictError' ||
    errorName === 'OrderCreationConflictError' ||
    errorName === 'UniqueConstraintError' ||
    errorName === 'OrderAlreadyCancelledError' ||
    errorName === 'OrderAlreadyFulfilledError' ||
    errorName === 'PaymentIdempotencyConflictError' ||
    errorName === 'PaymentEventConflictError'
  ) {
    return {
      status: 409,
      body: {
        error: {
          code: 'CONFLICT',
          message: errorMessage,
          ...(requestId ? { requestId } : {}),
        },
      },
    };
  }

  // 422 Unprocessable Entity
  if (
    errorName === 'InsufficientStockError' ||
    errorName === 'ProductUnavailableError' ||
    errorName === 'NegativeStockError' ||
    errorName === 'InvalidOrderStateTransitionError' ||
    errorName === 'CrossTenantInventoryError' ||
    errorName === 'CrossTenantOrderError' ||
    errorName === 'OrderNotPayableError' ||
    errorName === 'PaymentAmountMismatchError' ||
    errorName === 'PaymentCurrencyMismatchError' ||
    errorName === 'RefundAmountExceededError' ||
    errorName === 'RefundUnsupportedError'
  ) {
    return {
      status: 422,
      body: {
        error: {
          code: 'UNPROCESSABLE_ENTITY',
          message: errorMessage,
          ...(requestId ? { requestId } : {}),
        },
      },
    };
  }

  // Generic domain error with statusCode property (e.g. PaymentError)
  if (
    err &&
    typeof err === 'object' &&
    'statusCode' in err &&
    typeof (err as { statusCode: unknown }).statusCode === 'number'
  ) {
    const customStatus = (err as { statusCode: number }).statusCode;
    return {
      status: customStatus,
      body: {
        error: {
          code: (err as { code?: string }).code || 'DOMAIN_ERROR',
          message: errorMessage,
          ...(requestId ? { requestId } : {}),
        },
      },
    };
  }

  // Fallback 500
  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected internal error occurred',
        ...(requestId ? { requestId } : {}),
      },
    },
  };
}

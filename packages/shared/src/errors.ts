/**
 * Base Application Error and standardized domain error primitives.
 */

export class ApplicationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, code = 'INTERNAL_ERROR', statusCode = 500, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(message, 'NOT_FOUND', 404, details);
  }
}

export class ValidationError extends ApplicationError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 'VALIDATION_FAILED', 400, details);
  }
}

export class UnauthorizedError extends ApplicationError {
  constructor(message = 'Authentication required', details?: unknown) {
    super(message, 'UNAUTHORIZED', 401, details);
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message = 'Access forbidden', details?: unknown) {
    super(message, 'FORBIDDEN', 403, details);
  }
}

export class ConflictError extends ApplicationError {
  constructor(message = 'Resource conflict', details?: unknown) {
    super(message, 'CONFLICT', 409, details);
  }
}

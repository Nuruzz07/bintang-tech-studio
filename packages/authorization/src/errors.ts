import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
  ApplicationError,
} from '@bintang/shared';

/**
 * Base domain error for authorization failures.
 */
export class AuthorizationError extends ApplicationError {
  constructor(
    message = 'Authorization failed',
    code = 'AUTHORIZATION_DENIED',
    statusCode = 403,
    details?: unknown,
  ) {
    super(message, code, statusCode, details);
  }
}

/**
 * Thrown when an actor's role lacks the requested permission.
 */
export class PermissionDeniedError extends ForbiddenError {
  public readonly permission?: string | undefined;
  public readonly role?: string | undefined;

  constructor(
    message = 'Permission denied',
    permission?: string | undefined,
    role?: string | undefined,
    details?: unknown,
  ) {
    super(message, details);
    this.permission = permission;
    this.role = role;
  }
}

/**
 * Thrown when a store lacks the required feature entitlement or exceeds a numeric limit.
 */
export class EntitlementDeniedError extends ForbiddenError {
  public readonly entitlementKey?: string | undefined;

  constructor(
    message = 'Store is not entitled to this feature or has exceeded limit',
    entitlementKey?: string | undefined,
    details?: unknown,
  ) {
    super(message, details);
    this.entitlementKey = entitlementKey;
  }
}

/**
 * Thrown when an action is evaluated against a context with mismatched tenant or platform scope.
 */
export class ScopeMismatchError extends ForbiddenError {
  constructor(message = 'Security scope mismatch', details?: unknown) {
    super(message, details);
  }
}

/**
 * Thrown when an unauthenticated request attempts to evaluate authorization.
 */
export class UnauthenticatedError extends UnauthorizedError {
  constructor(message = 'Authentication required for authorization evaluation', details?: unknown) {
    super(message, details);
  }
}

/**
 * Thrown when an authorization context is malformed or invalid.
 */
export class InvalidAuthorizationContextError extends ValidationError {
  constructor(message = 'Invalid authorization context provided', details?: unknown) {
    super(message, details);
  }
}

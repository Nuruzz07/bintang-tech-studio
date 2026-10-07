import {
  ApplicationError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from '@bintang/shared';

/**
 * Base domain error for Tenancy and Store operations.
 */
export class TenancyError extends ApplicationError {
  constructor(
    message = 'Tenancy domain error',
    code = 'TENANCY_ERROR',
    statusCode = 400,
    details?: unknown,
  ) {
    super(message, code, statusCode, details);
  }
}

/**
 * Thrown when an authenticated user attempts to access a store tenant without active membership.
 */
export class TenantAccessDeniedError extends ForbiddenError {
  constructor(
    message = 'Access denied: user has no active membership in target store',
    details?: unknown,
  ) {
    super(message, details);
  }
}

/**
 * Thrown when a requested store does not exist.
 */
export class TenantNotFoundError extends NotFoundError {
  constructor(message = 'Store not found', details?: unknown) {
    super(message, details);
  }
}

/**
 * Thrown when a StoreContext fails validation requirements.
 */
export class InvalidStoreContextError extends ValidationError {
  constructor(message = 'Invalid StoreContext', details?: unknown) {
    super(message, details);
  }
}

/**
 * Thrown when a user has a membership record, but its status is not ACTIVE (INVITED, SUSPENDED, or REMOVED).
 */
export class MembershipInactiveError extends ForbiddenError {
  public readonly membershipStatus?: string | undefined;

  constructor(
    message = 'Store membership is not active',
    status?: string | undefined,
    details?: unknown,
  ) {
    super(message, details);
    this.membershipStatus = status;
  }
}

/**
 * Thrown when an operation violates store owner invariants (e.g., deleting/demoting active owner, direct mutation of owner_user_id).
 */
export class OwnerInvariantViolationError extends ConflictError {
  constructor(message = 'Store owner invariant violated', details?: unknown) {
    super(message, details);
  }
}

/**
 * Thrown when a user attempts to self-elevate their platform role or provide platform_role via untrusted request payload.
 */
export class PlatformRoleElevationError extends ForbiddenError {
  constructor(
    message = 'Self-elevation or unauthorized modification of platform role is forbidden',
    details?: unknown,
  ) {
    super(message, details);
  }
}

/**
 * Thrown when an operation attempts cross-tenant mutation (e.g., altering store_id or cross-tenant moving of records).
 */
export class TenantMutationForbiddenError extends ValidationError {
  constructor(
    message = 'Modifying store_id across tenants is strictly forbidden',
    details?: unknown,
  ) {
    super(message, details);
  }
}

/**
 * Thrown when an invalid role or status value is specified.
 */
export class InvalidRoleError extends ValidationError {
  constructor(message = 'Invalid role specified', details?: unknown) {
    super(message, details);
  }
}

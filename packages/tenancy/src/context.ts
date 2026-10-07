import { StoreRole, STORE_ROLES, PlatformRole, PLATFORM_ROLES } from './types.js';
import { InvalidStoreContextError, InvalidRoleError } from './errors.js';

/**
 * Execution context representing the tenant/store boundary.
 * Every business operation must explicitly run within a valid StoreContext.
 */
export interface StoreContext {
  readonly storeId: string;
  readonly tenantSlug?: string | undefined;
  readonly userId?: string | undefined;
  readonly membershipId?: string | undefined;
  readonly role?: StoreRole | string | undefined;
  readonly correlationId?: string | undefined;
  readonly requestId?: string | undefined;
}

export interface StoreContextInput {
  readonly storeId: string;
  readonly tenantSlug?: string | undefined;
  readonly userId?: string | undefined;
  readonly membershipId?: string | undefined;
  readonly role?: StoreRole | string | undefined;
  readonly correlationId?: string | undefined;
  readonly requestId?: string | undefined;
}

/**
 * Fully authenticated and authorized store context.
 * Guarantees that userId, membershipId, and a valid StoreRole are present.
 */
export interface AuthenticatedStoreContext extends StoreContext {
  readonly userId: string;
  readonly membershipId: string;
  readonly role: StoreRole;
}

export interface AuthenticatedStoreContextInput {
  readonly storeId: string;
  readonly userId: string;
  readonly membershipId: string;
  readonly role: StoreRole;
  readonly tenantSlug?: string | undefined;
  readonly correlationId?: string | undefined;
  readonly requestId?: string | undefined;
}

/**
 * Platform execution context.
 * Represents platform-level administration completely separated from tenant StoreContext.
 */
export interface PlatformContext {
  readonly userId: string;
  readonly platformRole: PlatformRole;
  readonly correlationId?: string | undefined;
  readonly requestId?: string | undefined;
}

export interface PlatformContextInput {
  readonly userId: string;
  readonly platformRole: PlatformRole;
  readonly correlationId?: string | undefined;
  readonly requestId?: string | undefined;
}

/**
 * Validates and instantiates an immutable StoreContext.
 * Guarantees that storeId is valid and non-empty.
 */
export function createStoreContext(input: StoreContextInput): StoreContext {
  const normalizedStoreId = input?.storeId?.trim();
  if (!normalizedStoreId) {
    throw new InvalidStoreContextError('StoreContext requires a non-empty storeId');
  }

  return Object.freeze({
    storeId: normalizedStoreId,
    ...(input.tenantSlug ? { tenantSlug: input.tenantSlug.trim() } : {}),
    ...(input.userId ? { userId: input.userId.trim() } : {}),
    ...(input.membershipId ? { membershipId: input.membershipId.trim() } : {}),
    ...(input.role ? { role: input.role.trim() as StoreRole } : {}),
    ...(input.correlationId ? { correlationId: input.correlationId.trim() } : {}),
    ...(input.requestId ? { requestId: input.requestId.trim() } : {}),
  });
}

/**
 * Validates and instantiates an immutable AuthenticatedStoreContext.
 * Strict contract: storeId, userId, membershipId, and valid StoreRole are strictly required.
 */
export function createAuthenticatedStoreContext(
  input: AuthenticatedStoreContextInput,
): AuthenticatedStoreContext {
  const normalizedStoreId = input?.storeId?.trim();
  if (!normalizedStoreId) {
    throw new InvalidStoreContextError('AuthenticatedStoreContext requires a non-empty storeId');
  }

  const normalizedUserId = input?.userId?.trim();
  if (!normalizedUserId) {
    throw new InvalidStoreContextError('AuthenticatedStoreContext requires a non-empty userId');
  }

  const normalizedMembershipId = input?.membershipId?.trim();
  if (!normalizedMembershipId) {
    throw new InvalidStoreContextError(
      'AuthenticatedStoreContext requires a non-empty membershipId',
    );
  }

  const normalizedRole = input?.role?.trim() as StoreRole;
  if (!normalizedRole || !STORE_ROLES.includes(normalizedRole)) {
    throw new InvalidRoleError(
      `AuthenticatedStoreContext requires a valid store role: ${STORE_ROLES.join(', ')}`,
    );
  }

  return Object.freeze({
    storeId: normalizedStoreId,
    userId: normalizedUserId,
    membershipId: normalizedMembershipId,
    role: normalizedRole,
    ...(input.tenantSlug ? { tenantSlug: input.tenantSlug.trim() } : {}),
    ...(input.correlationId ? { correlationId: input.correlationId.trim() } : {}),
    ...(input.requestId ? { requestId: input.requestId.trim() } : {}),
  });
}

/**
 * Assert that a generic StoreContext contains all attributes of AuthenticatedStoreContext.
 */
export function assertAuthenticatedStoreContext(
  ctx: StoreContext,
): asserts ctx is AuthenticatedStoreContext {
  if (!ctx.userId || !ctx.membershipId || !ctx.role) {
    throw new InvalidStoreContextError(
      'StoreContext is not authenticated: missing userId, membershipId, or role',
    );
  }
  if (!STORE_ROLES.includes(ctx.role as StoreRole)) {
    throw new InvalidRoleError(`StoreContext has invalid store role: ${ctx.role}`);
  }
}

/**
 * Validates and instantiates an immutable PlatformContext.
 * Guarantees that userId and a valid PlatformRole are present.
 */
export function createPlatformContext(input: PlatformContextInput): PlatformContext {
  const normalizedUserId = input?.userId?.trim();
  if (!normalizedUserId) {
    throw new InvalidStoreContextError('PlatformContext requires a non-empty userId');
  }

  const normalizedRole = input?.platformRole?.trim() as PlatformRole;
  if (!normalizedRole || !PLATFORM_ROLES.includes(normalizedRole)) {
    throw new InvalidRoleError(
      `PlatformContext requires a valid platform role: ${PLATFORM_ROLES.join(', ')}`,
    );
  }

  return Object.freeze({
    userId: normalizedUserId,
    platformRole: normalizedRole,
    ...(input.correlationId ? { correlationId: input.correlationId.trim() } : {}),
    ...(input.requestId ? { requestId: input.requestId.trim() } : {}),
  });
}

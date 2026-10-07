import { ValidationError } from '@bintang/shared';

/**
 * Execution context representing the tenant/store boundary.
 * Every business operation must explicitly run within a valid StoreContext.
 */
export interface StoreContext {
  readonly storeId: string;
  readonly tenantSlug?: string;
  readonly userId?: string;
  readonly membershipId?: string;
  readonly role?: string;
  readonly correlationId?: string;
  readonly requestId?: string;
}

export interface StoreContextInput {
  readonly storeId: string;
  readonly tenantSlug?: string;
  readonly userId?: string;
  readonly membershipId?: string;
  readonly role?: string;
  readonly correlationId?: string;
  readonly requestId?: string;
}

/**
 * Validates and instantiates an immutable StoreContext.
 * Guarantees that storeId is valid and non-empty.
 */
export function createStoreContext(input: StoreContextInput): StoreContext {
  const normalizedStoreId = input.storeId?.trim();
  if (!normalizedStoreId) {
    throw new ValidationError('StoreContext requires a non-empty storeId');
  }

  return Object.freeze({
    storeId: normalizedStoreId,
    ...(input.tenantSlug ? { tenantSlug: input.tenantSlug.trim() } : {}),
    ...(input.userId ? { userId: input.userId.trim() } : {}),
    ...(input.membershipId ? { membershipId: input.membershipId.trim() } : {}),
    ...(input.role ? { role: input.role.trim() } : {}),
    ...(input.correlationId ? { correlationId: input.correlationId.trim() } : {}),
    ...(input.requestId ? { requestId: input.requestId.trim() } : {}),
  });
}

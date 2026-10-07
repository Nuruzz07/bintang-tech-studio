import { describe, it, expect, beforeEach } from 'vitest';
import { AuthorizationService } from '../src/authorization-service.js';
import { ScopeMismatchError } from '../src/errors.js';
import { createAuthenticatedStoreContext } from '@bintang/tenancy';

describe('Cross-Tenant Security & Tenant Boundary Matrix', () => {
  let authService: AuthorizationService;

  const storeA = 'store_alpha_uuid';
  const storeB = 'store_beta_uuid';
  const userA = 'user_owner_a';

  beforeEach(() => {
    authService = new AuthorizationService();
  });

  it('User A cannot authorize products.update against Store B even when User A has STORE_OWNER in Store A', async () => {
    const contextUserAStoreA = createAuthenticatedStoreContext({
      storeId: storeA,
      userId: userA,
      membershipId: 'mem_a_store_a',
      role: 'STORE_OWNER',
    });

    // Request targets Store B while authenticated context is Store A
    const decision = await authService.authorizeStoreAction({
      context: contextUserAStoreA,
      targetStoreId: storeB,
      permission: 'products.update',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('DENY_SCOPE_MISMATCH');

    await expect(
      authService.assertAuthorizedStoreAction({
        context: contextUserAStoreA,
        targetStoreId: storeB,
        permission: 'products.update',
      }),
    ).rejects.toThrow(ScopeMismatchError);
  });

  it('Store A permission cannot be used for Store B even if user knows Store B ID', async () => {
    const contextUserAStoreA = createAuthenticatedStoreContext({
      storeId: storeA,
      userId: userA,
      membershipId: 'mem_a_store_a',
      role: 'STORE_OWNER',
    });

    // Even high-privilege operations like staff.invite or store.settings.update are denied across tenants
    const decision = await authService.authorizeStoreAction({
      context: contextUserAStoreA,
      targetStoreId: storeB,
      permission: 'staff.invite',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('DENY_SCOPE_MISMATCH');
  });

  it('guarantees that targetStoreId matching context storeId is accepted', async () => {
    const contextUserAStoreA = createAuthenticatedStoreContext({
      storeId: storeA,
      userId: userA,
      membershipId: 'mem_a_store_a',
      role: 'STORE_OWNER',
    });

    const decision = await authService.authorizeStoreAction({
      context: contextUserAStoreA,
      targetStoreId: storeA,
      permission: 'products.read',
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('ALLOW');
  });

  it('request parameters cannot override the immutable AuthenticatedStoreContext', async () => {
    const staffCtx = createAuthenticatedStoreContext({
      storeId: storeA,
      userId: 'user_staff_1',
      membershipId: 'mem_staff_1',
      role: 'STORE_STAFF',
    });

    // Context is frozen; role cannot be altered by frontend or request
    expect(Object.isFrozen(staffCtx)).toBe(true);

    // Attempting staff.invite with STORE_STAFF context fails regardless of any client assertions
    const decision = await authService.authorizeStoreAction({
      context: staffCtx,
      permission: 'staff.invite',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('DENY_PERMISSION');
  });
});

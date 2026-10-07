import { describe, it, expect, beforeEach } from 'vitest';
import { AuthorizationService } from '../src/authorization-service.js';
import { InMemoryEntitlementResolver } from '../src/entitlements.js';
import {
  UnauthenticatedError,
  InvalidAuthorizationContextError,
  PermissionDeniedError,
} from '../src/errors.js';
import { createAuthenticatedStoreContext } from '@bintang/tenancy';

describe('Store Action Authorization Service', () => {
  let authService: AuthorizationService;
  let entitlementResolver: InMemoryEntitlementResolver;

  const storeId = 'store_alpha';
  const ownerUserId = 'user_owner';
  const staffUserId = 'user_staff';

  beforeEach(() => {
    entitlementResolver = new InMemoryEntitlementResolver();
    authService = new AuthorizationService(entitlementResolver);
  });

  it('denies unauthenticated requests missing context or userId', async () => {
    const resNull = await authService.authorizeStoreAction({
      context: null,
      permission: 'products.read',
    });
    expect(resNull.allowed).toBe(false);
    expect(resNull.reason).toBe('DENY_UNAUTHENTICATED');

    await expect(
      authService.assertAuthorizedStoreAction({
        context: null,
        permission: 'products.read',
      }),
    ).rejects.toThrow(UnauthenticatedError);
  });

  it('denies requests missing storeId in context', async () => {
    const invalidCtx = {
      userId: 'user_1',
      role: 'STORE_OWNER',
      membershipId: 'm_1',
      storeId: '',
    };

    const res = await authService.authorizeStoreAction({
      // @ts-expect-error Testing invalid runtime context
      context: invalidCtx,
      permission: 'products.read',
    });

    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('DENY_NO_STORE_CONTEXT');

    await expect(
      authService.assertAuthorizedStoreAction({
        // @ts-expect-error Testing invalid runtime context
        context: invalidCtx,
        permission: 'products.read',
      }),
    ).rejects.toThrow(InvalidAuthorizationContextError);
  });

  it('authorizes STORE_OWNER to perform full store operations', async () => {
    const ownerCtx = createAuthenticatedStoreContext({
      storeId,
      userId: ownerUserId,
      membershipId: 'mem_owner',
      role: 'STORE_OWNER',
    });

    const resProductCreate = await authService.authorizeStoreAction({
      context: ownerCtx,
      permission: 'products.create',
    });
    expect(resProductCreate.allowed).toBe(true);
    expect(resProductCreate.reason).toBe('ALLOW');

    const resStaffRemove = await authService.authorizeStoreAction({
      context: ownerCtx,
      permission: 'staff.remove',
    });
    expect(resStaffRemove.allowed).toBe(true);

    const resSubscriptionManage = await authService.authorizeStoreAction({
      context: ownerCtx,
      permission: 'subscription.manage',
    });
    expect(resSubscriptionManage.allowed).toBe(true);
  });

  it('authorizes STORE_STAFF for operational tasks but denies high-privilege tasks', async () => {
    const staffCtx = createAuthenticatedStoreContext({
      storeId,
      userId: staffUserId,
      membershipId: 'mem_staff',
      role: 'STORE_STAFF',
    });

    // Operational allowed
    const resOrderRead = await authService.authorizeStoreAction({
      context: staffCtx,
      permission: 'orders.read',
    });
    expect(resOrderRead.allowed).toBe(true);

    const resFulfillmentProcess = await authService.authorizeStoreAction({
      context: staffCtx,
      permission: 'fulfillment.process',
    });
    expect(resFulfillmentProcess.allowed).toBe(true);

    // Administrative denied
    const resProductCreate = await authService.authorizeStoreAction({
      context: staffCtx,
      permission: 'products.create',
    });
    expect(resProductCreate.allowed).toBe(false);
    expect(resProductCreate.reason).toBe('DENY_PERMISSION');

    const resSettingsUpdate = await authService.authorizeStoreAction({
      context: staffCtx,
      permission: 'store.settings.update',
    });
    expect(resSettingsUpdate.allowed).toBe(false);
    expect(resSettingsUpdate.reason).toBe('DENY_PERMISSION');

    await expect(
      authService.assertAuthorizedStoreAction({
        context: staffCtx,
        permission: 'products.create',
      }),
    ).rejects.toThrow(PermissionDeniedError);
  });
});

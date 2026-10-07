import { describe, it, expect, beforeEach } from 'vitest';
import { AuthorizationService } from '../src/authorization-service.js';
import { createPlatformContext, createAuthenticatedStoreContext } from '@bintang/tenancy';
import { PermissionDeniedError, UnauthenticatedError } from '../src/errors.js';

describe('Platform Authorization & Domain Separation', () => {
  let authService: AuthorizationService;

  beforeEach(() => {
    authService = new AuthorizationService();
  });

  it('authorizes PLATFORM_OWNER for root platform administration', async () => {
    const ownerCtx = createPlatformContext({
      userId: 'user_plat_owner',
      platformRole: 'PLATFORM_OWNER',
    });

    const res = await authService.authorizePlatformAction({
      context: ownerCtx,
      permission: 'platform.system.manage',
    });
    expect(res.allowed).toBe(true);
    expect(res.reason).toBe('ALLOW');
  });

  it('authorizes PLATFORM_ADMIN for platform operations but denies root system manage', async () => {
    const adminCtx = createPlatformContext({
      userId: 'user_plat_admin',
      platformRole: 'PLATFORM_ADMIN',
    });

    const resStoresManage = await authService.authorizePlatformAction({
      context: adminCtx,
      permission: 'platform.stores.manage',
    });
    expect(resStoresManage.allowed).toBe(true);

    const resSysManage = await authService.authorizePlatformAction({
      context: adminCtx,
      permission: 'platform.system.manage',
    });
    expect(resSysManage.allowed).toBe(false);
    expect(resSysManage.reason).toBe('DENY_PLATFORM_SCOPE');

    await expect(
      authService.assertAuthorizedPlatformAction({
        context: adminCtx,
        permission: 'platform.system.manage',
      }),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('denies platform operations to standard USER platform role', async () => {
    const userCtx = createPlatformContext({
      userId: 'user_regular',
      platformRole: 'USER',
    });

    const res = await authService.authorizePlatformAction({
      context: userCtx,
      permission: 'platform.stores.read',
    });
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('DENY_PLATFORM_SCOPE');
  });

  it('denies unauthenticated platform evaluation', async () => {
    const res = await authService.authorizePlatformAction({
      context: null,
      permission: 'platform.stores.read',
    });
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('DENY_UNAUTHENTICATED');

    await expect(
      authService.assertAuthorizedPlatformAction({
        context: null,
        permission: 'platform.stores.read',
      }),
    ).rejects.toThrow(UnauthenticatedError);
  });

  it('guarantees that STORE_OWNER does NOT hold platform privileges', () => {
    const storeOwnerCtx = createAuthenticatedStoreContext({
      storeId: 'store_1',
      userId: 'user_1',
      membershipId: 'mem_1',
      role: 'STORE_OWNER',
    });

    // storeOwnerCtx is not a PlatformContext
    expect('platformRole' in storeOwnerCtx).toBe(false);
  });

  it('guarantees that PLATFORM_ADMIN cannot bypass tenant boundary into store operations', async () => {
    const platformCtx = createPlatformContext({
      userId: 'admin_1',
      platformRole: 'PLATFORM_ADMIN',
    });

    // Attempting to evaluate store action with PlatformContext fails (missing storeId / store role)
    const res = await authService.authorizeStoreAction({
      // @ts-expect-error Passing PlatformContext to store action evaluation
      context: platformCtx,
      permission: 'products.read',
    });

    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('DENY_NO_STORE_CONTEXT');
  });
});

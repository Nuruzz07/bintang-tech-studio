import { describe, it, expect } from 'vitest';
import {
  createStoreContext,
  createAuthenticatedStoreContext,
  createPlatformContext,
  assertAuthenticatedStoreContext,
} from '../src/context.js';
import { InvalidStoreContextError, InvalidRoleError } from '../src/errors.js';

describe('StoreContext Contract', () => {
  it('creates an immutable StoreContext with required storeId', () => {
    const ctx = createStoreContext({
      storeId: 'store_123',
      tenantSlug: 'bintang-digital',
      userId: 'user_456',
      role: 'owner',
    });

    expect(ctx.storeId).toBe('store_123');
    expect(ctx.tenantSlug).toBe('bintang-digital');
    expect(ctx.userId).toBe('user_456');
    expect(ctx.role).toBe('owner');
    expect(Object.isFrozen(ctx)).toBe(true);
  });

  it('trims whitespace from context identifiers', () => {
    const ctx = createStoreContext({
      storeId: '  store_abc  ',
      requestId: '  req_xyz  ',
    });

    expect(ctx.storeId).toBe('store_abc');
    expect(ctx.requestId).toBe('req_xyz');
  });

  it('throws InvalidStoreContextError if storeId is missing or empty', () => {
    expect(() => createStoreContext({ storeId: '' })).toThrow(InvalidStoreContextError);
    expect(() => createStoreContext({ storeId: '   ' })).toThrow(InvalidStoreContextError);
    // @ts-expect-error Testing runtime invalid input
    expect(() => createStoreContext({})).toThrow(InvalidStoreContextError);
  });
});

describe('AuthenticatedStoreContext Contract', () => {
  it('creates an immutable AuthenticatedStoreContext with strict requirements', () => {
    const ctx = createAuthenticatedStoreContext({
      storeId: 'store_tenant_01',
      userId: 'user_merchant_01',
      membershipId: 'sm_01',
      role: 'STORE_OWNER',
      tenantSlug: 'alpha-merchant',
      correlationId: 'corr_123',
      requestId: 'req_456',
    });

    expect(ctx.storeId).toBe('store_tenant_01');
    expect(ctx.userId).toBe('user_merchant_01');
    expect(ctx.membershipId).toBe('sm_01');
    expect(ctx.role).toBe('STORE_OWNER');
    expect(ctx.tenantSlug).toBe('alpha-merchant');
    expect(ctx.correlationId).toBe('corr_123');
    expect(ctx.requestId).toBe('req_456');
    expect(Object.isFrozen(ctx)).toBe(true);
  });

  it('rejects creation if storeId, userId, or membershipId are missing', () => {
    expect(() =>
      createAuthenticatedStoreContext({
        storeId: '',
        userId: 'u1',
        membershipId: 'm1',
        role: 'STORE_STAFF',
      }),
    ).toThrow(InvalidStoreContextError);

    expect(() =>
      createAuthenticatedStoreContext({
        storeId: 's1',
        userId: '',
        membershipId: 'm1',
        role: 'STORE_STAFF',
      }),
    ).toThrow(InvalidStoreContextError);

    expect(() =>
      createAuthenticatedStoreContext({
        storeId: 's1',
        userId: 'u1',
        membershipId: '',
        role: 'STORE_STAFF',
      }),
    ).toThrow(InvalidStoreContextError);
  });

  it('rejects invalid store roles', () => {
    expect(() =>
      createAuthenticatedStoreContext({
        storeId: 's1',
        userId: 'u1',
        membershipId: 'm1',
        // @ts-expect-error Testing runtime invalid role
        role: 'SUPERADMIN',
      }),
    ).toThrow(InvalidRoleError);
  });

  it('assertAuthenticatedStoreContext validates unverified context', () => {
    const valid = createStoreContext({
      storeId: 's1',
      userId: 'u1',
      membershipId: 'm1',
      role: 'STORE_ADMIN',
    });

    expect(() => assertAuthenticatedStoreContext(valid)).not.toThrow();

    const missingRole = createStoreContext({
      storeId: 's1',
      userId: 'u1',
    });
    expect(() => assertAuthenticatedStoreContext(missingRole)).toThrow(InvalidStoreContextError);
  });
});

describe('PlatformContext Contract', () => {
  it('creates an immutable PlatformContext for platform administrators', () => {
    const ctx = createPlatformContext({
      userId: 'user_plat_admin',
      platformRole: 'PLATFORM_ADMIN',
      correlationId: 'corr_plat_01',
    });

    expect(ctx.userId).toBe('user_plat_admin');
    expect(ctx.platformRole).toBe('PLATFORM_ADMIN');
    expect(Object.isFrozen(ctx)).toBe(true);
  });

  it('rejects PlatformContext with missing userId or invalid role', () => {
    expect(() =>
      createPlatformContext({
        userId: '',
        platformRole: 'PLATFORM_OWNER',
      }),
    ).toThrow(InvalidStoreContextError);

    expect(() =>
      createPlatformContext({
        userId: 'u1',
        // @ts-expect-error Testing invalid role
        platformRole: 'STORE_OWNER',
      }),
    ).toThrow(InvalidRoleError);
  });

  it('keeps PlatformContext strictly separate from StoreContext', () => {
    const platCtx = createPlatformContext({
      userId: 'user_plat',
      platformRole: 'PLATFORM_OWNER',
    });

    // platCtx has no storeId or store-specific tenancy boundary
    expect('storeId' in platCtx).toBe(false);
  });
});

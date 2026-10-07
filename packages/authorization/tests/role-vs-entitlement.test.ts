import { describe, it, expect, beforeEach } from 'vitest';
import { AuthorizationService } from '../src/authorization-service.js';
import { InMemoryEntitlementResolver, STANDARD_ENTITLEMENT_KEYS } from '../src/entitlements.js';
import { EntitlementDeniedError, PermissionDeniedError } from '../src/errors.js';
import { createAuthenticatedStoreContext } from '@bintang/tenancy';

describe('Role != Permission != Entitlement Matrix', () => {
  let authService: AuthorizationService;
  let entitlementResolver: InMemoryEntitlementResolver;

  const storeId = 'store_matrix_01';
  const ownerUserId = 'user_owner_01';
  const staffUserId = 'user_staff_01';

  beforeEach(() => {
    entitlementResolver = new InMemoryEntitlementResolver();
    authService = new AuthorizationService(entitlementResolver);
  });

  it('STORE_OWNER permission is denied when entitlement is disabled', async () => {
    const ownerCtx = createAuthenticatedStoreContext({
      storeId,
      userId: ownerUserId,
      membershipId: 'mem_owner',
      role: 'STORE_OWNER',
    });

    // Store does NOT have advanced analytics entitlement
    entitlementResolver.setStoreEntitlements(storeId, {
      [STANDARD_ENTITLEMENT_KEYS.FEATURES_ADVANCED_ANALYTICS]: false,
    });

    const decision = await authService.authorizeStoreAction({
      context: ownerCtx,
      permission: 'analytics.read',
      requiredEntitlement: STANDARD_ENTITLEMENT_KEYS.FEATURES_ADVANCED_ANALYTICS,
    });

    // STORE_OWNER has the permission, but the store lacks the entitlement
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('DENY_ENTITLEMENT');

    await expect(
      authService.assertAuthorizedStoreAction({
        context: ownerCtx,
        permission: 'analytics.read',
        requiredEntitlement: STANDARD_ENTITLEMENT_KEYS.FEATURES_ADVANCED_ANALYTICS,
      }),
    ).rejects.toThrow(EntitlementDeniedError);
  });

  it('advanced_analytics entitlement alone does not grant analytics.read to STORE_STAFF', async () => {
    const staffCtx = createAuthenticatedStoreContext({
      storeId,
      userId: staffUserId,
      membershipId: 'mem_staff',
      role: 'STORE_STAFF',
    });

    // Store DOES have advanced analytics enabled
    entitlementResolver.setStoreEntitlements(storeId, {
      [STANDARD_ENTITLEMENT_KEYS.FEATURES_ADVANCED_ANALYTICS]: true,
    });

    const decision = await authService.authorizeStoreAction({
      context: staffCtx,
      permission: 'analytics.read',
      requiredEntitlement: STANDARD_ENTITLEMENT_KEYS.FEATURES_ADVANCED_ANALYTICS,
    });

    // STORE_STAFF does NOT have analytics.read permission; entitlement cannot bypass role policy
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('DENY_PERMISSION');

    await expect(
      authService.assertAuthorizedStoreAction({
        context: staffCtx,
        permission: 'analytics.read',
        requiredEntitlement: STANDARD_ENTITLEMENT_KEYS.FEATURES_ADVANCED_ANALYTICS,
      }),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('authorizes action when both Permission AND Entitlement are satisfied', async () => {
    const ownerCtx = createAuthenticatedStoreContext({
      storeId,
      userId: ownerUserId,
      membershipId: 'mem_owner',
      role: 'STORE_OWNER',
    });

    entitlementResolver.setStoreEntitlements(storeId, {
      [STANDARD_ENTITLEMENT_KEYS.FEATURES_ADVANCED_ANALYTICS]: true,
    });

    const decision = await authService.authorizeStoreAction({
      context: ownerCtx,
      permission: 'analytics.read',
      requiredEntitlement: STANDARD_ENTITLEMENT_KEYS.FEATURES_ADVANCED_ANALYTICS,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('ALLOW');
  });

  it('enforces numeric entitlement limits (products.max) and handles add-on extension', async () => {
    const ownerCtx = createAuthenticatedStoreContext({
      storeId,
      userId: ownerUserId,
      membershipId: 'mem_owner',
      role: 'STORE_OWNER',
    });

    // 1. Initial starter plan with 20 products limit
    entitlementResolver.setStoreConfig(storeId, {
      planSlug: 'starter',
      baseEntitlements: {
        [STANDARD_ENTITLEMENT_KEYS.PRODUCTS_MAX]: 20,
      },
    });

    // Within limit: 15 / 20 -> ALLOW
    const resWithin = await authService.authorizeStoreAction({
      context: ownerCtx,
      permission: 'products.create',
      limitCheck: {
        key: STANDARD_ENTITLEMENT_KEYS.PRODUCTS_MAX,
        currentCount: 15,
      },
    });
    expect(resWithin.allowed).toBe(true);

    // Reached limit: 20 / 20 -> DENY
    const resReached = await authService.authorizeStoreAction({
      context: ownerCtx,
      permission: 'products.create',
      limitCheck: {
        key: STANDARD_ENTITLEMENT_KEYS.PRODUCTS_MAX,
        currentCount: 20,
      },
    });
    expect(resReached.allowed).toBe(false);
    expect(resReached.reason).toBe('DENY_ENTITLEMENT');

    // 2. Merchant purchases Add-on (+50 products) -> new limit = 70
    entitlementResolver.setStoreConfig(storeId, {
      planSlug: 'starter',
      baseEntitlements: {
        [STANDARD_ENTITLEMENT_KEYS.PRODUCTS_MAX]: 20,
      },
      activeAddons: [
        {
          slug: 'addon_extra_50',
          limits: {
            [STANDARD_ENTITLEMENT_KEYS.PRODUCTS_MAX]: 50,
          },
        },
      ],
    });

    // Now 20 / 70 -> ALLOW
    const resAfterAddon = await authService.authorizeStoreAction({
      context: ownerCtx,
      permission: 'products.create',
      limitCheck: {
        key: STANDARD_ENTITLEMENT_KEYS.PRODUCTS_MAX,
        currentCount: 20,
      },
    });
    expect(resAfterAddon.allowed).toBe(true);

    // Reached new limit: 70 / 70 -> DENY
    const resReachedNewLimit = await authService.authorizeStoreAction({
      context: ownerCtx,
      permission: 'products.create',
      limitCheck: {
        key: STANDARD_ENTITLEMENT_KEYS.PRODUCTS_MAX,
        currentCount: 70,
      },
    });
    expect(resReachedNewLimit.allowed).toBe(false);
    expect(resReachedNewLimit.reason).toBe('DENY_ENTITLEMENT');
  });
});

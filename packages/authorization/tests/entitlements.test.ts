import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEntitlementResolver, STANDARD_ENTITLEMENT_KEYS } from '../src/entitlements.js';

describe('Entitlement Foundation & Evaluator', () => {
  let resolver: InMemoryEntitlementResolver;
  const storeId = 'store_test_01';

  beforeEach(() => {
    resolver = new InMemoryEntitlementResolver();
  });

  it('provides default entitlements for unconfigured stores', async () => {
    const effective = await resolver.getEffectiveEntitlements(storeId);

    expect(effective[STANDARD_ENTITLEMENT_KEYS.PRODUCTS_MAX]).toBe(50);
    expect(effective[STANDARD_ENTITLEMENT_KEYS.STAFF_MAX]).toBe(3);
    expect(effective[STANDARD_ENTITLEMENT_KEYS.CHANNELS_TELEGRAM]).toBe(true);
    expect(effective[STANDARD_ENTITLEMENT_KEYS.CHANNELS_WHATSAPP]).toBe(false);
    expect(effective[STANDARD_ENTITLEMENT_KEYS.FEATURES_ADVANCED_ANALYTICS]).toBe(false);

    expect(await resolver.hasFeature(storeId, STANDARD_ENTITLEMENT_KEYS.CHANNELS_WHATSAPP)).toBe(
      false,
    );
    expect(await resolver.getLimit(storeId, STANDARD_ENTITLEMENT_KEYS.PRODUCTS_MAX)).toBe(50);
  });

  it('evaluates Base Plan + Add-on extensions additively for numeric limits', async () => {
    resolver.setStoreConfig(storeId, {
      planSlug: 'starter',
      baseEntitlements: {
        [STANDARD_ENTITLEMENT_KEYS.PRODUCTS_MAX]: 20,
        [STANDARD_ENTITLEMENT_KEYS.STAFF_MAX]: 1,
        [STANDARD_ENTITLEMENT_KEYS.CHANNELS_WHATSAPP]: false,
      },
      activeAddons: [
        {
          slug: 'addon_extra_products_50',
          limits: {
            [STANDARD_ENTITLEMENT_KEYS.PRODUCTS_MAX]: 50,
          },
        },
        {
          slug: 'addon_extra_staff_2',
          limits: {
            [STANDARD_ENTITLEMENT_KEYS.STAFF_MAX]: 2,
          },
        },
      ],
    });

    const effective = await resolver.getEffectiveEntitlements(storeId);
    expect(effective[STANDARD_ENTITLEMENT_KEYS.PRODUCTS_MAX]).toBe(70); // 20 + 50
    expect(effective[STANDARD_ENTITLEMENT_KEYS.STAFF_MAX]).toBe(3); // 1 + 2

    expect(await resolver.getLimit(storeId, STANDARD_ENTITLEMENT_KEYS.PRODUCTS_MAX)).toBe(70);
  });

  it('evaluates Base Plan + Add-on extensions for boolean features', async () => {
    resolver.setStoreConfig(storeId, {
      planSlug: 'starter',
      baseEntitlements: {
        [STANDARD_ENTITLEMENT_KEYS.CHANNELS_WHATSAPP]: false,
        [STANDARD_ENTITLEMENT_KEYS.FEATURES_ADVANCED_ANALYTICS]: false,
      },
      activeAddons: [
        {
          slug: 'addon_whatsapp_integration',
          features: {
            [STANDARD_ENTITLEMENT_KEYS.CHANNELS_WHATSAPP]: true,
          },
        },
      ],
    });

    // WhatsApp is enabled via add-on
    expect(await resolver.hasFeature(storeId, STANDARD_ENTITLEMENT_KEYS.CHANNELS_WHATSAPP)).toBe(
      true,
    );

    // Advanced analytics remains disabled
    expect(
      await resolver.hasFeature(storeId, STANDARD_ENTITLEMENT_KEYS.FEATURES_ADVANCED_ANALYTICS),
    ).toBe(false);
  });
});

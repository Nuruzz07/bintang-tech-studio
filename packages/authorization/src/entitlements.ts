/**
 * Bintang Tech Studio — Entitlement Foundation.
 * Baseline: Master Blueprint v3.0 / Milestone M04.
 *
 * Effective Entitlements Formula:
 * Plan + Subscription State + Add-ons + Store State + Feature Policy = Effective Entitlements
 */

export type EntitlementKey = string;
export type EntitlementValue = boolean | number;
export type EffectiveEntitlements = Record<EntitlementKey, EntitlementValue>;

/**
 * Known canonical entitlement keys.
 */
export const STANDARD_ENTITLEMENT_KEYS = {
  // Numeric Limits
  PRODUCTS_MAX: 'products.max',
  STAFF_MAX: 'staff.max',

  // Channels
  CHANNELS_TELEGRAM: 'channels.telegram',
  CHANNELS_WHATSAPP: 'channels.whatsapp',

  // Features
  FEATURES_BROADCAST: 'features.broadcast',
  FEATURES_VOUCHER: 'features.voucher',
  FEATURES_ADVANCED_ANALYTICS: 'features.advanced_analytics',
} as const;

export interface AddonOverride {
  readonly slug: string;
  readonly limits?: Record<string, number> | undefined;
  readonly features?: Record<string, boolean> | undefined;
}

export interface StoreEntitlementConfig {
  readonly planSlug: string;
  readonly baseEntitlements: EffectiveEntitlements;
  readonly activeAddons?: AddonOverride[] | undefined;
}

/**
 * Boundary interface for resolving effective entitlements of a store tenant.
 */
export interface EntitlementResolver {
  getEffectiveEntitlements(storeId: string): Promise<EffectiveEntitlements>;
  hasFeature(storeId: string, featureKey: string): Promise<boolean>;
  getLimit(storeId: string, limitKey: string): Promise<number>;
}

/**
 * In-memory Entitlement Resolver for testing and domain foundation.
 */
export class InMemoryEntitlementResolver implements EntitlementResolver {
  private readonly storeConfigs = new Map<string, StoreEntitlementConfig>();
  private readonly defaultEntitlements: EffectiveEntitlements = {
    [STANDARD_ENTITLEMENT_KEYS.PRODUCTS_MAX]: 50,
    [STANDARD_ENTITLEMENT_KEYS.STAFF_MAX]: 3,
    [STANDARD_ENTITLEMENT_KEYS.CHANNELS_TELEGRAM]: true,
    [STANDARD_ENTITLEMENT_KEYS.CHANNELS_WHATSAPP]: false,
    [STANDARD_ENTITLEMENT_KEYS.FEATURES_BROADCAST]: false,
    [STANDARD_ENTITLEMENT_KEYS.FEATURES_VOUCHER]: true,
    [STANDARD_ENTITLEMENT_KEYS.FEATURES_ADVANCED_ANALYTICS]: false,
  };

  /**
   * Sets custom entitlement configuration for a specific store.
   */
  setStoreConfig(storeId: string, config: StoreEntitlementConfig): void {
    this.storeConfigs.set(storeId, config);
  }

  /**
   * Directly assigns raw effective entitlements for a store (useful for direct testing).
   */
  setStoreEntitlements(storeId: string, entitlements: EffectiveEntitlements): void {
    this.storeConfigs.set(storeId, {
      planSlug: 'custom',
      baseEntitlements: entitlements,
    });
  }

  /**
   * Calculates effective entitlements by merging Base Plan + Add-on extensions.
   */
  async getEffectiveEntitlements(storeId: string): Promise<EffectiveEntitlements> {
    const config = this.storeConfigs.get(storeId);
    if (!config) {
      return { ...this.defaultEntitlements };
    }

    const effective: EffectiveEntitlements = { ...config.baseEntitlements };

    // Apply add-on overrides if present
    if (config.activeAddons && config.activeAddons.length > 0) {
      for (const addon of config.activeAddons) {
        // Numeric limits combine additively
        if (addon.limits) {
          for (const [key, limitBonus] of Object.entries(addon.limits)) {
            const current = typeof effective[key] === 'number' ? (effective[key] as number) : 0;
            effective[key] = current + limitBonus;
          }
        }

        // Boolean features combine via logical OR
        if (addon.features) {
          for (const [key, enabled] of Object.entries(addon.features)) {
            const current = Boolean(effective[key]);
            effective[key] = current || enabled;
          }
        }
      }
    }

    return effective;
  }

  /**
   * Checks if a boolean feature is enabled for the store.
   */
  async hasFeature(storeId: string, featureKey: string): Promise<boolean> {
    const entitlements = await this.getEffectiveEntitlements(storeId);
    return Boolean(entitlements[featureKey]);
  }

  /**
   * Retrieves a numeric limit for the store (e.g. products.max).
   * Returns Infinity if not bounded, or 0 if explicitly not allowed.
   */
  async getLimit(storeId: string, limitKey: string): Promise<number> {
    const entitlements = await this.getEffectiveEntitlements(storeId);
    const val = entitlements[limitKey];
    if (typeof val === 'number') {
      return val;
    }
    return 0;
  }

  clear(): void {
    this.storeConfigs.clear();
  }
}

/**
 * Bintang Tech Studio — Billing-Aware Entitlement Resolver.
 * Baseline: Milestone M13 Billing + Customer Onboarding Foundation.
 *
 * Entitlements derive strictly from:
 * Plan + Subscription Status + Store Addons + Platform Policy.
 *
 * Implements critical invariants:
 * 1. Downgrade safety: Downgrades restrict future creation without deleting or archiving existing data.
 * 2. Suspension safety: Suspensions restrict operations while preserving 100% of historical data.
 */

import { Plan, Subscription, StoreAddon } from './types.js';
import { STANDARD_ENTITLEMENT_KEYS } from '@bintang/authorization';

export interface EffectiveStoreEntitlements {
  readonly planSlug: string;
  readonly subscriptionStatus: string;
  readonly maxProducts: number;
  readonly maxStaff: number;
  readonly telegramAllowed: boolean;
  readonly whatsappAllowed: boolean;
  readonly vouchersAllowed: boolean;
  readonly broadcastAllowed: boolean;
  readonly advancedAnalyticsAllowed: boolean;
  readonly isOperationallyRestricted: boolean;
  readonly rawEntitlements: Readonly<Record<string, unknown>>;
  canCreateProduct(currentProductCount: number): boolean;
  canAddStaff(currentStaffCount: number): boolean;
}

export function resolveEffectiveStoreEntitlements(params: {
  plan: Plan;
  subscription?: Subscription | null;
  activeAddons?: readonly StoreAddon[];
}): EffectiveStoreEntitlements {
  const { plan, subscription, activeAddons = [] } = params;

  const isSubscriptionActive =
    subscription?.status === 'ACTIVE' || subscription?.status === 'TRIAL';
  const isSuspended =
    subscription?.status === 'SUSPENDED' ||
    subscription?.status === 'CANCELLED' ||
    subscription?.status === 'EXPIRED';

  // Base plan quotas
  let maxProducts = plan.maxProducts;
  let maxStaff = (plan.features['staffMax'] as number) || 3;
  const telegramAllowed = Boolean(plan.features['telegram']);
  let whatsappAllowed = Boolean(plan.features['whatsapp']);
  const vouchersAllowed = Boolean(plan.features['vouchers']);
  const broadcastAllowed = Boolean(plan.features['broadcast']);
  let advancedAnalyticsAllowed = plan.features['analytics'] === 'advanced';

  // Apply active add-ons
  for (const addon of activeAddons) {
    if (addon.status === 'ACTIVE') {
      const config = addon.configuration as Record<string, unknown>;
      if (typeof config['extraProducts'] === 'number') {
        maxProducts += config['extraProducts'];
      }
      if (typeof config['extraStaff'] === 'number') {
        maxStaff += config['extraStaff'];
      }
      if (config['whatsapp'] === true) {
        whatsappAllowed = true;
      }
      if (config['advancedAnalytics'] === true) {
        advancedAnalyticsAllowed = true;
      }
    }
  }

  // If subscription is suspended or expired, operational creation is restricted
  const isOperationallyRestricted = !isSubscriptionActive || isSuspended;

  const rawEntitlements: Record<string, unknown> = {
    [STANDARD_ENTITLEMENT_KEYS.PRODUCTS_MAX]: maxProducts,
    [STANDARD_ENTITLEMENT_KEYS.STAFF_MAX]: maxStaff,
    [STANDARD_ENTITLEMENT_KEYS.CHANNELS_TELEGRAM]: telegramAllowed,
    [STANDARD_ENTITLEMENT_KEYS.CHANNELS_WHATSAPP]: whatsappAllowed,
    [STANDARD_ENTITLEMENT_KEYS.FEATURES_VOUCHER]: vouchersAllowed,
    [STANDARD_ENTITLEMENT_KEYS.FEATURES_ADVANCED_ANALYTICS]: advancedAnalyticsAllowed,
    'broadcast.enabled': broadcastAllowed,
    'subscription.status': subscription?.status || 'NONE',
  };

  return {
    planSlug: plan.slug,
    subscriptionStatus: subscription?.status || 'NONE',
    maxProducts,
    maxStaff,
    telegramAllowed,
    whatsappAllowed,
    vouchersAllowed,
    broadcastAllowed,
    advancedAnalyticsAllowed,
    isOperationallyRestricted,
    rawEntitlements,

    canCreateProduct(currentProductCount: number): boolean {
      if (isOperationallyRestricted) return false;
      return currentProductCount < maxProducts;
    },

    canAddStaff(currentStaffCount: number): boolean {
      if (isOperationallyRestricted) return false;
      return currentStaffCount < maxStaff;
    },
  };
}

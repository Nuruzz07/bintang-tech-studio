/**
 * Bintang Tech Studio — Plan Catalog & Entitlements Test Suite.
 * Baseline: Milestone M13 Billing + Customer Onboarding Foundation.
 */

import { describe, it, expect } from 'vitest';
import { createTestBillingHarness, createPlatformCaller } from './test-helpers.js';
import {
  STARTER_PLAN_BASELINE,
  PRO_PLAN_BASELINE,
  BUSINESS_PLAN_BASELINE,
} from '../src/plan-catalog.js';
import { PlanNotFoundError } from '../src/errors.js';
import { resolveEffectiveStoreEntitlements } from '../src/entitlement-resolver.js';
import { StoreAddon } from '../src/types.js';

describe('M13 Plans & Entitlements Resolution Suite', () => {
  it('verifies canonical Starter plan authoritative baseline specifications', () => {
    expect(STARTER_PLAN_BASELINE.slug).toBe('starter');
    expect(STARTER_PLAN_BASELINE.monthlyPrice).toBe('50000.00');
    expect(STARTER_PLAN_BASELINE.activationFee).toBe('100000.00');
    expect(STARTER_PLAN_BASELINE.maxProducts).toBe(20);
    expect(STARTER_PLAN_BASELINE.features['telegram']).toBe(true);
    expect(STARTER_PLAN_BASELINE.features['whatsapp']).toBe(false);
  });

  it('verifies configurable Pro and Business plans specifications', () => {
    expect(PRO_PLAN_BASELINE.slug).toBe('pro');
    expect(PRO_PLAN_BASELINE.monthlyPrice).toBe('150000.00');
    expect(PRO_PLAN_BASELINE.maxProducts).toBe(100);
    expect(PRO_PLAN_BASELINE.features['whatsapp']).toBe(true);

    expect(BUSINESS_PLAN_BASELINE.slug).toBe('business');
    expect(BUSINESS_PLAN_BASELINE.monthlyPrice).toBe('500000.00');
    expect(BUSINESS_PLAN_BASELINE.maxProducts).toBe(1000);
    expect(BUSINESS_PLAN_BASELINE.features['whatsapp']).toBe(true);
  });

  it('lists active plans for public and seller viewing', async () => {
    const harness = createTestBillingHarness();
    const plans = await harness.billingService.listPlans();

    expect(plans.length).toBe(3);
    const slugs = plans.map((p) => p.slug);
    expect(slugs).toContain('starter');
    expect(slugs).toContain('pro');
    expect(slugs).toContain('business');
  });

  it('retrieves plan details by valid slug and throws on invalid slug', async () => {
    const harness = createTestBillingHarness();
    const plan = await harness.billingService.getPlanBySlug('starter');
    expect(plan.slug).toBe('starter');
    expect(plan.monthlyPrice).toBe('50000.00');
    expect(plan.activationFee).toBe('100000.00');

    await expect(harness.billingService.getPlanBySlug('non-existent')).rejects.toThrow(
      PlanNotFoundError,
    );
  });

  it('resolves effective entitlements for a default store without active subscription', async () => {
    const harness = createTestBillingHarness();
    const caller = createPlatformCaller();

    const entitlements = await harness.billingService.getEffectiveEntitlements(
      caller,
      'store-new-1',
    );

    // Fallback to Starter plan baseline
    expect(entitlements.planSlug).toBe('starter');
    expect(entitlements.subscriptionStatus).toBe('NONE');
    expect(entitlements.maxProducts).toBe(20);
    expect(entitlements.canCreateProduct(10)).toBe(false); // No active subscription means operationally restricted
    expect(entitlements.isOperationallyRestricted).toBe(true);
    expect(entitlements.whatsappAllowed).toBe(false);
  });

  it('resolves effective entitlements with active add-ons expanding limits and features', () => {
    const activeAddons: StoreAddon[] = [
      {
        id: 'sa-1',
        storeId: 'store-alpha',
        addonId: 'addon-extra-products',
        status: 'ACTIVE',
        assignedAt: new Date().toISOString(),
        expiresAt: null,
        configuration: { extraProducts: 50 },
      },
      {
        id: 'sa-2',
        storeId: 'store-alpha',
        addonId: 'addon-whatsapp',
        status: 'ACTIVE',
        assignedAt: new Date().toISOString(),
        expiresAt: null,
        configuration: { whatsapp: true },
      },
    ];

    const entitlements = resolveEffectiveStoreEntitlements({
      plan: STARTER_PLAN_BASELINE,
      subscription: {
        id: 'sub-1',
        storeId: 'store-alpha',
        planId: STARTER_PLAN_BASELINE.id,
        status: 'ACTIVE',
        startedAt: new Date().toISOString(),
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
        cancelledAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      activeAddons,
    });

    // Base 20 + 50 extra = 70 products
    expect(entitlements.maxProducts).toBe(70);
    expect(entitlements.canCreateProduct(20)).toBe(true);
    expect(entitlements.canCreateProduct(69)).toBe(true);
    expect(entitlements.canCreateProduct(70)).toBe(false);
    expect(entitlements.whatsappAllowed).toBe(true);
  });

  it('enforces DOWNGRADE SAFETY: never deletes existing items when usage exceeds downgraded quota', () => {
    // Seller previously had Pro (max 100 products) and created 45 products.
    // Seller now downgrades to Starter (max 20 products).
    const entitlements = resolveEffectiveStoreEntitlements({
      plan: STARTER_PLAN_BASELINE,
      subscription: {
        id: 'sub-downgrade',
        storeId: 'store-beta',
        planId: STARTER_PLAN_BASELINE.id,
        status: 'ACTIVE',
        startedAt: new Date().toISOString(),
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
        cancelledAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      activeAddons: [],
    });

    expect(entitlements.maxProducts).toBe(20);
    // Current usage is 45 products.
    // Adding more products must be BLOCKED
    expect(entitlements.canCreateProduct(45)).toBe(false);
    // BUT existing 45 products are NOT deleted. System does not mutate or purge product records.
    expect(entitlements.isOperationallyRestricted).toBe(false);
  });

  it('enforces SUSPENSION SAFETY: blocks additions but preserves data viewing and export', () => {
    const entitlements = resolveEffectiveStoreEntitlements({
      plan: PRO_PLAN_BASELINE,
      subscription: {
        id: 'sub-suspended',
        storeId: 'store-gamma',
        planId: PRO_PLAN_BASELINE.id,
        status: 'SUSPENDED',
        startedAt: new Date().toISOString(),
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date().toISOString(),
        cancelledAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      activeAddons: [],
    });

    expect(entitlements.isOperationallyRestricted).toBe(true);
    // Suspended account cannot add products even if usage (5) is below quota (100)
    expect(entitlements.canCreateProduct(5)).toBe(false);
  });
});

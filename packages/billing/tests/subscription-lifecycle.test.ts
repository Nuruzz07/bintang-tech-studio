/**
 * Bintang Tech Studio — Subscription Lifecycle Test Suite.
 * Baseline: Milestone M13 Billing + Customer Onboarding Foundation.
 */

import { describe, it, expect } from 'vitest';
import { createTestBillingHarness, createSellerCaller } from './test-helpers.js';
import { validateSubscriptionStateTransition } from '../src/validation.js';
import { SubscriptionStateTransitionError, SubscriptionCancelledError } from '../src/errors.js';

describe('M13 Subscription Lifecycle & State Machine Suite', () => {
  describe('Subscription State Machine Transitions', () => {
    it('allows valid progressive transitions according to M13 specification', () => {
      // TRIAL progressions
      expect(() => validateSubscriptionStateTransition('TRIAL', 'ACTIVE')).not.toThrow();
      expect(() => validateSubscriptionStateTransition('TRIAL', 'CANCELLED')).not.toThrow();
      expect(() => validateSubscriptionStateTransition('TRIAL', 'EXPIRED')).not.toThrow();
      expect(() => validateSubscriptionStateTransition('TRIAL', 'TRIAL')).not.toThrow();

      // ACTIVE progressions
      expect(() => validateSubscriptionStateTransition('ACTIVE', 'PAST_DUE')).not.toThrow();
      expect(() => validateSubscriptionStateTransition('ACTIVE', 'SUSPENDED')).not.toThrow();
      expect(() => validateSubscriptionStateTransition('ACTIVE', 'CANCELLED')).not.toThrow();
      expect(() => validateSubscriptionStateTransition('ACTIVE', 'EXPIRED')).not.toThrow();
      expect(() => validateSubscriptionStateTransition('ACTIVE', 'ACTIVE')).not.toThrow();

      // PAST_DUE progressions
      expect(() => validateSubscriptionStateTransition('PAST_DUE', 'ACTIVE')).not.toThrow();
      expect(() => validateSubscriptionStateTransition('PAST_DUE', 'SUSPENDED')).not.toThrow();
      expect(() => validateSubscriptionStateTransition('PAST_DUE', 'CANCELLED')).not.toThrow();
      expect(() => validateSubscriptionStateTransition('PAST_DUE', 'EXPIRED')).not.toThrow();

      // SUSPENDED progressions
      expect(() => validateSubscriptionStateTransition('SUSPENDED', 'ACTIVE')).not.toThrow();
      expect(() => validateSubscriptionStateTransition('SUSPENDED', 'CANCELLED')).not.toThrow();
      expect(() => validateSubscriptionStateTransition('SUSPENDED', 'EXPIRED')).not.toThrow();
    });

    it('STRICTLY rejects transitions out of terminal CANCELLED state', () => {
      expect(() => validateSubscriptionStateTransition('CANCELLED', 'ACTIVE')).toThrow(
        SubscriptionStateTransitionError,
      );
      expect(() => validateSubscriptionStateTransition('CANCELLED', 'PAST_DUE')).toThrow(
        SubscriptionStateTransitionError,
      );
      expect(() => validateSubscriptionStateTransition('CANCELLED', 'TRIAL')).toThrow(
        SubscriptionStateTransitionError,
      );
    });

    it('STRICTLY rejects transitions out of terminal EXPIRED state', () => {
      expect(() => validateSubscriptionStateTransition('EXPIRED', 'ACTIVE')).toThrow(
        SubscriptionStateTransitionError,
      );
      expect(() => validateSubscriptionStateTransition('EXPIRED', 'TRIAL')).toThrow(
        SubscriptionStateTransitionError,
      );
    });

    it('STRICTLY rejects invalid skip-transitions like TRIAL directly to PAST_DUE', () => {
      expect(() => validateSubscriptionStateTransition('TRIAL', 'PAST_DUE')).toThrow(
        SubscriptionStateTransitionError,
      );
      expect(() => validateSubscriptionStateTransition('TRIAL', 'SUSPENDED')).toThrow(
        SubscriptionStateTransitionError,
      );
    });
  });

  describe('Subscription Service Operations', () => {
    it('creates a new subscription for a store and issues the initial invoice', async () => {
      const harness = createTestBillingHarness();
      const caller = createSellerCaller('seller-1', 'store-1');

      const subscription = await harness.billingService.createSubscription(caller, {
        storeId: 'store-1',
        planSlug: 'starter',
      });

      const initialInvoice = await harness.billingService.generateInvoice(caller, {
        storeId: 'store-1',
        subscriptionId: subscription.id,
      });

      expect(subscription.id).toBeDefined();
      expect(subscription.storeId).toBe('store-1');
      expect(subscription.status).toBe('TRIAL');
      expect(initialInvoice.storeId).toBe('store-1');
      expect(initialInvoice.status).toBe('PENDING');
      // Starter plan: 50.000 + 100.000 setup fee = 150.000 IDR
      expect(initialInvoice.total).toBe('150000.00');
    });

    it('prevents duplicate active subscriptions for the same store', async () => {
      const harness = createTestBillingHarness();
      const caller = createSellerCaller('seller-1', 'store-1');

      await harness.billingService.createSubscription(caller, {
        storeId: 'store-1',
        planSlug: 'starter',
      });

      // Attempting to create another subscription for the same store
      await expect(
        harness.billingService.createSubscription(caller, {
          storeId: 'store-1',
          planSlug: 'pro',
        }),
      ).rejects.toThrow(/sudah memiliki langganan aktif/);
    });

    it('cancels subscription immediately with explicit flag', async () => {
      const harness = createTestBillingHarness();
      const caller = createSellerCaller('seller-1', 'store-1');

      const subscription = await harness.billingService.createSubscription(caller, {
        storeId: 'store-1',
        planSlug: 'starter',
      });

      const cancelled = await harness.billingService.cancelSubscription(caller, subscription.id, {
        immediate: true,
        reason: 'Seller request',
      });

      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancelAtPeriodEnd).toBe(false);

      // Re-cancelling a cancelled subscription throws SubscriptionCancelledError
      await expect(
        harness.billingService.cancelSubscription(caller, subscription.id),
      ).rejects.toThrow(SubscriptionCancelledError);
    });

    it('schedules cancellation at end of period when immediate=false', async () => {
      const harness = createTestBillingHarness();
      const caller = createSellerCaller('seller-1', 'store-1');

      const subscription = await harness.billingService.createSubscription(caller, {
        storeId: 'store-1',
        planSlug: 'starter',
      });

      const updated = await harness.billingService.cancelSubscription(caller, subscription.id, {
        immediate: false,
      });

      // Still in current status, but flagged for end of period
      expect(updated.status).toBe('TRIAL');
      expect(updated.cancelAtPeriodEnd).toBe(true);
    });

    it('switches plan on existing subscription', async () => {
      const harness = createTestBillingHarness();
      const caller = createSellerCaller('seller-1', 'store-1');

      const subscription = await harness.billingService.createSubscription(caller, {
        storeId: 'store-1',
        planSlug: 'starter',
      });

      const upgraded = await harness.billingService.changeSubscriptionPlan(
        caller,
        subscription.id,
        'pro',
      );

      const proPlan = await harness.billingService.getPlanBySlug('pro');
      expect(upgraded.planId).toBe(proPlan.id);
    });
  });
});

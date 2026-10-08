/**
 * Bintang Tech Studio — Customer Onboarding Workflow & Session Test Suite.
 * Baseline: Milestone M13 Billing + Customer Onboarding Foundation.
 */

import { describe, it, expect } from 'vitest';
import { createTestBillingHarness } from './test-helpers.js';
import { OnboardingError, OnboardingStateTransitionError } from '../src/errors.js';
import { validateOnboardingStateTransition } from '../src/validation.js';

describe('M13 Customer Onboarding Workflow Suite', () => {
  describe('Onboarding State Machine Transitions', () => {
    it('allows valid progressive transitions throughout the 9-stage onboarding lifecycle', () => {
      expect(() =>
        validateOnboardingStateTransition('NOT_STARTED', 'ACCOUNT_CREATED'),
      ).not.toThrow();
      expect(() =>
        validateOnboardingStateTransition('ACCOUNT_CREATED', 'PLAN_SELECTED'),
      ).not.toThrow();
      expect(() =>
        validateOnboardingStateTransition('PLAN_SELECTED', 'PAYMENT_PENDING'),
      ).not.toThrow();
      expect(() =>
        validateOnboardingStateTransition('PAYMENT_PENDING', 'PAYMENT_CONFIRMED'),
      ).not.toThrow();
      expect(() =>
        validateOnboardingStateTransition('PAYMENT_CONFIRMED', 'PROVISIONING'),
      ).not.toThrow();
      expect(() => validateOnboardingStateTransition('PROVISIONING', 'STORE_READY')).not.toThrow();
      expect(() => validateOnboardingStateTransition('STORE_READY', 'CONFIGURATION')).not.toThrow();
      expect(() => validateOnboardingStateTransition('CONFIGURATION', 'COMPLETED')).not.toThrow();
      expect(() => validateOnboardingStateTransition('STORE_READY', 'COMPLETED')).not.toThrow();
    });

    it('STRICTLY rejects skipping mandatory onboarding stages', () => {
      expect(() => validateOnboardingStateTransition('NOT_STARTED', 'STORE_READY')).toThrow(
        OnboardingStateTransitionError,
      );
      expect(() => validateOnboardingStateTransition('ACCOUNT_CREATED', 'COMPLETED')).toThrow(
        OnboardingStateTransitionError,
      );
      expect(() => validateOnboardingStateTransition('COMPLETED', 'PLAN_SELECTED')).toThrow(
        OnboardingStateTransitionError,
      );
    });
  });

  describe('End-to-End Onboarding Service Journey', () => {
    it('executes a complete customer onboarding journey from account creation to completion', async () => {
      const harness = createTestBillingHarness();
      const userId = 'merchant-user-77';

      // 1. Get or create session
      const session = await harness.onboardingService.getOrCreateSession(userId);
      expect(session.userId).toBe(userId);
      expect(session.status).toBe('ACCOUNT_CREATED');
      expect(session.checklist.accountCreated).toBe(true);
      expect(session.checklist.planSelected).toBe(false);

      // 2. Select plan
      const withPlan = await harness.onboardingService.selectPlan(userId, {
        planSlug: 'starter',
        storeName: 'Kios Bintang',
        storeSlug: 'kios-bintang',
      });
      expect(withPlan.status).toBe('PLAN_SELECTED');
      expect(withPlan.selectedPlanSlug).toBe('starter');
      expect(withPlan.checklist.planSelected).toBe(true);

      // 3. Initiate payment
      const paymentInitiation = await harness.onboardingService.initiatePayment(userId);
      expect(paymentInitiation.session.status).toBe('PAYMENT_PENDING');
      expect(paymentInitiation.session.invoiceId).toBeDefined();
      expect(paymentInitiation.session.billingPaymentId).toBeDefined();
      expect(paymentInitiation.paymentUrl).toBeDefined();

      // Verify invoice total includes starter monthly + one-time activation fee (150.000 IDR)
      const invoice = await harness.invoiceRepo.findById(paymentInitiation.invoiceId);
      expect(invoice?.total).toBe('150000.00');

      // 4. Confirm payment & trigger provisioning
      const provisionedSession = await harness.onboardingService.confirmPaymentAndProvision(userId);
      expect(provisionedSession.status).toBe('STORE_READY');
      expect(provisionedSession.storeId).toBeDefined();
      expect(provisionedSession.checklist.paymentConfirmed).toBe(true);
      expect(provisionedSession.checklist.storeProvisioned).toBe(true);
      expect(provisionedSession.checklist.templateApplied).toBe(true);

      // Verify store exists in tenancy store repository
      const store = await harness.storeRepo.findById(provisionedSession.storeId!);
      expect(store).not.toBeNull();
      expect(store?.name).toBe('Kios Bintang');
      expect(store?.ownerUserId).toBe(userId);

      // Verify STORE_OWNER membership
      const members = await harness.storeMemberRepo.findByStoreId(provisionedSession.storeId!);
      expect(members.length).toBe(1);
      expect(members[0].userId).toBe(userId);
      expect(members[0].role).toBe('STORE_OWNER');

      // 5. Update configuration checklist steps
      const configuredSession = await harness.onboardingService.updateChecklistStep(
        userId,
        'firstProductConfigured',
        true,
      );
      expect(configuredSession.status).toBe('CONFIGURATION');
      expect(configuredSession.checklist.firstProductConfigured).toBe(true);

      // 6. Complete onboarding
      const completedSession = await harness.onboardingService.completeOnboarding(userId);
      expect(completedSession.status).toBe('COMPLETED');
    });

    it('rejects initiating payment if no plan has been selected', async () => {
      const harness = createTestBillingHarness();
      const userId = 'unplanned-user';

      await harness.onboardingService.getOrCreateSession(userId);

      await expect(harness.onboardingService.initiatePayment(userId)).rejects.toThrow(
        OnboardingError,
      );
    });

    it('rejects completing onboarding if store has not been provisioned', async () => {
      const harness = createTestBillingHarness();
      const userId = 'unprovisioned-user';

      await harness.onboardingService.getOrCreateSession(userId);

      await expect(harness.onboardingService.completeOnboarding(userId)).rejects.toThrow(
        OnboardingError,
      );
    });
  });
});

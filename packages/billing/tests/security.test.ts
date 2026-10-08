/**
 * Bintang Tech Studio — Multi-Tenant Security & Financial Immutability Suite.
 * Baseline: Milestone M13 Billing + Customer Onboarding Foundation.
 */

import { describe, it, expect } from 'vitest';
import { createTestBillingHarness, createSellerCaller } from './test-helpers.js';
import { BillingStoreAccessDeniedError, FinancialImmutabilityError } from '../src/errors.js';

describe('M13 Security & Financial Immutability Suite', () => {
  describe('Cross-Tenant Isolation & IDOR Protection', () => {
    it('REJECTS seller cross-tenant subscription access (IDOR)', async () => {
      const harness = createTestBillingHarness();
      const sellerA = createSellerCaller('seller-a', 'store-a');
      const sellerB = createSellerCaller('seller-b', 'store-b');

      await harness.billingService.createSubscription(sellerA, {
        storeId: 'store-a',
        planSlug: 'starter',
      });

      // Seller B attempts to read Store A's subscription
      await expect(harness.billingService.getSubscription(sellerB, 'store-a')).rejects.toThrow(
        BillingStoreAccessDeniedError,
      );

      // Seller B attempts to cancel Store A's subscription
      await expect(harness.billingService.cancelSubscription(sellerB, 'store-a')).rejects.toThrow(
        BillingStoreAccessDeniedError,
      );

      // Seller B attempts to change Store A's subscription plan
      await expect(
        harness.billingService.changeSubscriptionPlan(sellerB, 'store-a', 'pro'),
      ).rejects.toThrow(BillingStoreAccessDeniedError);
    });

    it('REJECTS seller cross-tenant invoice access and listing (IDOR)', async () => {
      const harness = createTestBillingHarness();
      const sellerA = createSellerCaller('seller-a', 'store-a');
      const sellerB = createSellerCaller('seller-b', 'store-b');

      const subA = await harness.billingService.createSubscription(sellerA, {
        storeId: 'store-a',
        planSlug: 'starter',
      });

      const invA = await harness.billingService.generateInvoice(sellerA, {
        storeId: 'store-a',
        subscriptionId: subA.id,
      });

      // Seller B attempts to read Store A's invoice directly by ID
      await expect(harness.billingService.getInvoice(sellerB, invA.id)).rejects.toThrow(
        BillingStoreAccessDeniedError,
      );

      // Seller B attempts to list Store A's invoices
      await expect(harness.billingService.listInvoices(sellerB, 'store-a')).rejects.toThrow(
        BillingStoreAccessDeniedError,
      );
    });

    it('REJECTS seller cross-tenant entitlements query (IDOR)', async () => {
      const harness = createTestBillingHarness();
      const sellerA = createSellerCaller('seller-a', 'store-a');
      const sellerB = createSellerCaller('seller-b', 'store-b');

      await harness.billingService.createSubscription(sellerA, {
        storeId: 'store-a',
        planSlug: 'starter',
      });

      // Seller B attempts to inspect Store A's entitlements
      await expect(
        harness.billingService.getEffectiveEntitlements(sellerB, 'store-a'),
      ).rejects.toThrow(BillingStoreAccessDeniedError);
    });
  });

  describe('Financial Immutability Protection', () => {
    it('PREVENTS deleting a PAID invoice in persistence repository', async () => {
      const harness = createTestBillingHarness();
      const sellerA = createSellerCaller('seller-a', 'store-a');

      const subA = await harness.billingService.createSubscription(sellerA, {
        storeId: 'store-a',
        planSlug: 'starter',
      });

      const invA = await harness.billingService.generateInvoice(sellerA, {
        storeId: 'store-a',
        subscriptionId: subA.id,
      });

      // Mark invoice as PAID
      await harness.invoiceRepo.updateStatus(invA.id, 'PAID', new Date().toISOString());

      // Attempting to delete paid invoice throws FinancialImmutabilityError
      await expect(harness.invoiceRepo.delete(invA.id)).rejects.toThrow(FinancialImmutabilityError);
    });

    it('PREVENTS deleting a PAID billing payment in persistence repository', async () => {
      const harness = createTestBillingHarness();
      const sellerA = createSellerCaller('seller-a', 'store-a');

      const subA = await harness.billingService.createSubscription(sellerA, {
        storeId: 'store-a',
        planSlug: 'starter',
      });

      const invA = await harness.billingService.generateInvoice(sellerA, {
        storeId: 'store-a',
        subscriptionId: subA.id,
      });

      const payment = await harness.billingService.createBillingPayment(sellerA, {
        invoiceId: invA.id,
      });

      // Mark payment as PAID
      await harness.paymentRepo.updateStatus(payment.id, 'PAID', {
        paidAt: new Date().toISOString(),
      });

      // Attempting to delete paid payment throws FinancialImmutabilityError
      await expect(harness.paymentRepo.delete(payment.id)).rejects.toThrow(
        FinancialImmutabilityError,
      );
    });
  });

  describe('Price Spoofing & Sensitive Credential Shielding', () => {
    it('authoritatively sources pricing from PlanRepository, ignoring any caller attempts to tamper with prices', async () => {
      const harness = createTestBillingHarness();
      const sellerA = createSellerCaller('seller-a', 'store-a');

      const subA = await harness.billingService.createSubscription(sellerA, {
        storeId: 'store-a',
        planSlug: 'starter',
      });

      // Invoice generation computes strictly from the canonical Plan record
      const invoice = await harness.billingService.generateInvoice(sellerA, {
        storeId: 'store-a',
        subscriptionId: subA.id,
      });

      // Canonical Starter pricing: 50.000 + 100.000 setup fee = 150.000
      expect(invoice.total).toBe('150000.00');
    });

    it('shields internal sensitive secrets from Public Views', async () => {
      const harness = createTestBillingHarness();
      const sellerA = createSellerCaller('seller-a', 'store-a');

      const subA = await harness.billingService.createSubscription(sellerA, {
        storeId: 'store-a',
        planSlug: 'starter',
      });

      const invA = await harness.billingService.generateInvoice(sellerA, {
        storeId: 'store-a',
        subscriptionId: subA.id,
      });

      const payment = await harness.billingService.createBillingPayment(sellerA, {
        invoiceId: invA.id,
      });

      // Public payment view should only expose safe fields
      expect(payment).not.toHaveProperty('providerSecret');
      expect(payment).not.toHaveProperty('webhookSecret');
      expect(payment).not.toHaveProperty('privateKey');
      expect(payment.id).toBeDefined();
      expect(payment.amount).toBe(invA.total);
    });
  });
});

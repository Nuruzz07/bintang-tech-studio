/**
 * Bintang Tech Studio — Billing Payment Creation & Validation Test Suite.
 * Baseline: Milestone M13 Billing + Customer Onboarding Foundation.
 */

import { describe, it, expect } from 'vitest';
import { createTestBillingHarness, createSellerCaller } from './test-helpers.js';
import { validateBillingPaymentStateTransition } from '../src/validation.js';
import {
  BillingPaymentStateTransitionError,
  BillingStoreAccessDeniedError,
  InvoiceAlreadyPaidError,
} from '../src/errors.js';

describe('M13 Billing Payment Lifecycle & Security Suite', () => {
  describe('Billing Payment State Machine Transitions', () => {
    it('allows valid progressive transitions for billing payments', () => {
      expect(() => validateBillingPaymentStateTransition('PENDING', 'PROCESSING')).not.toThrow();
      expect(() => validateBillingPaymentStateTransition('PENDING', 'PAID')).not.toThrow();
      expect(() => validateBillingPaymentStateTransition('PENDING', 'FAILED')).not.toThrow();
      expect(() => validateBillingPaymentStateTransition('PENDING', 'EXPIRED')).not.toThrow();
      expect(() => validateBillingPaymentStateTransition('PENDING', 'CANCELLED')).not.toThrow();
      expect(() => validateBillingPaymentStateTransition('PROCESSING', 'PAID')).not.toThrow();
      expect(() => validateBillingPaymentStateTransition('PROCESSING', 'FAILED')).not.toThrow();
      expect(() => validateBillingPaymentStateTransition('PAID', 'PAID')).not.toThrow();
    });

    it('STRICTLY rejects mutating or failing an already PAID billing payment', () => {
      expect(() => validateBillingPaymentStateTransition('PAID', 'FAILED')).toThrow(
        BillingPaymentStateTransitionError,
      );
      expect(() => validateBillingPaymentStateTransition('PAID', 'PENDING')).toThrow(
        BillingPaymentStateTransitionError,
      );
      expect(() => validateBillingPaymentStateTransition('PAID', 'EXPIRED')).toThrow(
        BillingPaymentStateTransitionError,
      );
    });

    it('STRICTLY rejects transitions out of terminal CANCELLED or EXPIRED state', () => {
      expect(() => validateBillingPaymentStateTransition('CANCELLED', 'PAID')).toThrow(
        BillingPaymentStateTransitionError,
      );
      expect(() => validateBillingPaymentStateTransition('EXPIRED', 'PAID')).toThrow(
        BillingPaymentStateTransitionError,
      );
    });
  });

  describe('Billing Payment Creation Operations', () => {
    it('creates a billing payment for an issued invoice and generates payment url', async () => {
      const harness = createTestBillingHarness();
      const sellerCaller = createSellerCaller('seller-1', 'store-1');

      const subscription = await harness.billingService.createSubscription(sellerCaller, {
        storeId: 'store-1',
        planSlug: 'starter',
      });

      const initialInvoice = await harness.billingService.generateInvoice(sellerCaller, {
        storeId: 'store-1',
        subscriptionId: subscription.id,
      });

      const payment = await harness.billingService.createBillingPayment(sellerCaller, {
        invoiceId: initialInvoice.id,
      });

      expect(payment.id).toBeDefined();
      expect(payment.storeId).toBe('store-1');
      expect(payment.invoiceId).toBe(initialInvoice.id);
      expect(payment.amount).toBe(initialInvoice.total);
      expect(payment.currency).toBe('IDR');
      expect(payment.status).toBe('PENDING');
      expect(payment.paymentUrl).toContain('https://billing.bintang.tech/pay/');
    });

    it('is idempotent when given the same idempotency key', async () => {
      const harness = createTestBillingHarness();
      const sellerCaller = createSellerCaller('seller-1', 'store-1');

      const subscription = await harness.billingService.createSubscription(sellerCaller, {
        storeId: 'store-1',
        planSlug: 'starter',
      });

      const initialInvoice = await harness.billingService.generateInvoice(sellerCaller, {
        storeId: 'store-1',
        subscriptionId: subscription.id,
      });

      const payment1 = await harness.billingService.createBillingPayment(sellerCaller, {
        invoiceId: initialInvoice.id,
        idempotencyKey: 'idem-payment-key-123',
      });

      const payment2 = await harness.billingService.createBillingPayment(sellerCaller, {
        invoiceId: initialInvoice.id,
        idempotencyKey: 'idem-payment-key-123',
      });

      expect(payment1.id).toBe(payment2.id);
      expect(payment1.amount).toBe(payment2.amount);
    });

    it('REJECTS creating a payment if the invoice is already PAID', async () => {
      const harness = createTestBillingHarness();
      const sellerCaller = createSellerCaller('seller-1', 'store-1');

      const subscription = await harness.billingService.createSubscription(sellerCaller, {
        storeId: 'store-1',
        planSlug: 'starter',
      });

      const initialInvoice = await harness.billingService.generateInvoice(sellerCaller, {
        storeId: 'store-1',
        subscriptionId: subscription.id,
      });

      // Manually set invoice to PAID in repository
      await harness.invoiceRepo.updateStatus(initialInvoice.id, 'PAID', new Date().toISOString());

      await expect(
        harness.billingService.createBillingPayment(sellerCaller, {
          invoiceId: initialInvoice.id,
        }),
      ).rejects.toThrow(InvoiceAlreadyPaidError);
    });

    it('PREVENTS cross-tenant payment creation (IDOR protection)', async () => {
      const harness = createTestBillingHarness();
      const seller1 = createSellerCaller('seller-1', 'store-1');
      const seller2 = createSellerCaller('seller-2', 'store-2');

      const subscription = await harness.billingService.createSubscription(seller1, {
        storeId: 'store-1',
        planSlug: 'starter',
      });

      const initialInvoice = await harness.billingService.generateInvoice(seller1, {
        storeId: 'store-1',
        subscriptionId: subscription.id,
      });

      // Seller 2 attempts to create payment for Seller 1's invoice
      await expect(
        harness.billingService.createBillingPayment(seller2, {
          invoiceId: initialInvoice.id,
        }),
      ).rejects.toThrow(BillingStoreAccessDeniedError);
    });
  });
});

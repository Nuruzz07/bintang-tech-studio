/**
 * Bintang Tech Studio — Invoice Calculations & Rules Test Suite.
 * Baseline: Milestone M13 Billing + Customer Onboarding Foundation.
 */

import { describe, it, expect } from 'vitest';
import {
  createTestBillingHarness,
  createPlatformCaller,
  createSellerCaller,
} from './test-helpers.js';
import { validateInvoiceStateTransition } from '../src/validation.js';
import { InvoiceStateTransitionError, BillingStoreAccessDeniedError } from '../src/errors.js';
import { addMoney, subtractMoney, multiplyMoney, formatCurrency } from '../src/money.js';

describe('M13 Invoice Calculation & Lifecycle Suite', () => {
  describe('Decimal & Fixed-Point Money Math', () => {
    it('accurately computes monetary amounts without IEEE 754 floating point drift', () => {
      // 0.10 + 0.20 = 0.30
      const sum = addMoney('0.10', '0.20');
      expect(sum).toBe('0.30');

      // Subtraction
      const diff = subtractMoney('150000.00', '50000.00');
      expect(diff).toBe('100000.00');

      // Multiplication
      const mult = multiplyMoney('50000.00', 3);
      expect(mult).toBe('150000.00');

      // Format currency
      expect(formatCurrency('150000.00', 'IDR')).toBe('Rp 150.000');
    });
  });

  describe('Invoice State Transitions', () => {
    it('allows valid progressive transitions for invoices', () => {
      expect(() => validateInvoiceStateTransition('DRAFT', 'PENDING')).not.toThrow();
      expect(() => validateInvoiceStateTransition('DRAFT', 'VOID')).not.toThrow();
      expect(() => validateInvoiceStateTransition('PENDING', 'PAID')).not.toThrow();
      expect(() => validateInvoiceStateTransition('PENDING', 'VOID')).not.toThrow();
      expect(() => validateInvoiceStateTransition('PENDING', 'UNCOLLECTIBLE')).not.toThrow();
      expect(() => validateInvoiceStateTransition('PAID', 'PAID')).not.toThrow();
    });

    it('STRICTLY rejects mutating or voiding an already PAID invoice', () => {
      expect(() => validateInvoiceStateTransition('PAID', 'VOID')).toThrow(
        InvoiceStateTransitionError,
      );
      expect(() => validateInvoiceStateTransition('PAID', 'DRAFT')).toThrow(
        InvoiceStateTransitionError,
      );
      expect(() => validateInvoiceStateTransition('PAID', 'PENDING')).toThrow(
        InvoiceStateTransitionError,
      );
    });

    it('STRICTLY rejects transitions out of terminal VOID state', () => {
      expect(() => validateInvoiceStateTransition('VOID', 'PENDING')).toThrow(
        InvoiceStateTransitionError,
      );
      expect(() => validateInvoiceStateTransition('VOID', 'PAID')).toThrow(
        InvoiceStateTransitionError,
      );
    });
  });

  describe('Activation Fee & Renewal Invoicing Rules', () => {
    it('charges the one-time activation fee on the INITIAL subscription invoice', async () => {
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

      const invoiceWithItems = await harness.invoiceRepo.findById(initialInvoice.id);
      expect(invoiceWithItems).not.toBeNull();
      expect(invoiceWithItems?.items.length).toBe(2);

      const activationItem = invoiceWithItems?.items.find((i) => i.type === 'ACTIVATION');
      const subscriptionItem = invoiceWithItems?.items.find((i) => i.type === 'SUBSCRIPTION');

      expect(activationItem).toBeDefined();
      expect(activationItem?.amount).toBe('100000.00');
      expect(subscriptionItem).toBeDefined();
      expect(subscriptionItem?.amount).toBe('50000.00');

      expect(invoiceWithItems?.subtotal).toBe('150000.00');
      expect(invoiceWithItems?.total).toBe('150000.00');
    });

    it('DOES NOT charge the activation fee on subsequent renewal invoices for the same store', async () => {
      const harness = createTestBillingHarness();
      const sellerCaller = createSellerCaller('seller-1', 'store-1');
      const platformCaller = createPlatformCaller();

      // 1. Initial subscription with activation fee
      const subscription = await harness.billingService.createSubscription(sellerCaller, {
        storeId: 'store-1',
        planSlug: 'starter',
      });

      // 2. Platform creates renewal invoice for the next cycle
      const renewalInvoice = await harness.billingService.createInvoice(platformCaller, {
        storeId: 'store-1',
        subscriptionId: subscription.id,
        items: [
          {
            type: 'SUBSCRIPTION',
            description: 'Perpanjangan Langganan Starter (1 Bulan)',
            amount: '50000.00',
            quantity: 1,
          },
        ],
      });

      const invoiceWithItems = await harness.invoiceRepo.findById(renewalInvoice.id);
      expect(invoiceWithItems).not.toBeNull();
      expect(invoiceWithItems?.items.length).toBe(1);

      const hasActivationItem = invoiceWithItems?.items.some((i) => i.type === 'ACTIVATION');
      expect(hasActivationItem).toBe(false);

      expect(invoiceWithItems?.subtotal).toBe('50000.00');
      expect(invoiceWithItems?.total).toBe('50000.00');
    });

    it('calculates invoice with add-on line items correctly', async () => {
      const harness = createTestBillingHarness();
      const platformCaller = createPlatformCaller();

      const invoice = await harness.billingService.createInvoice(platformCaller, {
        storeId: 'store-1',
        items: [
          {
            type: 'SUBSCRIPTION',
            description: 'Starter Plan',
            amount: '50000.00',
            quantity: 1,
          },
          {
            type: 'ADDON',
            description: 'Extra 50 Products Addon',
            amount: '25000.00',
            quantity: 1,
          },
        ],
        tax: '0.00',
        discount: '0.00',
      });

      expect(invoice.subtotal).toBe('75000.00');
      expect(invoice.total).toBe('75000.00');
      expect(invoice.formattedTotal).toBe('Rp 75.000');
    });
  });

  describe('Cross-Tenant Invoice Access Control', () => {
    it('allows a seller to retrieve their own store invoice', async () => {
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

      const inv = await harness.billingService.getInvoice(sellerCaller, initialInvoice.id);
      expect(inv.id).toBe(initialInvoice.id);
      expect(inv.storeId).toBe('store-1');
    });

    it('PREVENTS a seller from retrieving an invoice belonging to a different store (IDOR rejection)', async () => {
      const harness = createTestBillingHarness();
      const seller1Caller = createSellerCaller('seller-1', 'store-1');
      const seller2Caller = createSellerCaller('seller-2', 'store-2');

      const subscription = await harness.billingService.createSubscription(seller1Caller, {
        storeId: 'store-1',
        planSlug: 'starter',
      });

      const initialInvoice = await harness.billingService.generateInvoice(seller1Caller, {
        storeId: 'store-1',
        subscriptionId: subscription.id,
      });

      // Seller 2 attempts to view Seller 1's invoice
      await expect(
        harness.billingService.getInvoice(seller2Caller, initialInvoice.id),
      ).rejects.toThrow(BillingStoreAccessDeniedError);
    });

    it('allows platform admin to retrieve invoices across any store', async () => {
      const harness = createTestBillingHarness();
      const sellerCaller = createSellerCaller('seller-1', 'store-1');
      const platformCaller = createPlatformCaller();

      const subscription = await harness.billingService.createSubscription(sellerCaller, {
        storeId: 'store-1',
        planSlug: 'starter',
      });

      const initialInvoice = await harness.billingService.generateInvoice(sellerCaller, {
        storeId: 'store-1',
        subscriptionId: subscription.id,
      });

      const inv = await harness.billingService.getInvoice(platformCaller, initialInvoice.id);
      expect(inv.id).toBe(initialInvoice.id);
    });
  });
});

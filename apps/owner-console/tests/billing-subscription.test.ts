/**
 * Bintang Tech Studio — Platform Billing & Subscription Governance Test Suite.
 * Baseline: Milestone M14 Owner Console Foundation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestOwnerConsoleHarness, TestOwnerConsoleHarness } from './test-helpers.js';

describe('M14 Billing & Subscription Governance Suite', () => {
  let harness: TestOwnerConsoleHarness;
  let ownerToken: string;
  let adminToken: string;

  beforeEach(async () => {
    harness = createTestOwnerConsoleHarness();
    ownerToken = await harness.createOwnerSession();
    adminToken = await harness.createAdminSession();

    // Create test store and subscription
    await harness.storeRepo.create({
      id: 'store_billing_1',
      ownerUserId: 'usr_seller_1',
      name: 'Billing Test Store',
      slug: 'billing-test-store',
      templateVersionId: null,
      status: 'ACTIVE',
      currency: 'IDR',
      settings: {},
    });

    const sub = await harness.subRepo.create({
      id: 'sub_1',
      storeId: 'store_billing_1',
      planId: 'plan_starter_default',
      status: 'ACTIVE',
      startedAt: '2026-10-01T00:00:00.000Z',
      currentPeriodStart: '2026-10-01T00:00:00.000Z',
      currentPeriodEnd: '2026-11-01T00:00:00.000Z',
      cancelledAt: null,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    });

    // Create invoice
    await harness.invoiceRepo.create(
      {
        id: 'inv_1',
        storeId: 'store_billing_1',
        subscriptionId: sub.id,
        invoiceNumber: 'INV-202610-1001',
        status: 'PAID',
        subtotal: '150000.00',
        discount: '0.00',
        tax: '0.00',
        total: '150000.00',
        currency: 'IDR',
        issuedAt: '2026-10-01T00:00:00.000Z',
        dueAt: '2026-10-08T00:00:00.000Z',
        paidAt: '2026-10-01T01:00:00.000Z',
        periodStart: '2026-10-01T00:00:00.000Z',
        periodEnd: '2026-11-01T00:00:00.000Z',
      },
      [
        {
          id: 'inv_it_1',
          storeId: 'store_billing_1',
          invoiceId: 'inv_1',
          type: 'SUBSCRIPTION',
          description: 'Starter Merchant',
          quantity: 1,
          unitPrice: '50000.00',
          amount: '50000.00',
          createdAt: '2026-10-01T00:00:00.000Z',
        },
        {
          id: 'inv_it_2',
          storeId: 'store_billing_1',
          invoiceId: 'inv_1',
          type: 'ACTIVATION',
          description: 'Setup Fee',
          quantity: 1,
          unitPrice: '100000.00',
          amount: '100000.00',
          createdAt: '2026-10-01T00:00:00.000Z',
        },
      ],
    );
  });

  it('lists authoritative SaaS plans with pricing, quota, and placeholder distinction', async () => {
    const plans = await harness.service.listPlans(adminToken);
    expect(plans.length).toBe(3);

    const starter = plans.find((p) => p.slug === 'starter');
    expect(starter).toBeDefined();
    expect(starter!.monthlyPrice).toBe('50000.00');
    expect(starter!.activationFee).toBe('100000.00');
    expect(starter!.maxProducts).toBe(20);
    expect(starter!.isPlaceholder).toBe(false);

    const pro = plans.find((p) => p.slug === 'pro');
    expect(pro!.isPlaceholder).toBe(true);
  });

  it('lists subscriptions across stores and executes controlled lifecycle actions', async () => {
    const subs = await harness.service.listSubscriptions(adminToken);
    expect(subs.length).toBe(1);
    expect(subs[0]!.storeId).toBe('store_billing_1');
    expect(subs[0]!.status).toBe('ACTIVE');

    // Suspend subscription through M13 state machine
    const suspended = await harness.service.executeSubscriptionAction(
      ownerToken,
      'store_billing_1',
      {
        action: 'SUSPEND',
        reason: 'Payment delinquency',
      },
    );
    expect(suspended.status).toBe('SUSPENDED');

    // Resume / Reactivate subscription
    const resumed = await harness.service.executeSubscriptionAction(ownerToken, 'store_billing_1', {
      action: 'RESUME',
      reason: 'Payment settlement received',
    });
    expect(resumed.status).toBe('ACTIVE');

    // Verify audit logs
    const logs = await harness.auditRepo.list({ resourceType: 'subscription' });
    expect(logs.length).toBe(2);
    expect(logs[0]!.result).toBe('SUCCESS');
  });

  it('lists invoices across stores with financial details and activation fee flags', async () => {
    const invoices = await harness.service.listInvoices(adminToken);
    expect(invoices.length).toBe(1);
    expect(invoices[0]!.invoiceNumber).toBe('INV-202610-1001');
    expect(invoices[0]!.status).toBe('PAID');
    expect(invoices[0]!.total).toBe('150000.00');
    expect(invoices[0]!.hasActivationFee).toBe(true);
  });

  it('lists add-ons catalog', async () => {
    const addons = await harness.service.listAddons(adminToken);
    expect(Array.isArray(addons)).toBe(true);
  });
});

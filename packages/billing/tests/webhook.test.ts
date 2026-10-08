/**
 * Bintang Tech Studio — Billing Webhook Ingestion & Idempotency Test Suite.
 * Baseline: Milestone M13 Billing + Customer Onboarding Foundation.
 */

import { describe, it, expect } from 'vitest';
import { createTestBillingHarness, createSellerCaller } from './test-helpers.js';
import { BillingWebhookSignatureError, BillingPaymentAmountMismatchError } from '../src/errors.js';
import { BillingWebhookEvent } from '../src/types.js';

describe('M13 Billing Webhook Processing & Idempotency Suite', () => {
  it('rejects webhooks with invalid signatures', async () => {
    const harness = createTestBillingHarness();

    const invalidWebhook: BillingWebhookEvent = {
      eventId: 'evt-invalid-sig-1',
      providerId: 'mock-provider',
      eventType: 'payment.succeeded',
      signature: 'wrong-signature',
      timestamp: new Date().toISOString(),
      payload: {
        paymentId: 'pay-123',
        amount: '150000.00',
        currency: 'IDR',
      },
    };

    await expect(harness.billingService.processWebhook(invalidWebhook)).rejects.toThrow(
      BillingWebhookSignatureError,
    );
  });

  it('authoritatively handles payment.succeeded: marks payment PAID, invoice PAID, and activates subscription', async () => {
    const harness = createTestBillingHarness();
    const sellerCaller = createSellerCaller('seller-1', 'store-1');

    // 1. Create subscription & invoice
    const subscription = await harness.billingService.createSubscription(sellerCaller, {
      storeId: 'store-1',
      planSlug: 'starter',
    });
    const initialInvoice = await harness.billingService.generateInvoice(sellerCaller, {
      storeId: 'store-1',
      subscriptionId: subscription.id,
    });
    expect(subscription.status).toBe('TRIAL');
    expect(initialInvoice.status).toBe('PENDING');

    // 2. Create payment
    const payment = await harness.billingService.createBillingPayment(sellerCaller, {
      invoiceId: initialInvoice.id,
    });
    expect(payment.status).toBe('PENDING');

    // 3. Webhook arrives for payment.succeeded
    const eventId1 = 'evt-success-1';
    const webhookEvent: BillingWebhookEvent = {
      eventId: eventId1,
      providerId: 'mock-provider',
      eventType: 'payment.succeeded',
      signature: harness.paymentAdapter.generateValidSignature(eventId1),
      timestamp: new Date().toISOString(),
      payload: {
        paymentId: payment.id,
        amount: payment.amount,
        currency: 'IDR',
      },
    };

    const result = await harness.billingService.processWebhook(webhookEvent);

    expect(result.processed).toBe(true);
    expect(result.alreadyProcessed).toBe(false);
    expect(result.paymentId).toBe(payment.id);
    expect(result.status).toBe('PAID');
    expect(result.activatedSubscriptionId).toBe(subscription.id);

    // 4. Verify DB/repository states
    const updatedPayment = await harness.paymentRepo.findById(payment.id);
    expect(updatedPayment?.status).toBe('PAID');
    expect(updatedPayment?.paidAt).not.toBeNull();

    const updatedInvoice = await harness.invoiceRepo.findById(initialInvoice.id);
    expect(updatedInvoice?.status).toBe('PAID');
    expect(updatedInvoice?.paidAt).not.toBeNull();

    const updatedSub = await harness.subRepo.findById(subscription.id);
    expect(updatedSub?.status).toBe('ACTIVE');
    expect(updatedSub?.currentPeriodStart).not.toBeNull();
    expect(updatedSub?.currentPeriodEnd).not.toBeNull();
  });

  it('IDEMPOTENCY: safely handles replay of identical webhook without mutating or duplicating side effects', async () => {
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

    const eventId2 = 'evt-replay-test-1';
    const webhookEvent: BillingWebhookEvent = {
      eventId: eventId2,
      providerId: 'mock-provider',
      eventType: 'payment.succeeded',
      signature: harness.paymentAdapter.generateValidSignature(eventId2),
      timestamp: new Date().toISOString(),
      payload: {
        paymentId: payment.id,
        amount: payment.amount,
        currency: 'IDR',
      },
    };

    // First delivery
    const result1 = await harness.billingService.processWebhook(webhookEvent);
    expect(result1.processed).toBe(true);
    expect(result1.alreadyProcessed).toBe(false);

    // Replay with exact same eventId
    const result2 = await harness.billingService.processWebhook(webhookEvent);
    expect(result2.processed).toBe(true);
    expect(result2.alreadyProcessed).toBe(true);
    expect(result2.paymentId).toBe(payment.id);
    expect(result2.status).toBe('PAID');
  });

  it('handles payment.failed webhook: sets payment to FAILED without activating subscription', async () => {
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

    const eventId3 = 'evt-fail-1';
    const failedWebhook: BillingWebhookEvent = {
      eventId: eventId3,
      providerId: 'mock-provider',
      eventType: 'payment.failed',
      signature: harness.paymentAdapter.generateValidSignature(eventId3),
      timestamp: new Date().toISOString(),
      payload: {
        paymentId: payment.id,
        amount: payment.amount,
        currency: 'IDR',
      },
    };

    const result = await harness.billingService.processWebhook(failedWebhook);
    expect(result.processed).toBe(true);
    expect(result.status).toBe('FAILED');

    const updatedPayment = await harness.paymentRepo.findById(payment.id);
    expect(updatedPayment?.status).toBe('FAILED');

    // Subscription remains in TRIAL, not activated
    const updatedSub = await harness.subRepo.findById(subscription.id);
    expect(updatedSub?.status).toBe('TRIAL');
  });

  it('rejects webhook with amount mismatch', async () => {
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

    const eventId4 = 'evt-forge-1';
    const forgedAmountWebhook: BillingWebhookEvent = {
      eventId: eventId4,
      providerId: 'mock-provider',
      eventType: 'payment.succeeded',
      signature: harness.paymentAdapter.generateValidSignature(eventId4),
      timestamp: new Date().toISOString(),
      payload: {
        paymentId: payment.id,
        amount: '1000.00', // Forged amount (should be 150000.00)
        currency: 'IDR',
      },
    };

    await expect(harness.billingService.processWebhook(forgedAmountWebhook)).rejects.toThrow(
      BillingPaymentAmountMismatchError,
    );
  });
});

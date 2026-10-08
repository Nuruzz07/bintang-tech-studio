/**
 * Bintang Tech Studio — Provider-Neutral Billing Payment Adapter Abstraction.
 * Baseline: Milestone M13 Billing + Customer Onboarding Foundation.
 *
 * Explicitly classified as: FOUNDATION / DEMO (Mock adapter).
 * Never called production-ready in M13.
 */

import { BillingPayment, BillingWebhookEvent, BillingPaymentStatus } from './types.js';
import { BillingSignatureVerificationError } from './errors.js';

export interface ProviderBillingPaymentResult {
  readonly providerTransactionId: string;
  readonly paymentUrl: string;
  readonly status: BillingPaymentStatus;
}

export interface BillingPaymentAdapter {
  readonly providerId: string;

  createPayment(payment: BillingPayment): Promise<ProviderBillingPaymentResult>;

  verifyPayment(
    paymentId: string,
    providerTransactionId?: string | null,
  ): Promise<{ status: BillingPaymentStatus; paidAt?: string }>;

  verifyWebhookSignature(event: BillingWebhookEvent): boolean;

  parseWebhookEvent(
    rawBody: string | Record<string, unknown>,
    signatureHeader?: string,
  ): BillingWebhookEvent;
}

/**
 * Foundation Mock Adapter for Billing Payments.
 * Simulates asynchronous payment gateway outcomes without live credentials.
 */
export class MockBillingPaymentAdapter implements BillingPaymentAdapter {
  public readonly providerId = 'BINTANG_MOCK_GATEWAY';
  private shouldFail = false;
  private secretKey: string;

  constructor(secretKey = 'mock_billing_secret_key_123') {
    this.secretKey = secretKey;
  }

  public setSimulateFailure(fail: boolean): void {
    this.shouldFail = fail;
  }

  public async createPayment(payment: BillingPayment): Promise<ProviderBillingPaymentResult> {
    const providerTransactionId = `ptx_mock_${payment.id}_${Date.now()}`;
    const paymentUrl = `https://billing.bintang.tech/pay/${payment.id}?tx=${providerTransactionId}`;

    return {
      providerTransactionId,
      paymentUrl,
      status: this.shouldFail ? 'FAILED' : 'PENDING',
    };
  }

  public async verifyPayment(
    _paymentId: string,
    _providerTransactionId?: string | null,
  ): Promise<{ status: BillingPaymentStatus; paidAt?: string }> {
    if (this.shouldFail) {
      return { status: 'FAILED' };
    }
    return {
      status: 'PAID',
      paidAt: new Date().toISOString(),
    };
  }

  public verifyWebhookSignature(event: BillingWebhookEvent): boolean {
    if (!event.signature) return false;
    // Expected signature format: "sig_" + secretKey + "_" + eventId
    const expected = `sig_${this.secretKey}_${event.eventId}`;
    return event.signature === expected;
  }

  public parseWebhookEvent(
    rawBody: string | Record<string, unknown>,
    signatureHeader?: string,
  ): BillingWebhookEvent {
    const parsed = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    const event: BillingWebhookEvent = {
      eventId: parsed.eventId || `evt_${Date.now()}`,
      providerId: parsed.providerId || this.providerId,
      eventType: parsed.eventType || 'payment.succeeded',
      payload: parsed.payload || parsed,
      signature: signatureHeader || parsed.signature,
      timestamp: parsed.timestamp || new Date().toISOString(),
    };

    if (!this.verifyWebhookSignature(event)) {
      throw new BillingSignatureVerificationError();
    }

    return event;
  }

  public generateValidSignature(eventId: string): string {
    return `sig_${this.secretKey}_${eventId}`;
  }
}

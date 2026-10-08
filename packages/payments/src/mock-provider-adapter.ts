import { PaymentProviderCapabilities } from './types.js';
import {
  PaymentProviderAdapter,
  CreateProviderPaymentInput,
  ProviderPaymentResult,
  VerifyProviderPaymentInput,
  ProviderPaymentStatusResult,
  VerifyWebhookSignatureInput,
  ParseWebhookEventInput,
  ParsedWebhookEvent,
  CreateProviderRefundInput,
  ProviderRefundResult,
} from './provider-adapter.js';
import { PaymentCapabilityUnsupportedError } from './errors.js';

export interface MockPaymentProviderAdapterOptions {
  readonly providerName?: string;
  readonly expectedSignature?: string | undefined;
  readonly capabilities?: Partial<PaymentProviderCapabilities> | undefined;
}

export class MockPaymentProviderAdapter implements PaymentProviderAdapter {
  readonly provider: string;
  readonly name: string;
  private readonly validSignature?: string | undefined;
  private readonly capabilities: PaymentProviderCapabilities;

  constructor(options: string | MockPaymentProviderAdapterOptions = 'MOCK_PROVIDER') {
    if (typeof options === 'string') {
      this.provider = options.toUpperCase();
      this.name = this.provider;
      this.capabilities = {
        createPayment: true,
        verifyPayment: true,
        webhook: true,
        refund: true,
      };
    } else {
      this.provider = (options.providerName ?? 'MOCK_PROVIDER').toUpperCase();
      this.name = this.provider;
      this.validSignature = options.expectedSignature;
      this.capabilities = {
        createPayment: options.capabilities?.createPayment ?? true,
        verifyPayment: options.capabilities?.verifyPayment ?? true,
        webhook: options.capabilities?.webhook ?? true,
        refund: options.capabilities?.refund ?? true,
      };
    }
  }

  getCapabilities(): PaymentProviderCapabilities {
    return { ...this.capabilities };
  }

  async createPayment(_input: CreateProviderPaymentInput): Promise<ProviderPaymentResult> {
    const providerReference = `mock_ref_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const paymentUrl = `https://mock-gateway.example.com/checkout/${providerReference}`;

    return {
      providerReference,
      paymentUrl,
      status: 'PENDING',
      rawResponse: { mockCreated: true, providerRef: providerReference },
    };
  }

  async verifyPayment(input: VerifyProviderPaymentInput): Promise<ProviderPaymentStatusResult> {
    return {
      providerReference: input.providerReference,
      status: 'SUCCEEDED',
      amount: '10000.00',
      currency: 'IDR',
    };
  }

  async verifyWebhookSignature(input: VerifyWebhookSignatureInput): Promise<boolean> {
    if (!input.signature) {
      return false;
    }
    if (this.validSignature) {
      return input.signature === this.validSignature;
    }
    return (
      input.signature === 'valid_signature' ||
      input.signature === `sig_${input.credentialReference}`
    );
  }

  async parseWebhookEvent(input: ParseWebhookEventInput): Promise<ParsedWebhookEvent> {
    const p = input.payload;
    const eventId = String(p.event_id ?? p.id ?? `evt_${Date.now()}`);
    const eventType = String(p.event_type ?? p.type ?? p.event ?? 'payment.succeeded');
    const providerReference = String(
      p.provider_reference ??
        p.providerReference ??
        p.transaction_id ??
        p.reference ??
        'mock_ref_123',
    );
    const paymentIntentId = p.payment_intent_id ? String(p.payment_intent_id) : undefined;
    const storeId = p.store_id ? String(p.store_id) : undefined;
    const amount = p.amount ? String(p.amount) : undefined;
    const currency = p.currency ? String(p.currency) : undefined;

    let status: 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'PROCESSING' = 'SUCCEEDED';
    if (p.status === 'FAILED' || eventType.includes('failed')) status = 'FAILED';
    else if (p.status === 'EXPIRED' || eventType.includes('expired')) status = 'EXPIRED';
    else if (p.status === 'PROCESSING' || eventType.includes('processing')) status = 'PROCESSING';
    else if (
      p.status === 'SUCCEEDED' ||
      eventType.includes('succeeded') ||
      eventType.includes('success')
    ) {
      status = 'SUCCEEDED';
    }

    return {
      eventId,
      eventType,
      providerReference,
      paymentIntentId,
      storeId,
      amount,
      currency,
      status,
      failureReason:
        p.failureReason !== undefined || p.failure_reason !== undefined
          ? String(p.failureReason ?? p.failure_reason)
          : undefined,
    };
  }

  async createRefund(input: CreateProviderRefundInput): Promise<ProviderRefundResult> {
    if (!this.capabilities.refund) {
      throw new PaymentCapabilityUnsupportedError(this.provider, 'refund');
    }

    const providerRefundId = `mock_rfnd_${Date.now()}`;
    return {
      providerRefundId,
      status: 'SUCCEEDED',
      amount: input.amount,
      currency: input.currency,
      rawResponse: { refundSuccess: true, refundId: providerRefundId },
    };
  }
}

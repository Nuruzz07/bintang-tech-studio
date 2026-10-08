import { PaymentAttemptStatus, PaymentProviderCapabilities } from './types.js';

export interface CreateProviderPaymentInput {
  readonly storeId: string;
  readonly paymentIntentId: string;
  readonly attemptId: string;
  readonly orderId: string;
  readonly amount: string;
  readonly currency: string;
  readonly customerId: string;
  readonly credentialReference: string;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

export interface ProviderPaymentResult {
  readonly providerReference: string;
  readonly paymentUrl: string | null;
  readonly status: PaymentAttemptStatus;
  readonly rawResponse?: Readonly<Record<string, unknown>> | undefined;
}

export interface VerifyProviderPaymentInput {
  readonly storeId: string;
  readonly paymentIntentId: string;
  readonly providerReference: string;
  readonly credentialReference: string;
}

export interface ProviderPaymentStatusResult {
  readonly providerReference: string;
  readonly status: PaymentAttemptStatus;
  readonly amount: string;
  readonly currency: string;
  readonly failureCode?: string | null | undefined;
  readonly failureReason?: string | null | undefined;
  readonly rawResponse?: Readonly<Record<string, unknown>> | undefined;
}

export interface VerifyWebhookSignatureInput {
  readonly payload: string | Readonly<Record<string, unknown>>;
  readonly signature?: string | undefined;
  readonly rawBody?: string | undefined;
  readonly headers?: Readonly<Record<string, string>> | undefined;
  readonly credentialReference: string;
}

export interface ParseWebhookEventInput {
  readonly payload: Readonly<Record<string, unknown>>;
  readonly headers?: Readonly<Record<string, string>> | undefined;
}

export interface ParsedWebhookEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly providerReference: string;
  readonly paymentIntentId?: string | undefined;
  readonly storeId?: string | undefined;
  readonly amount?: string | undefined;
  readonly currency?: string | undefined;
  readonly status: 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'PROCESSING';
  readonly failureReason?: string | undefined;
}

export interface CreateProviderRefundInput {
  readonly storeId: string;
  readonly paymentIntentId: string;
  readonly providerReference: string;
  readonly refundId: string;
  readonly amount: string;
  readonly currency: string;
  readonly reason?: string | undefined;
  readonly credentialReference: string;
}

export interface ProviderRefundResult {
  readonly providerRefundId: string;
  readonly status: 'SUCCEEDED' | 'PROCESSING' | 'FAILED';
  readonly amount: string;
  readonly currency: string;
  readonly rawResponse?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Neutral abstraction interface for payment providers (e.g. Tipzy, Midtrans, Mock).
 */
export interface PaymentProviderAdapter {
  readonly provider: string;
  getCapabilities(): PaymentProviderCapabilities;
  createPayment(input: CreateProviderPaymentInput): Promise<ProviderPaymentResult>;
  verifyPayment?(input: VerifyProviderPaymentInput): Promise<ProviderPaymentStatusResult>;
  verifyWebhookSignature(input: VerifyWebhookSignatureInput): Promise<boolean>;
  parseWebhookEvent(input: ParseWebhookEventInput): Promise<ParsedWebhookEvent>;
  createRefund?(input: CreateProviderRefundInput): Promise<ProviderRefundResult>;
}

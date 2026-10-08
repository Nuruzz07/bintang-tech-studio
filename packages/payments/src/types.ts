import { AuthenticatedStoreContext, StoreContext } from '@bintang/tenancy';
import { CustomerContext } from '@bintang/orders';

export const PAYMENT_ACCOUNT_STATUSES = ['ACTIVE', 'INACTIVE', 'ERROR', 'DISCONNECTED'] as const;
export type PaymentAccountStatus = (typeof PAYMENT_ACCOUNT_STATUSES)[number];

export const PAYMENT_PROVIDER_CAPABILITIES = [
  'createPayment',
  'verifyPayment',
  'webhook',
  'refund',
  'partialRefund',
] as const;
export type PaymentProviderCapability = (typeof PAYMENT_PROVIDER_CAPABILITIES)[number];

export interface PaymentProviderCapabilities {
  readonly createPayment: boolean;
  readonly verifyPayment: boolean;
  readonly webhook: boolean;
  readonly refund: boolean;
  readonly partialRefund?: boolean | undefined;
}

/**
 * Seller-owned payment account.
 * Corresponds to PostgreSQL public.payment_accounts table.
 */
export interface PaymentAccount {
  readonly id: string;
  readonly storeId: string;
  readonly provider: string;
  readonly displayName: string;
  readonly status: PaymentAccountStatus;
  readonly currency: string;
  readonly credentialReference: string; // Server-side secret reference, NEVER returned to customers
  readonly capabilities: readonly PaymentProviderCapability[];
  readonly configuration: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Customer-safe projection of PaymentAccount.
 * Strictly excludes credentialReference and internal private configuration.
 */
export interface PublicPaymentAccount {
  readonly id: string;
  readonly storeId: string;
  readonly provider: string;
  readonly displayName: string;
  readonly status: PaymentAccountStatus;
  readonly currency: string;
  readonly capabilities: readonly PaymentProviderCapability[];
  readonly createdAt: string;
}

export const PAYMENT_INTENT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'EXPIRED',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
] as const;
export type PaymentIntentStatus = (typeof PAYMENT_INTENT_STATUSES)[number];

export const PAYMENT_ATTEMPT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'EXPIRED',
  'CANCELLED',
] as const;
export type PaymentAttemptStatus = (typeof PAYMENT_ATTEMPT_STATUSES)[number];

/**
 * PaymentIntent aggregate representing a customer's intention to pay an authoritative order.
 */
export interface PaymentIntent {
  readonly id: string;
  readonly storeId: string;
  readonly orderId: string;
  readonly customerId: string;
  readonly amount: string; // NUMERIC(15,2) string
  readonly currency: string;
  readonly status: PaymentIntentStatus;
  readonly paymentAccountId: string;
  readonly provider: string;
  readonly idempotencyKey: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt: string;
}

/**
 * PaymentAttempt representing a discrete attempt to charge via a provider.
 * Multiple attempts can belong to a single PaymentIntent.
 * Corresponds to PostgreSQL public.payments table.
 */
export interface PaymentAttempt {
  readonly id: string;
  readonly storeId: string;
  readonly paymentIntentId: string;
  readonly attemptNumber: number;
  readonly provider: string;
  readonly providerReference: string | null;
  readonly paymentUrl: string | null;
  readonly amount: string;
  readonly currency: string;
  readonly status: PaymentAttemptStatus;
  readonly failureCode: string | null;
  readonly failureReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const PAYMENT_EVENT_PROCESSING_STATUSES = [
  'RECEIVED',
  'PROCESSED',
  'FAILED',
  'IGNORED',
] as const;
export type PaymentEventProcessingStatus = (typeof PAYMENT_EVENT_PROCESSING_STATUSES)[number];

/**
 * Payment event record for webhook and asynchronous event ingress.
 * Corresponds to PostgreSQL public.payment_events table.
 */
export interface PaymentEvent {
  readonly id: string;
  readonly storeId: string | null;
  readonly paymentIntentId: string | null;
  readonly paymentAttemptId: string | null;
  readonly provider: string;
  readonly eventId: string;
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly processingStatus: PaymentEventProcessingStatus;
  readonly processedAt: string | null;
  readonly createdAt: string;
}

export const REFUND_STATUSES = [
  'PENDING',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

/**
 * Refund record for reversing all or part of a succeeded payment.
 * Corresponds to PostgreSQL public.refunds table.
 */
export interface Refund {
  readonly id: string;
  readonly storeId: string;
  readonly paymentIntentId: string;
  readonly orderId: string;
  readonly provider: string;
  readonly providerRefundId: string | null;
  readonly amount: string;
  readonly currency: string;
  readonly status: RefundStatus;
  readonly reason: string | null;
  readonly requestedAt: string;
  readonly processedAt: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Payment caller boundary: Seller merchant vs Customer.
 */
export type PaymentCaller =
  | { readonly type: 'SELLER'; readonly context: AuthenticatedStoreContext | StoreContext }
  | { readonly type: 'CUSTOMER'; readonly context: CustomerContext };

/**
 * Input for creating a payment account.
 */
export interface CreatePaymentAccountInput {
  readonly provider: string;
  readonly displayName: string;
  readonly currency?: string | undefined;
  readonly credentialReference: string;
  readonly capabilities?: readonly PaymentProviderCapability[] | undefined;
  readonly configuration?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Input for creating a payment intent.
 */
export interface CreatePaymentIntentInput {
  readonly orderId: string;
  readonly paymentAccountId?: string | undefined;
  readonly amount?: string | undefined; // Optional: validated against authoritative order
  readonly currency?: string | undefined; // Optional: validated against authoritative order
  readonly idempotencyKey?: string | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Input for creating a payment attempt.
 */
export interface CreatePaymentAttemptInput {
  readonly paymentIntentId: string;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Ingress webhook event payload.
 */
export interface ProcessPaymentWebhookInput {
  readonly provider: string;
  readonly eventId: string;
  readonly eventType?: string | undefined;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly signature?: string | undefined;
  readonly rawBody?: string | undefined;
  readonly headers?: Readonly<Record<string, string>> | undefined;
  readonly storeId?: string | undefined;
  readonly paymentIntentId?: string | undefined;
  readonly providerReference?: string | undefined;
  readonly amount?: string | undefined;
  readonly currency?: string | undefined;
}

/**
 * Result of webhook processing.
 */
export interface WebhookProcessingResult {
  readonly eventId: string;
  readonly provider: string;
  readonly processingStatus: PaymentEventProcessingStatus;
  readonly paymentIntentId: string | null;
  readonly previousStatus?: PaymentIntentStatus | undefined;
  readonly currentStatus?: PaymentIntentStatus | undefined;
  readonly isDuplicate: boolean;
}

/**
 * Input for creating a refund.
 */
export interface CreateRefundInput {
  readonly paymentIntentId: string;
  readonly amount: string;
  readonly reason?: string | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Filter for querying payment intents.
 */
export interface PaymentIntentFilter {
  readonly status?: PaymentIntentStatus | readonly PaymentIntentStatus[] | undefined;
  readonly orderId?: string | undefined;
  readonly customerId?: string | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

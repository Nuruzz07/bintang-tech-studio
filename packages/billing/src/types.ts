/**
 * Bintang Tech Studio — SaaS Billing & Customer Onboarding Type Definitions.
 * Baseline: Milestone M13 Billing + Customer Onboarding Foundation.
 *
 * Models strictly aligned with M02 PostgreSQL schema (public.plans, public.subscriptions,
 * public.invoices, public.invoice_items, public.billing_payments, public.addons, public.store_addons).
 */

import { StoreRole } from '@bintang/tenancy';

// ============================================================================
// 1. PLANS
// ============================================================================

export type PlanStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface PlanFeatures {
  readonly telegram: boolean;
  readonly whatsapp: boolean;
  readonly vouchers: boolean;
  readonly broadcast: boolean;
  readonly analytics: 'basic' | 'advanced';
  readonly staffMax: number;
  readonly [key: string]: unknown;
}

export interface Plan {
  readonly id: string;
  readonly name: string;
  readonly slug: string; // 'starter' | 'pro' | 'business' | custom
  readonly monthlyPrice: string; // exact decimal string, e.g. "50000.00"
  readonly activationFee: string; // exact decimal string, e.g. "100000.00"
  readonly maxProducts: number; // e.g. 20 for starter
  readonly status: PlanStatus;
  readonly features: Readonly<PlanFeatures>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PublicPlanView {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly monthlyPrice: string;
  readonly formattedMonthlyPrice: string;
  readonly activationFee: string;
  readonly formattedActivationFee: string;
  readonly maxProducts: number;
  readonly status: PlanStatus;
  readonly features: Readonly<PlanFeatures>;
}

// ============================================================================
// 2. SUBSCRIPTIONS
// ============================================================================

export type SubscriptionStatus =
  'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';

export const SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  'TRIAL',
  'ACTIVE',
  'PAST_DUE',
  'SUSPENDED',
  'CANCELLED',
  'EXPIRED',
] as const;

export interface Subscription {
  readonly id: string;
  readonly storeId: string;
  readonly planId: string;
  readonly status: SubscriptionStatus;
  readonly startedAt: string;
  readonly currentPeriodStart: string;
  readonly currentPeriodEnd: string;
  readonly cancelledAt: string | null;
  readonly cancelAtPeriodEnd?: boolean | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PublicSubscriptionView {
  readonly id: string;
  readonly storeId: string;
  readonly planId: string;
  readonly planSlug: string;
  readonly planName: string;
  readonly status: SubscriptionStatus;
  readonly startedAt: string;
  readonly currentPeriodStart: string;
  readonly currentPeriodEnd: string;
  readonly isOperationallyRestricted: boolean;
  readonly cancelledAt: string | null;
  readonly cancelAtPeriodEnd?: boolean | undefined;
}

// ============================================================================
// 3. INVOICES & INVOICE ITEMS
// ============================================================================

export type InvoiceStatus = 'DRAFT' | 'PENDING' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE';

export const INVOICE_STATUSES: readonly InvoiceStatus[] = [
  'DRAFT',
  'PENDING',
  'PAID',
  'VOID',
  'UNCOLLECTIBLE',
] as const;

export type InvoiceItemType = 'ACTIVATION' | 'SUBSCRIPTION' | 'ADDON' | 'ADJUSTMENT' | 'DISCOUNT';

export const INVOICE_ITEM_TYPES: readonly InvoiceItemType[] = [
  'ACTIVATION',
  'SUBSCRIPTION',
  'ADDON',
  'ADJUSTMENT',
  'DISCOUNT',
] as const;

export interface InvoiceItem {
  readonly id: string;
  readonly storeId: string;
  readonly invoiceId: string;
  readonly type: InvoiceItemType;
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: string;
  readonly amount: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export interface Invoice {
  readonly id: string;
  readonly storeId: string;
  readonly subscriptionId: string | null;
  readonly invoiceNumber: string;
  readonly status: InvoiceStatus;
  readonly subtotal: string;
  readonly discount: string;
  readonly tax: string;
  readonly total: string;
  readonly currency: string; // 'IDR'
  readonly issuedAt: string;
  readonly dueAt: string;
  readonly paidAt: string | null;
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface InvoiceWithItems extends Invoice {
  readonly items: readonly InvoiceItem[];
}

export interface PublicInvoiceView {
  readonly id: string;
  readonly storeId: string;
  readonly subscriptionId: string | null;
  readonly invoiceNumber: string;
  readonly status: InvoiceStatus;
  readonly subtotal: string;
  readonly discount: string;
  readonly tax: string;
  readonly total: string;
  readonly formattedTotal: string;
  readonly currency: string;
  readonly issuedAt: string;
  readonly dueAt: string;
  readonly paidAt: string | null;
  readonly items: readonly InvoiceItem[];
}

// ============================================================================
// 4. BILLING PAYMENTS
// ============================================================================

export type BillingPaymentStatus =
  'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED';

export const BILLING_PAYMENT_STATUSES: readonly BillingPaymentStatus[] = [
  'PENDING',
  'PROCESSING',
  'PAID',
  'FAILED',
  'EXPIRED',
  'CANCELLED',
] as const;

export interface BillingPayment {
  readonly id: string;
  readonly storeId: string;
  readonly invoiceId: string;
  readonly provider: string; // e.g. 'BINTANG_MOCK_GATEWAY'
  readonly providerTransactionId: string | null;
  readonly amount: string;
  readonly currency: string; // 'IDR'
  readonly status: BillingPaymentStatus;
  readonly paymentUrl: string | null;
  readonly paidAt: string | null;
  readonly expiredAt: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PublicBillingPaymentView {
  readonly id: string;
  readonly storeId: string;
  readonly invoiceId: string;
  readonly provider: string;
  readonly amount: string;
  readonly formattedAmount: string;
  readonly currency: string;
  readonly status: BillingPaymentStatus;
  readonly paymentUrl: string | null;
  readonly paidAt: string | null;
}

// ============================================================================
// 5. ADDONS & STORE ADDONS
// ============================================================================

export type AddonStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type StoreAddonStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';

export interface Addon {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description?: string | null;
  readonly monthlyPrice: string;
  readonly status: AddonStatus;
  readonly configuration: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export interface StoreAddon {
  readonly id: string;
  readonly storeId: string;
  readonly addonId: string;
  readonly status: StoreAddonStatus;
  readonly activatedAt: string;
  readonly expiresAt: string | null;
  readonly configuration: Readonly<Record<string, unknown>>;
}

// ============================================================================
// 6. ONBOARDING SESSION & STATE MACHINE
// ============================================================================

export type OnboardingStatus =
  | 'NOT_STARTED'
  | 'ACCOUNT_CREATED'
  | 'PLAN_SELECTED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_CONFIRMED'
  | 'PROVISIONING'
  | 'STORE_READY'
  | 'CONFIGURATION'
  | 'COMPLETED';

export const ONBOARDING_STATUSES: readonly OnboardingStatus[] = [
  'NOT_STARTED',
  'ACCOUNT_CREATED',
  'PLAN_SELECTED',
  'PAYMENT_PENDING',
  'PAYMENT_CONFIRMED',
  'PROVISIONING',
  'STORE_READY',
  'CONFIGURATION',
  'COMPLETED',
] as const;

export interface OnboardingChecklist {
  readonly accountCreated: boolean;
  readonly planSelected: boolean;
  readonly paymentConfirmed: boolean;
  readonly storeProvisioned: boolean;
  readonly templateApplied: boolean;
  readonly firstProductConfigured: boolean;
  readonly channelConfigured: boolean;
}

export interface OnboardingSession {
  readonly id: string;
  readonly userId: string;
  readonly storeId: string | null;
  readonly status: OnboardingStatus;
  readonly selectedPlanSlug: string | null;
  readonly subscriptionId: string | null;
  readonly invoiceId: string | null;
  readonly billingPaymentId: string | null;
  readonly checklist: OnboardingChecklist;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ============================================================================
// 7. STORE PROVISIONING WORKFLOW
// ============================================================================

export type ProvisioningStatus =
  | 'PROVISIONING_PENDING'
  | 'PROVISIONING_IN_PROGRESS'
  | 'PROVISIONING_FAILED'
  | 'PROVISIONING_COMPLETED';

export interface ProvisioningRecord {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly storeId: string;
  readonly userId: string;
  readonly status: ProvisioningStatus;
  readonly stepsCompleted: readonly string[];
  readonly failureReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProvisionStoreInput {
  readonly userId: string;
  readonly storeName: string;
  readonly storeSlug: string;
  readonly planSlug: string;
  readonly idempotencyKey: string;
  readonly templateVersionId?: string | null;
}

// ============================================================================
// 8. WEBHOOKS & ADAPTERS
// ============================================================================

export interface BillingWebhookEvent {
  readonly eventId: string;
  readonly providerId: string;
  readonly eventType: 'payment.succeeded' | 'payment.failed' | 'payment.expired' | string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly signature?: string;
  readonly timestamp: string;
}

export interface WebhookProcessingResult {
  readonly processed: boolean;
  readonly alreadyProcessed: boolean;
  readonly paymentId: string;
  readonly status: BillingPaymentStatus;
  readonly activatedSubscriptionId?: string | undefined;
}

// ============================================================================
// 9. SERVICE INPUTS & CALLERS
// ============================================================================

export interface BillingCaller {
  readonly type: 'SELLER' | 'PLATFORM';
  readonly userId: string;
  readonly storeId?: string;
  readonly role?: StoreRole;
}

export interface SelectPlanInput {
  readonly planSlug: string;
  readonly storeName?: string;
  readonly storeSlug?: string;
}

export interface CreateSubscriptionInput {
  readonly storeId: string;
  readonly planSlug: string;
  readonly idempotencyKey?: string;
}

export interface CreateBillingPaymentInput {
  readonly invoiceId: string;
  readonly provider?: string;
  readonly idempotencyKey?: string;
}

/**
 * Bintang Tech Studio — State Machine Validation for Billing & Onboarding.
 * Baseline: Milestone M13 Billing + Customer Onboarding Foundation.
 */

import {
  SubscriptionStatus,
  InvoiceStatus,
  BillingPaymentStatus,
  OnboardingStatus,
  ProvisioningStatus,
} from './types.js';
import {
  SubscriptionStateTransitionError,
  InvoiceStateTransitionError,
  BillingPaymentStateTransitionError,
  OnboardingInvalidStateTransitionError,
} from './errors.js';

// ============================================================================
// 1. SUBSCRIPTION STATE MACHINE
// ============================================================================

const VALID_SUBSCRIPTION_TRANSITIONS: Record<
  SubscriptionStatus,
  ReadonlySet<SubscriptionStatus>
> = {
  TRIAL: new Set(['ACTIVE', 'CANCELLED', 'EXPIRED']),
  ACTIVE: new Set(['PAST_DUE', 'CANCELLED', 'SUSPENDED', 'EXPIRED']),
  PAST_DUE: new Set(['ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED']),
  SUSPENDED: new Set(['ACTIVE', 'CANCELLED', 'EXPIRED']),
  CANCELLED: new Set(),
  EXPIRED: new Set(),
};

export function validateSubscriptionStateTransition(
  fromStatus: SubscriptionStatus,
  toStatus: SubscriptionStatus,
): void {
  if (fromStatus === toStatus) return;
  const allowed = VALID_SUBSCRIPTION_TRANSITIONS[fromStatus];
  if (!allowed || !allowed.has(toStatus)) {
    throw new SubscriptionStateTransitionError(fromStatus, toStatus);
  }
}

// ============================================================================
// 2. INVOICE STATE MACHINE
// ============================================================================

const VALID_INVOICE_TRANSITIONS: Record<InvoiceStatus, ReadonlySet<InvoiceStatus>> = {
  DRAFT: new Set(['PENDING', 'VOID']),
  PENDING: new Set(['PAID', 'VOID', 'UNCOLLECTIBLE']),
  PAID: new Set(), // Paid invoices are financially immutable
  VOID: new Set(),
  UNCOLLECTIBLE: new Set(),
};

export function validateInvoiceStateTransition(
  fromStatus: InvoiceStatus,
  toStatus: InvoiceStatus,
): void {
  if (fromStatus === toStatus) return;
  const allowed = VALID_INVOICE_TRANSITIONS[fromStatus];
  if (!allowed || !allowed.has(toStatus)) {
    throw new InvoiceStateTransitionError(fromStatus, toStatus);
  }
}

// ============================================================================
// 3. BILLING PAYMENT STATE MACHINE
// ============================================================================

const VALID_BILLING_PAYMENT_TRANSITIONS: Record<
  BillingPaymentStatus,
  ReadonlySet<BillingPaymentStatus>
> = {
  PENDING: new Set(['PROCESSING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED']),
  PROCESSING: new Set(['PAID', 'FAILED', 'EXPIRED', 'CANCELLED']),
  PAID: new Set(),
  FAILED: new Set(),
  EXPIRED: new Set(),
  CANCELLED: new Set(),
};

export function validateBillingPaymentStateTransition(
  fromStatus: BillingPaymentStatus,
  toStatus: BillingPaymentStatus,
): void {
  if (fromStatus === toStatus) return;
  const allowed = VALID_BILLING_PAYMENT_TRANSITIONS[fromStatus];
  if (!allowed || !allowed.has(toStatus)) {
    throw new BillingPaymentStateTransitionError(fromStatus, toStatus);
  }
}

// ============================================================================
// 4. ONBOARDING STATE MACHINE
// ============================================================================

const VALID_ONBOARDING_TRANSITIONS: Record<OnboardingStatus, ReadonlySet<OnboardingStatus>> = {
  NOT_STARTED: new Set(['ACCOUNT_CREATED']),
  ACCOUNT_CREATED: new Set(['PLAN_SELECTED']),
  PLAN_SELECTED: new Set(['PAYMENT_PENDING']),
  PAYMENT_PENDING: new Set(['PAYMENT_CONFIRMED', 'PLAN_SELECTED']),
  PAYMENT_CONFIRMED: new Set(['PROVISIONING']),
  PROVISIONING: new Set(['STORE_READY', 'PROVISIONING']),
  STORE_READY: new Set(['CONFIGURATION', 'COMPLETED']),
  CONFIGURATION: new Set(['COMPLETED']),
  COMPLETED: new Set(),
};

export function validateOnboardingStateTransition(
  fromStatus: OnboardingStatus,
  toStatus: OnboardingStatus,
): void {
  if (fromStatus === toStatus) return;
  const allowed = VALID_ONBOARDING_TRANSITIONS[fromStatus];
  if (!allowed || !allowed.has(toStatus)) {
    throw new OnboardingInvalidStateTransitionError(fromStatus, toStatus);
  }
}

// ============================================================================
// 5. PROVISIONING STATE MACHINE
// ============================================================================

const VALID_PROVISIONING_TRANSITIONS: Record<
  ProvisioningStatus,
  ReadonlySet<ProvisioningStatus>
> = {
  PROVISIONING_PENDING: new Set(['PROVISIONING_IN_PROGRESS']),
  PROVISIONING_IN_PROGRESS: new Set(['PROVISIONING_COMPLETED', 'PROVISIONING_FAILED']),
  PROVISIONING_FAILED: new Set(['PROVISIONING_IN_PROGRESS']), // Safe retry
  PROVISIONING_COMPLETED: new Set(),
};

export function validateProvisioningStateTransition(
  fromStatus: ProvisioningStatus,
  toStatus: ProvisioningStatus,
): boolean {
  if (fromStatus === toStatus) return true;
  const allowed = VALID_PROVISIONING_TRANSITIONS[fromStatus];
  return Boolean(allowed && allowed.has(toStatus));
}

// ============================================================================
// 6. UUID GENERATION
// ============================================================================

export function generateUUID(prefix = ''): string {
  const chars = '0123456789abcdef';
  let uuid = '';
  for (let i = 0; i < 32; i++) {
    if (i === 8 || i === 12 || i === 16 || i === 20) {
      uuid += '-';
    }
    uuid += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return prefix ? `${prefix}_${uuid}` : uuid;
}

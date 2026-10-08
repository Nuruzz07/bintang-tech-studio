import { PaymentIntentStatus, PaymentAttemptStatus } from './types.js';
import { PaymentStateTransitionError, PaymentError } from './errors.js';
import { normalizeMoney } from './money.js';

const VALID_INTENT_TRANSITIONS: Record<PaymentIntentStatus, ReadonlySet<PaymentIntentStatus>> = {
  PENDING: new Set<PaymentIntentStatus>([
    'PROCESSING',
    'SUCCEEDED',
    'FAILED',
    'EXPIRED',
    'CANCELLED',
  ]),
  PROCESSING: new Set<PaymentIntentStatus>(['SUCCEEDED', 'FAILED', 'CANCELLED']),
  SUCCEEDED: new Set<PaymentIntentStatus>(['REFUNDED', 'PARTIALLY_REFUNDED']),
  PARTIALLY_REFUNDED: new Set<PaymentIntentStatus>(['REFUNDED']),
  FAILED: new Set<PaymentIntentStatus>(['PENDING']), // Retry permitted under same intent
  EXPIRED: new Set<PaymentIntentStatus>(),
  CANCELLED: new Set<PaymentIntentStatus>(),
  REFUNDED: new Set<PaymentIntentStatus>(),
};

const VALID_ATTEMPT_TRANSITIONS: Record<PaymentAttemptStatus, ReadonlySet<PaymentAttemptStatus>> = {
  PENDING: new Set<PaymentAttemptStatus>([
    'PROCESSING',
    'SUCCEEDED',
    'FAILED',
    'EXPIRED',
    'CANCELLED',
  ]),
  PROCESSING: new Set<PaymentAttemptStatus>(['SUCCEEDED', 'FAILED', 'CANCELLED']),
  SUCCEEDED: new Set<PaymentAttemptStatus>(),
  FAILED: new Set<PaymentAttemptStatus>(),
  EXPIRED: new Set<PaymentAttemptStatus>(),
  CANCELLED: new Set<PaymentAttemptStatus>(),
};

/**
 * Validates state transition for PaymentIntent.
 * Throws PaymentStateTransitionError if transition is disallowed.
 */
export function validatePaymentIntentStateTransition(
  currentStatus: PaymentIntentStatus,
  targetStatus: PaymentIntentStatus,
): void {
  if (currentStatus === targetStatus) {
    return;
  }

  const allowed = VALID_INTENT_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.has(targetStatus)) {
    throw new PaymentStateTransitionError(
      currentStatus,
      targetStatus,
      `State "${currentStatus}" cannot transition to "${targetStatus}"`,
    );
  }
}

/**
 * Validates state transition for PaymentAttempt.
 * Throws PaymentStateTransitionError if transition is disallowed.
 */
export function validatePaymentAttemptStateTransition(
  currentStatus: PaymentAttemptStatus,
  targetStatus: PaymentAttemptStatus,
): void {
  if (currentStatus === targetStatus) {
    return;
  }

  const allowed = VALID_ATTEMPT_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.has(targetStatus)) {
    throw new PaymentStateTransitionError(
      currentStatus,
      targetStatus,
      `Payment attempt state "${currentStatus}" cannot transition to "${targetStatus}"`,
    );
  }
}

/**
 * Validates that an amount string is positive and non-zero (> 0.00).
 */
export function validatePositiveAmount(amount: string | number, fieldName = 'amount'): string {
  const normalized = normalizeMoney(amount, fieldName);
  if (normalized === '0.00') {
    throw new PaymentError(`${fieldName} must be strictly greater than zero`);
  }
  return normalized;
}

/**
 * Generates an RFC4122 version 4 UUID.
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

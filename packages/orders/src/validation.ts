import {
  InvalidOrderQuantityError,
  InvalidOrderStateTransitionError,
  OrderAlreadyCancelledError,
  OrderAlreadyFulfilledError,
} from './errors.js';
import { OrderStatus } from './types.js';

/**
 * Validates that an order line quantity is a strictly positive finite integer (> 0).
 */
export function validateOrderQuantity(quantity: number, fieldName = 'quantity'): number {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || Number.isNaN(quantity)) {
    throw new InvalidOrderQuantityError(`${fieldName} must be a valid finite number`);
  }
  if (!Number.isInteger(quantity)) {
    throw new InvalidOrderQuantityError(`${fieldName} must be an integer`);
  }
  if (quantity <= 0) {
    throw new InvalidOrderQuantityError(`${fieldName} must be strictly greater than zero`);
  }
  return quantity;
}

/**
 * Valid transitions map for order lifecycle state machine.
 */
const VALID_TRANSITIONS: Record<OrderStatus, ReadonlySet<OrderStatus>> = {
  PENDING_PAYMENT: new Set<OrderStatus>(['PAID', 'CANCELLED', 'EXPIRED', 'FAILED']),
  PAID: new Set<OrderStatus>(['PROCESSING', 'CANCELLED']),
  PROCESSING: new Set<OrderStatus>(['FULFILLED', 'CANCELLED', 'FAILED']),
  FULFILLED: new Set<OrderStatus>(),
  CANCELLED: new Set<OrderStatus>(),
  EXPIRED: new Set<OrderStatus>(),
  FAILED: new Set<OrderStatus>(),
};

/**
 * Validates whether a state transition is permitted.
 * Throws domain-specific error on violation.
 */
export function validateOrderStateTransition(
  currentStatus: OrderStatus,
  targetStatus: OrderStatus,
): void {
  if (currentStatus === targetStatus) {
    return;
  }

  if (currentStatus === 'CANCELLED') {
    throw new OrderAlreadyCancelledError(`Order is already CANCELLED`);
  }

  if (currentStatus === 'FULFILLED') {
    throw new OrderAlreadyFulfilledError(`Order is already FULFILLED`);
  }

  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.has(targetStatus)) {
    throw new InvalidOrderStateTransitionError(
      currentStatus,
      targetStatus,
      `State "${currentStatus}" cannot transition to "${targetStatus}"`,
    );
  }
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

/**
 * Generates a stable, human-readable, non-enumerable order reference (e.g. "ORD-20261007-7K9M2P").
 */
export function generateOrderNumber(date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const datePart = `${yyyy}${mm}${dd}`;

  // 6 random uppercase alphanumeric characters (excluding ambiguous chars)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `ORD-${datePart}-${rand}`;
}

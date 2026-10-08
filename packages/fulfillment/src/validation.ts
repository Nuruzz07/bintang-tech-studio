import {
  FulfillmentStatus,
  FulfillmentItemStatus,
  FulfillmentStrategy,
  FULFILLMENT_STRATEGIES,
  FULFILLMENT_STATUSES,
  FULFILLMENT_ITEM_STATUSES,
} from './types.js';
import {
  FulfillmentError,
  FulfillmentStateTransitionError,
  FulfillmentItemStateTransitionError,
} from './errors.js';

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function validateFulfillmentStrategy(
  strategy: string,
): asserts strategy is FulfillmentStrategy {
  if (!FULFILLMENT_STRATEGIES.includes(strategy as FulfillmentStrategy)) {
    throw new FulfillmentError(`Invalid fulfillment strategy: "${strategy}"`);
  }
}

export function validateFulfillmentStatus(status: string): asserts status is FulfillmentStatus {
  if (!FULFILLMENT_STATUSES.includes(status as FulfillmentStatus)) {
    throw new FulfillmentError(`Invalid fulfillment status: "${status}"`);
  }
}

export function validateFulfillmentItemStatus(
  status: string,
): asserts status is FulfillmentItemStatus {
  if (!FULFILLMENT_ITEM_STATUSES.includes(status as FulfillmentItemStatus)) {
    throw new FulfillmentError(`Invalid fulfillment item status: "${status}"`);
  }
}

const ALLOWED_FULFILLMENT_TRANSITIONS: Readonly<
  Record<FulfillmentStatus, readonly FulfillmentStatus[]>
> = {
  PENDING: ['PROCESSING', 'FAILED', 'CANCELLED'],
  PROCESSING: ['FULFILLED', 'FAILED', 'MANUAL_REVIEW', 'CANCELLED'],
  FAILED: ['PROCESSING', 'CANCELLED'],
  MANUAL_REVIEW: ['PROCESSING', 'FULFILLED', 'CANCELLED'],
  FULFILLED: [], // Terminal immutable state
  CANCELLED: [], // Terminal immutable state
};

export function validateFulfillmentStateTransition(
  current: FulfillmentStatus,
  target: FulfillmentStatus,
): void {
  if (current === target) {
    return;
  }

  const allowed = ALLOWED_FULFILLMENT_TRANSITIONS[current];
  if (!allowed || !allowed.includes(target)) {
    if (current === 'FULFILLED') {
      throw new FulfillmentStateTransitionError(
        current,
        target,
        'Fulfillment is already FULFILLED and cannot transition to any other status',
      );
    }
    if (current === 'CANCELLED') {
      throw new FulfillmentStateTransitionError(
        current,
        target,
        'Fulfillment is CANCELLED and cannot transition to any other status',
      );
    }
    throw new FulfillmentStateTransitionError(current, target);
  }
}

const ALLOWED_ITEM_TRANSITIONS: Readonly<
  Record<FulfillmentItemStatus, readonly FulfillmentItemStatus[]>
> = {
  PENDING: ['DELIVERED', 'FAILED', 'REVOKED'],
  FAILED: ['PENDING', 'DELIVERED', 'REVOKED'],
  DELIVERED: ['REVOKED'],
  REVOKED: [], // Terminal
};

export function validateFulfillmentItemStateTransition(
  current: FulfillmentItemStatus,
  target: FulfillmentItemStatus,
): void {
  if (current === target) {
    return;
  }

  const allowed = ALLOWED_ITEM_TRANSITIONS[current];
  if (!allowed || !allowed.includes(target)) {
    throw new FulfillmentItemStateTransitionError(current, target);
  }
}

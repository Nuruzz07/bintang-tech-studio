import { describe, it, expect } from 'vitest';
import {
  validateFulfillmentStateTransition,
  validateFulfillmentItemStateTransition,
  FulfillmentStateTransitionError,
  FulfillmentItemStateTransitionError,
  InMemoryFulfillmentRepository,
  Fulfillment,
  generateUUID,
} from '../src/index.js';

describe('M09 Fulfillment State Machine Suite', () => {
  describe('Fulfillment Aggregate State Transitions', () => {
    it('allows valid transitions from PENDING', () => {
      expect(() => validateFulfillmentStateTransition('PENDING', 'PROCESSING')).not.toThrow();
      expect(() => validateFulfillmentStateTransition('PENDING', 'FAILED')).not.toThrow();
      expect(() => validateFulfillmentStateTransition('PENDING', 'CANCELLED')).not.toThrow();
    });

    it('allows valid transitions from PROCESSING', () => {
      expect(() => validateFulfillmentStateTransition('PROCESSING', 'FULFILLED')).not.toThrow();
      expect(() => validateFulfillmentStateTransition('PROCESSING', 'FAILED')).not.toThrow();
      expect(() => validateFulfillmentStateTransition('PROCESSING', 'MANUAL_REVIEW')).not.toThrow();
      expect(() => validateFulfillmentStateTransition('PROCESSING', 'CANCELLED')).not.toThrow();
    });

    it('allows valid transitions from FAILED (retry or cancellation)', () => {
      expect(() => validateFulfillmentStateTransition('FAILED', 'PROCESSING')).not.toThrow();
      expect(() => validateFulfillmentStateTransition('FAILED', 'CANCELLED')).not.toThrow();
    });

    it('allows valid transitions from MANUAL_REVIEW', () => {
      expect(() => validateFulfillmentStateTransition('MANUAL_REVIEW', 'PROCESSING')).not.toThrow();
      expect(() => validateFulfillmentStateTransition('MANUAL_REVIEW', 'FULFILLED')).not.toThrow();
      expect(() => validateFulfillmentStateTransition('MANUAL_REVIEW', 'CANCELLED')).not.toThrow();
    });

    it('disallows direct PENDING to FULFILLED without PROCESSING', () => {
      expect(() => validateFulfillmentStateTransition('PENDING', 'FULFILLED')).toThrow(
        FulfillmentStateTransitionError,
      );
    });

    it('disallows direct PENDING to MANUAL_REVIEW', () => {
      expect(() => validateFulfillmentStateTransition('PENDING', 'MANUAL_REVIEW')).toThrow(
        FulfillmentStateTransitionError,
      );
    });

    it('enforces FULFILLED as terminal immutable state', () => {
      const targets = ['PENDING', 'PROCESSING', 'FAILED', 'MANUAL_REVIEW', 'CANCELLED'] as const;
      for (const target of targets) {
        expect(() => validateFulfillmentStateTransition('FULFILLED', target)).toThrow(
          FulfillmentStateTransitionError,
        );
      }
    });

    it('enforces CANCELLED as terminal immutable state', () => {
      const targets = ['PENDING', 'PROCESSING', 'FULFILLED', 'FAILED', 'MANUAL_REVIEW'] as const;
      for (const target of targets) {
        expect(() => validateFulfillmentStateTransition('CANCELLED', target)).toThrow(
          FulfillmentStateTransitionError,
        );
      }
    });

    it('idempotently allows self-transition without throwing', () => {
      expect(() => validateFulfillmentStateTransition('PENDING', 'PENDING')).not.toThrow();
      expect(() => validateFulfillmentStateTransition('PROCESSING', 'PROCESSING')).not.toThrow();
      expect(() => validateFulfillmentStateTransition('FULFILLED', 'FULFILLED')).not.toThrow();
    });
  });

  describe('Fulfillment Line Item State Transitions', () => {
    it('allows valid item transitions from PENDING', () => {
      expect(() => validateFulfillmentItemStateTransition('PENDING', 'DELIVERED')).not.toThrow();
      expect(() => validateFulfillmentItemStateTransition('PENDING', 'FAILED')).not.toThrow();
      expect(() => validateFulfillmentItemStateTransition('PENDING', 'REVOKED')).not.toThrow();
    });

    it('allows valid item transitions from DELIVERED', () => {
      expect(() => validateFulfillmentItemStateTransition('DELIVERED', 'REVOKED')).not.toThrow();
    });

    it('allows valid item transitions from FAILED (retry)', () => {
      expect(() => validateFulfillmentItemStateTransition('FAILED', 'PENDING')).not.toThrow();
      expect(() => validateFulfillmentItemStateTransition('FAILED', 'DELIVERED')).not.toThrow();
      expect(() => validateFulfillmentItemStateTransition('FAILED', 'REVOKED')).not.toThrow();
    });

    it('enforces REVOKED as terminal immutable state for items', () => {
      const targets = ['PENDING', 'DELIVERED', 'FAILED'] as const;
      for (const target of targets) {
        expect(() => validateFulfillmentItemStateTransition('REVOKED', target)).toThrow(
          FulfillmentItemStateTransitionError,
        );
      }
    });
  });

  describe('Repository-enforced state transitions', () => {
    it('rejects illegal status update at the repository layer', async () => {
      const repo = new InMemoryFulfillmentRepository();
      const storeId = 'store_sm_test';
      const fulfillmentId = generateUUID();
      const now = new Date().toISOString();

      const f: Fulfillment = {
        id: fulfillmentId,
        storeId,
        orderId: 'order_sm_1',
        strategy: 'DIGITAL_AUTO',
        status: 'PENDING',
        trackingInfo: {},
        failureReason: null,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      };

      await repo.create(storeId, f, []);

      // Illegal transition PENDING -> FULFILLED directly
      await expect(repo.updateStatus(storeId, fulfillmentId, 'FULFILLED')).rejects.toThrow(
        FulfillmentStateTransitionError,
      );

      // Transition to PROCESSING then FULFILLED succeeds
      await repo.updateStatus(storeId, fulfillmentId, 'PROCESSING');
      const fulfilled = await repo.updateStatus(storeId, fulfillmentId, 'FULFILLED');
      expect(fulfilled.status).toBe('FULFILLED');

      // Attempting to transition from FULFILLED to CANCELLED throws
      await expect(repo.updateStatus(storeId, fulfillmentId, 'CANCELLED')).rejects.toThrow(
        FulfillmentStateTransitionError,
      );
    });
  });
});

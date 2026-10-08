import { describe, it, expect } from 'vitest';
import {
  validatePaymentIntentStateTransition,
  validatePaymentAttemptStateTransition,
} from '../src/validation.js';
import { PaymentStateTransitionError } from '../src/errors.js';
import { InMemoryPaymentIntentRepository } from '../src/memory-repository.js';
import { PaymentIntent } from '../src/types.js';

describe('M08 Payment State Machine & Invariant Suite', () => {
  describe('PaymentIntent State Transitions', () => {
    it('allows valid intent progressions from PENDING', () => {
      expect(() => validatePaymentIntentStateTransition('PENDING', 'PROCESSING')).not.toThrow();
      expect(() => validatePaymentIntentStateTransition('PENDING', 'SUCCEEDED')).not.toThrow();
      expect(() => validatePaymentIntentStateTransition('PENDING', 'FAILED')).not.toThrow();
      expect(() => validatePaymentIntentStateTransition('PENDING', 'EXPIRED')).not.toThrow();
      expect(() => validatePaymentIntentStateTransition('PENDING', 'CANCELLED')).not.toThrow();
      expect(() => validatePaymentIntentStateTransition('PENDING', 'PENDING')).not.toThrow();
    });

    it('allows valid intent progressions from PROCESSING', () => {
      expect(() => validatePaymentIntentStateTransition('PROCESSING', 'SUCCEEDED')).not.toThrow();
      expect(() => validatePaymentIntentStateTransition('PROCESSING', 'FAILED')).not.toThrow();
      expect(() => validatePaymentIntentStateTransition('PROCESSING', 'CANCELLED')).not.toThrow();
    });

    it('allows refund progression from SUCCEEDED', () => {
      expect(() => validatePaymentIntentStateTransition('SUCCEEDED', 'REFUNDED')).not.toThrow();
      expect(() =>
        validatePaymentIntentStateTransition('SUCCEEDED', 'PARTIALLY_REFUNDED'),
      ).not.toThrow();
    });

    it('allows full refund after PARTIALLY_REFUNDED', () => {
      expect(() =>
        validatePaymentIntentStateTransition('PARTIALLY_REFUNDED', 'REFUNDED'),
      ).not.toThrow();
    });

    it('allows retry from FAILED back to PENDING', () => {
      expect(() => validatePaymentIntentStateTransition('FAILED', 'PENDING')).not.toThrow();
    });

    it('STRICTLY rejects invalid direct transition from PENDING to REFUNDED', () => {
      expect(() => validatePaymentIntentStateTransition('PENDING', 'REFUNDED')).toThrow(
        PaymentStateTransitionError,
      );
    });

    it('STRICTLY rejects transitions out of terminal CANCELLED state', () => {
      expect(() => validatePaymentIntentStateTransition('CANCELLED', 'SUCCEEDED')).toThrow(
        PaymentStateTransitionError,
      );
      expect(() => validatePaymentIntentStateTransition('CANCELLED', 'PROCESSING')).toThrow(
        PaymentStateTransitionError,
      );
      expect(() => validatePaymentIntentStateTransition('CANCELLED', 'PENDING')).toThrow(
        PaymentStateTransitionError,
      );
    });

    it('STRICTLY rejects transitions out of terminal EXPIRED state', () => {
      expect(() => validatePaymentIntentStateTransition('EXPIRED', 'SUCCEEDED')).toThrow(
        PaymentStateTransitionError,
      );
      expect(() => validatePaymentIntentStateTransition('EXPIRED', 'PROCESSING')).toThrow(
        PaymentStateTransitionError,
      );
    });

    it('STRICTLY rejects transitions out of terminal REFUNDED state', () => {
      expect(() => validatePaymentIntentStateTransition('REFUNDED', 'SUCCEEDED')).toThrow(
        PaymentStateTransitionError,
      );
      expect(() => validatePaymentIntentStateTransition('REFUNDED', 'PENDING')).toThrow(
        PaymentStateTransitionError,
      );
    });
  });

  describe('PaymentAttempt State Transitions', () => {
    it('allows valid attempt progression from PENDING', () => {
      expect(() => validatePaymentAttemptStateTransition('PENDING', 'PROCESSING')).not.toThrow();
      expect(() => validatePaymentAttemptStateTransition('PENDING', 'SUCCEEDED')).not.toThrow();
      expect(() => validatePaymentAttemptStateTransition('PENDING', 'FAILED')).not.toThrow();
      expect(() => validatePaymentAttemptStateTransition('PENDING', 'CANCELLED')).not.toThrow();
      expect(() => validatePaymentAttemptStateTransition('PENDING', 'EXPIRED')).not.toThrow();
    });

    it('allows valid attempt progression from PROCESSING', () => {
      expect(() => validatePaymentAttemptStateTransition('PROCESSING', 'SUCCEEDED')).not.toThrow();
      expect(() => validatePaymentAttemptStateTransition('PROCESSING', 'FAILED')).not.toThrow();
      expect(() => validatePaymentAttemptStateTransition('PROCESSING', 'CANCELLED')).not.toThrow();
    });

    it('STRICTLY rejects attempts escaping terminal SUCCEEDED', () => {
      expect(() => validatePaymentAttemptStateTransition('SUCCEEDED', 'FAILED')).toThrow(
        PaymentStateTransitionError,
      );
      expect(() => validatePaymentAttemptStateTransition('SUCCEEDED', 'PROCESSING')).toThrow(
        PaymentStateTransitionError,
      );
    });

    it('STRICTLY rejects attempts escaping terminal FAILED', () => {
      expect(() => validatePaymentAttemptStateTransition('FAILED', 'SUCCEEDED')).toThrow(
        PaymentStateTransitionError,
      );
      expect(() => validatePaymentAttemptStateTransition('FAILED', 'PROCESSING')).toThrow(
        PaymentStateTransitionError,
      );
    });
  });

  describe('Repository-Level State Machine Invariants', () => {
    it('InMemoryPaymentIntentRepository enforces state transition rules on updateStatus', async () => {
      const repo = new InMemoryPaymentIntentRepository();
      const storeId = 'store_sm_1';
      const intent: PaymentIntent = {
        id: 'pi_sm_1',
        storeId,
        orderId: 'order_sm_1',
        paymentAccountId: 'pa_sm_1',
        amount: '100000.00',
        currency: 'IDR',
        status: 'PENDING',
        customerEmail: 'cust@test.local',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await repo.create(storeId, intent);

      // Illegal transition: PENDING -> REFUNDED directly
      await expect(repo.updateStatus(storeId, intent.id, 'REFUNDED')).rejects.toThrow(
        PaymentStateTransitionError,
      );

      // Legal transition: PENDING -> PROCESSING -> SUCCEEDED
      const processing = await repo.updateStatus(storeId, intent.id, 'PROCESSING');
      expect(processing.status).toBe('PROCESSING');

      const succeeded = await repo.updateStatus(storeId, intent.id, 'SUCCEEDED');
      expect(succeeded.status).toBe('SUCCEEDED');

      // Illegal transition: SUCCEEDED -> CANCELLED
      await expect(repo.updateStatus(storeId, intent.id, 'CANCELLED')).rejects.toThrow(
        PaymentStateTransitionError,
      );
    });
  });
});

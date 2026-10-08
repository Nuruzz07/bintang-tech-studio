import { describe, it, expect, beforeEach } from 'vitest';
import { createTestHarness, setupProductAndOrder, TestHarness } from './test-helpers.js';
import { FulfillmentAlreadyExistsError, FulfillmentAlreadyCompletedError } from '../src/index.js';

describe('M09 Fulfillment Concurrency & Race Condition Suite', () => {
  let h: TestHarness;

  beforeEach(() => {
    h = createTestHarness();
  });

  it('serializes concurrent createFulfillment calls for the same order so exactly ONE succeeds', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });

    // Fire 5 concurrent creation attempts
    const results = await Promise.allSettled(
      Array.from({ length: 5 }).map(() =>
        h.fulfillmentService.createFulfillment(
          { type: 'SELLER', context: h.sellerContext },
          { orderId: order.id },
        ),
      ),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(4);

    for (const rej of rejected) {
      if (rej.status === 'rejected') {
        expect(rej.reason).toBeInstanceOf(FulfillmentAlreadyExistsError);
      }
    }

    // Verify exactly one fulfillment exists in repository
    const all = await h.fulfillmentRepo.findByOrderId(h.storeId, order.id);
    expect(all).toHaveLength(1);
  });

  it('serializes concurrent executeFulfillment calls preventing duplicate delivery', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });

    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    // Fire 2 concurrent execution attempts without idempotency key
    const results = await Promise.allSettled([
      h.fulfillmentService.executeFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { fulfillmentId: f.id },
      ),
      h.fulfillmentService.executeFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { fulfillmentId: f.id },
      ),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    if (rejected[0]?.status === 'rejected') {
      expect(rejected[0].reason).toBeInstanceOf(FulfillmentAlreadyCompletedError);
    }

    // Provider delivery should only have executed ONCE
    expect(h.mockProvider.deliveryCalls).toHaveLength(1);
  });
});

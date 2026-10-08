import { describe, it, expect, beforeEach } from 'vitest';
import { createTestHarness, setupProductAndOrder, TestHarness } from './test-helpers.js';
import { FulfillmentRetryNotAllowedError, FulfillmentExecutionError } from '../src/index.js';

describe('M09 Fulfillment Retry & Error Recovery Suite', () => {
  let h: TestHarness;

  beforeEach(() => {
    h = createTestHarness();
  });

  it('rejects retrying a PENDING fulfillment', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });
    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    await expect(
      h.fulfillmentService.retryFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { fulfillmentId: f.id },
      ),
    ).rejects.toThrow(FulfillmentRetryNotAllowedError);
  });

  it('rejects retrying an already FULFILLED fulfillment', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });
    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );
    await h.fulfillmentService.executeFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { fulfillmentId: f.id },
    );

    await expect(
      h.fulfillmentService.retryFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { fulfillmentId: f.id },
      ),
    ).rejects.toThrow(FulfillmentRetryNotAllowedError);
  });

  it('rejects retrying a CANCELLED fulfillment', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });
    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );
    await h.fulfillmentService.cancelFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      f.id,
    );

    await expect(
      h.fulfillmentService.retryFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { fulfillmentId: f.id },
      ),
    ).rejects.toThrow(FulfillmentRetryNotAllowedError);
  });

  it('successfully recovers a FAILED fulfillment on retry', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });
    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    // Cause failure
    h.mockProvider.setShouldFail(true, {
      failureCode: 'UPSTREAM_503',
      failureReason: 'Provider temporarily unavailable',
      retryable: true,
    });

    await expect(
      h.fulfillmentService.executeFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { fulfillmentId: f.id },
      ),
    ).rejects.toThrow(FulfillmentExecutionError);

    // Verify status is FAILED and items are FAILED
    const failedF = await h.fulfillmentRepo.findById(h.storeId, f.id);
    expect(failedF?.status).toBe('FAILED');
    expect(failedF?.items[0]?.status).toBe('FAILED');

    // Resolve provider failure
    h.mockProvider.setShouldFail(false);

    // Retry fulfillment
    const retried = await h.fulfillmentService.retryFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { fulfillmentId: f.id },
    );

    expect(retried.status).toBe('FULFILLED');
    expect(retried.failureReason).toBeNull();
    expect(retried.items[0]?.status).toBe('DELIVERED');

    // Verify order also reached FULFILLED
    const refreshedOrder = await h.orderRepo.findById(h.storeId, order.id);
    expect(refreshedOrder?.status).toBe('FULFILLED');
  });

  it('allows retrying a MANUAL_REVIEW fulfillment after resolving manual holds', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });
    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    // Non-retryable error puts it into MANUAL_REVIEW
    h.mockProvider.setShouldFail(true, {
      failureCode: 'SUSPICIOUS_PAYLOAD',
      failureReason: 'Held for manual operator review',
      retryable: false,
    });

    await expect(
      h.fulfillmentService.executeFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { fulfillmentId: f.id },
      ),
    ).rejects.toThrow();

    const held = await h.fulfillmentRepo.findById(h.storeId, f.id);
    expect(held?.status).toBe('MANUAL_REVIEW');

    // Operator clears hold, mock provider succeeding
    h.mockProvider.setShouldFail(false);

    const resolved = await h.fulfillmentService.retryFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { fulfillmentId: f.id },
    );

    expect(resolved.status).toBe('FULFILLED');
  });

  it('preserves error details if retry execution fails again', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });
    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    h.mockProvider.setShouldFail(true, {
      failureCode: 'FIRST_ERR',
      failureReason: 'First failure',
      retryable: true,
    });

    await expect(
      h.fulfillmentService.executeFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { fulfillmentId: f.id },
      ),
    ).rejects.toThrow();

    // Second failure on retry with different reason
    h.mockProvider.setShouldFail(true, {
      failureCode: 'SECOND_ERR',
      failureReason: 'Second failure on retry',
      retryable: true,
    });

    await expect(
      h.fulfillmentService.retryFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { fulfillmentId: f.id },
      ),
    ).rejects.toThrow(FulfillmentExecutionError);

    const refreshed = await h.fulfillmentRepo.findById(h.storeId, f.id);
    expect(refreshed?.status).toBe('FAILED');
    expect(refreshed?.failureReason).toBe('Second failure on retry');
  });
});

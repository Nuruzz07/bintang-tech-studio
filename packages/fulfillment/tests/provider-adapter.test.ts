import { describe, it, expect, beforeEach } from 'vitest';
import { createTestHarness, setupProductAndOrder, TestHarness } from './test-helpers.js';
import { FulfillmentProviderUnsupportedError, FulfillmentExecutionError } from '../src/index.js';

describe('M09 Fulfillment Provider Adapter Suite', () => {
  let h: TestHarness;

  beforeEach(() => {
    h = createTestHarness();
  });

  it('delivers successfully via default mock provider adapter', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });

    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    const executed = await h.fulfillmentService.executeFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { fulfillmentId: f.id },
    );

    expect(executed.status).toBe('FULFILLED');
    expect(executed.trackingInfo).toMatchObject({
      provider: 'MOCK_DIGITAL',
      deliveredItemCount: 1,
    });
    expect(executed.items[0]?.status).toBe('DELIVERED');
    expect(executed.items[0]?.payloadReference).toContain('mock_delivery_payload_');
  });

  it('allows manual payloads to override provider-generated delivery payloads', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });

    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    const manualPayload = 'SPECIAL_VIP_LICENSE_KEY_12345';
    const executed = await h.fulfillmentService.executeFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      {
        fulfillmentId: f.id,
        manualPayloads: {
          [order.items[0]!.id]: manualPayload,
        },
      },
    );

    expect(executed.items[0]?.payloadReference).toBe(manualPayload);
  });

  it('handles retryable delivery failure by updating fulfillment to FAILED', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });

    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    h.mockProvider.setShouldFail(true, {
      failureCode: 'DISPATCH_TIMEOUT',
      failureReason: 'Delivery gateway timeout',
      retryable: true,
    });

    await expect(
      h.fulfillmentService.executeFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { fulfillmentId: f.id },
      ),
    ).rejects.toThrow(FulfillmentExecutionError);

    const refreshed = await h.fulfillmentRepo.findById(h.storeId, f.id);
    expect(refreshed?.status).toBe('FAILED');
    expect(refreshed?.failureReason).toBe('Delivery gateway timeout');
    expect(refreshed?.items[0]?.status).toBe('FAILED');
  });

  it('handles non-retryable delivery failure by updating fulfillment to MANUAL_REVIEW', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });

    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    h.mockProvider.setShouldFail(true, {
      failureCode: 'FRAUD_SUSPECTED',
      failureReason: 'Address flagged as invalid or fraudulent',
      retryable: false,
    });

    await expect(
      h.fulfillmentService.executeFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { fulfillmentId: f.id },
      ),
    ).rejects.toThrow(FulfillmentExecutionError);

    const refreshed = await h.fulfillmentRepo.findById(h.storeId, f.id);
    expect(refreshed?.status).toBe('MANUAL_REVIEW');
    expect(refreshed?.failureReason).toBe('Address flagged as invalid or fraudulent');
  });

  it('rejects execution when requested provider adapter is unsupported', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });

    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    await expect(
      h.fulfillmentService.executeFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { fulfillmentId: f.id, providerName: 'UNREGISTERED_PROVIDER' },
      ),
    ).rejects.toThrow(FulfillmentProviderUnsupportedError);
  });

  it('tracks delivery calls made to provider adapter', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });

    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    await h.fulfillmentService.executeFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { fulfillmentId: f.id },
    );

    expect(h.mockProvider.deliveryCalls).toHaveLength(1);
    expect(h.mockProvider.deliveryCalls[0]?.fulfillment.id).toBe(f.id);
    expect(h.mockProvider.deliveryCalls[0]?.order.id).toBe(order.id);
  });
});

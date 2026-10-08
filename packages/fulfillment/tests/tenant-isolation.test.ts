import { describe, it, expect, beforeEach } from 'vitest';
import { createTestHarness, setupProductAndOrder, TestHarness } from './test-helpers.js';
import {
  FulfillmentStoreMismatchError,
  FulfillmentNotFoundError,
  InMemoryFulfillmentRepository,
  Fulfillment,
  FulfillmentItem,
  generateUUID,
} from '../src/index.js';

describe('M09 Fulfillment Tenant Isolation Suite', () => {
  let hA: TestHarness;
  let hB: TestHarness;

  beforeEach(() => {
    hA = createTestHarness('store_tenant_alpha');
    hB = createTestHarness('store_tenant_beta');
  });

  it('rejects creating a fulfillment in Store A using Store B order', async () => {
    const { order: orderB } = await setupProductAndOrder(hB, { orderStatus: 'PAID' });

    // Store A attempts to create fulfillment for Store B's order
    await expect(
      hA.fulfillmentService.createFulfillment(
        { type: 'SELLER', context: hA.sellerContext },
        { orderId: orderB.id },
      ),
    ).rejects.toThrow();
  });

  it('strictly isolates fulfillment lookup across store boundaries', async () => {
    const { order: orderA } = await setupProductAndOrder(hA, { orderStatus: 'PAID' });

    const fulfillmentA = await hA.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: hA.sellerContext },
      { orderId: orderA.id },
    );

    // Store B tries to get fulfillment A
    await expect(
      hB.fulfillmentService.getFulfillment(
        { type: 'SELLER', context: hB.sellerContext },
        fulfillmentA.id,
      ),
    ).rejects.toThrow(FulfillmentNotFoundError);
  });

  it('strictly isolates fulfillment execution across store boundaries', async () => {
    const { order: orderA } = await setupProductAndOrder(hA, { orderStatus: 'PAID' });

    const fulfillmentA = await hA.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: hA.sellerContext },
      { orderId: orderA.id },
    );

    // Store B tries to execute fulfillment A
    await expect(
      hB.fulfillmentService.executeFulfillment(
        { type: 'SELLER', context: hB.sellerContext },
        { fulfillmentId: fulfillmentA.id },
      ),
    ).rejects.toThrow(FulfillmentNotFoundError);
  });

  it('strictly isolates fulfillment retries across store boundaries', async () => {
    const { order: orderA } = await setupProductAndOrder(hA, { orderStatus: 'PAID' });

    const fulfillmentA = await hA.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: hA.sellerContext },
      { orderId: orderA.id },
    );

    hA.mockProvider.setShouldFail(true);
    await expect(
      hA.fulfillmentService.executeFulfillment(
        { type: 'SELLER', context: hA.sellerContext },
        { fulfillmentId: fulfillmentA.id },
      ),
    ).rejects.toThrow();

    // Store B tries to retry fulfillment A
    await expect(
      hB.fulfillmentService.retryFulfillment(
        { type: 'SELLER', context: hB.sellerContext },
        { fulfillmentId: fulfillmentA.id },
      ),
    ).rejects.toThrow(FulfillmentNotFoundError);
  });

  it('strictly isolates fulfillment cancellation across store boundaries', async () => {
    const { order: orderA } = await setupProductAndOrder(hA, { orderStatus: 'PAID' });

    const fulfillmentA = await hA.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: hA.sellerContext },
      { orderId: orderA.id },
    );

    // Store B tries to cancel fulfillment A
    await expect(
      hB.fulfillmentService.cancelFulfillment(
        { type: 'SELLER', context: hB.sellerContext },
        fulfillmentA.id,
      ),
    ).rejects.toThrow(FulfillmentNotFoundError);
  });

  it('listFulfillments only returns fulfillments belonging to the queried store', async () => {
    const { order: orderA } = await setupProductAndOrder(hA, { orderStatus: 'PAID' });
    await hA.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: hA.sellerContext },
      { orderId: orderA.id },
    );

    const listB = await hB.fulfillmentService.listFulfillments({
      type: 'SELLER',
      context: hB.sellerContext,
    });
    expect(listB).toHaveLength(0);

    const listA = await hA.fulfillmentService.listFulfillments({
      type: 'SELLER',
      context: hA.sellerContext,
    });
    expect(listA).toHaveLength(1);
  });

  it('repository rejects creating fulfillment with mismatched storeId', async () => {
    const repo = new InMemoryFulfillmentRepository();
    const now = new Date().toISOString();
    const f: Fulfillment = {
      id: generateUUID(),
      storeId: 'store_alpha',
      orderId: 'order_1',
      strategy: 'DIGITAL_AUTO',
      status: 'PENDING',
      trackingInfo: {},
      failureReason: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };

    await expect(repo.create('store_beta', f, [])).rejects.toThrow(FulfillmentStoreMismatchError);
  });

  it('repository rejects creating fulfillment item with mismatched storeId', async () => {
    const repo = new InMemoryFulfillmentRepository();
    const now = new Date().toISOString();
    const fulfillmentId = generateUUID();
    const f: Fulfillment = {
      id: fulfillmentId,
      storeId: 'store_alpha',
      orderId: 'order_1',
      strategy: 'DIGITAL_AUTO',
      status: 'PENDING',
      trackingInfo: {},
      failureReason: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };

    const item: FulfillmentItem = {
      id: generateUUID(),
      storeId: 'store_beta', // Mismatched storeId
      fulfillmentId,
      orderItemId: 'order_item_1',
      inventoryItemId: null,
      itemType: 'CREDENTIAL',
      status: 'PENDING',
      payloadReference: null,
      createdAt: now,
    };

    await expect(repo.create('store_alpha', f, [item])).rejects.toThrow(
      FulfillmentStoreMismatchError,
    );
  });
});

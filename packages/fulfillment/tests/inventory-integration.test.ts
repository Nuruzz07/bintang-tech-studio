import { describe, it, expect, beforeEach } from 'vitest';
import { createTestHarness, setupProductAndOrder, TestHarness } from './test-helpers.js';

describe('M09 Fulfillment & Inventory Cross-Milestone Integration Suite', () => {
  let h: TestHarness;

  beforeEach(() => {
    h = createTestHarness();
  });

  it('preserves inventory reservation on fulfillment creation without consumption', async () => {
    const { product, order } = await setupProductAndOrder(h, {
      orderStatus: 'PAID',
      initialStock: 10,
    });

    // Before fulfillment: 1 reserved, 10 on hand
    const invBefore = await h.inventoryService.getInventory(h.sellerContext, product.id);
    expect(invBefore.quantityOnHand).toBe(10);
    expect(invBefore.quantityReserved).toBe(1);

    // Create fulfillment
    const fulfillment = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );
    expect(fulfillment.status).toBe('PENDING');

    // After fulfillment creation: stock is STILL 10 on hand and 1 reserved (NOT consumed)
    const invAfter = await h.inventoryService.getInventory(h.sellerContext, product.id);
    expect(invAfter.quantityOnHand).toBe(10);
    expect(invAfter.quantityReserved).toBe(1);
  });

  it('strictly consumes reserved inventory only when fulfillment succeeds and reaches FULFILLED', async () => {
    const { product, order } = await setupProductAndOrder(h, {
      orderStatus: 'PAID',
      initialStock: 10,
    });

    const fulfillment = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    // Execute delivery
    const executed = await h.fulfillmentService.executeFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { fulfillmentId: fulfillment.id },
    );

    expect(executed.status).toBe('FULFILLED');

    // Order should also be in FULFILLED status
    const refreshedOrder = await h.orderRepo.findById(h.storeId, order.id);
    expect(refreshedOrder?.status).toBe('FULFILLED');

    // Inventory MUST now be consumed: 9 on hand, 0 reserved!
    const invFinal = await h.inventoryService.getInventory(h.sellerContext, product.id);
    expect(invFinal.quantityOnHand).toBe(9);
    expect(invFinal.quantityReserved).toBe(0);
  });

  it('assigns digital inventory credential during creation and releases it upon cancellation', async () => {
    const { product, order } = await setupProductAndOrder(h, {
      orderStatus: 'PAID',
      withDigitalItems: true,
    });

    const fulfillment = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    const assignedItemId = fulfillment.items[0]?.inventoryItemId;
    expect(assignedItemId).toBeDefined();

    // Verify item is ASSIGNED in inventory repo
    const assignedItems = await h.inventoryService.listInventoryItems(
      h.sellerContext,
      product.id,
      'ASSIGNED',
    );
    expect(assignedItems).toHaveLength(1);
    expect(assignedItems[0]?.id).toBe(assignedItemId);

    // Cancel fulfillment
    await h.fulfillmentService.cancelFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      fulfillment.id,
      'Cancelled before execution',
    );

    // Item should be released back to AVAILABLE
    const releasedItems = await h.inventoryService.listInventoryItems(
      h.sellerContext,
      product.id,
      'AVAILABLE',
    );
    const restoredItem = releasedItems.find((i) => i.id === assignedItemId);
    expect(restoredItem).toBeDefined();
    expect(restoredItem?.assignedOrderId).toBeNull();
  });

  it('does NOT consume inventory or release reservation when fulfillment execution fails', async () => {
    const { product, order } = await setupProductAndOrder(h, {
      orderStatus: 'PAID',
      initialStock: 10,
    });

    const fulfillment = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    // Force provider failure
    h.mockProvider.setShouldFail(true, {
      failureCode: 'PROVIDER_TIMEOUT',
      failureReason: 'Provider timed out',
      retryable: true,
    });

    await expect(
      h.fulfillmentService.executeFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { fulfillmentId: fulfillment.id },
      ),
    ).rejects.toThrow();

    // Inventory must remain intact: 10 on hand, 1 reserved
    const inv = await h.inventoryService.getInventory(h.sellerContext, product.id);
    expect(inv.quantityOnHand).toBe(10);
    expect(inv.quantityReserved).toBe(1);

    // Fulfillment must be FAILED
    const failedFulfillment = await h.fulfillmentRepo.findById(h.storeId, fulfillment.id);
    expect(failedFulfillment?.status).toBe('FAILED');
  });

  it('does not double-consume inventory after successful retry', async () => {
    const { product, order } = await setupProductAndOrder(h, {
      orderStatus: 'PAID',
      initialStock: 10,
    });

    const fulfillment = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    // Fail initially
    h.mockProvider.setShouldFail(true);
    await expect(
      h.fulfillmentService.executeFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { fulfillmentId: fulfillment.id },
      ),
    ).rejects.toThrow();

    // Now resolve provider issue
    h.mockProvider.setShouldFail(false);

    // Retry
    const retried = await h.fulfillmentService.retryFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { fulfillmentId: fulfillment.id },
    );
    expect(retried.status).toBe('FULFILLED');

    // Inventory consumed exactly ONCE (10 - 1 = 9 on hand, 0 reserved)
    const inv = await h.inventoryService.getInventory(h.sellerContext, product.id);
    expect(inv.quantityOnHand).toBe(9);
    expect(inv.quantityReserved).toBe(0);
  });

  it('supports UNLIMITED stock products without reservation errors', async () => {
    const { order } = await setupProductAndOrder(h, {
      stockMode: 'UNLIMITED',
      orderStatus: 'PAID',
    });

    const fulfillment = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    const executed = await h.fulfillmentService.executeFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { fulfillmentId: fulfillment.id },
    );

    expect(executed.status).toBe('FULFILLED');
    const refreshedOrder = await h.orderRepo.findById(h.storeId, order.id);
    expect(refreshedOrder?.status).toBe('FULFILLED');
  });
});

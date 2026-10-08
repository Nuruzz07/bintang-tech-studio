import { describe, it, expect, beforeEach } from 'vitest';
import { createTestHarness, setupProductAndOrder, TestHarness } from './test-helpers.js';
import {
  FulfillmentOrderNotPayableError,
  FulfillmentOrderInvalidStateError,
  FulfillmentAlreadyCompletedError,
  FulfillmentAlreadyExistsError,
  FulfillmentCustomerAccessDeniedError,
  FulfillmentError,
} from '../src/index.js';

describe('M09 Fulfillment Creation Suite', () => {
  let h: TestHarness;

  beforeEach(() => {
    h = createTestHarness();
  });

  it('successfully creates fulfillment for a PAID order', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });

    const fulfillment = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id, strategy: 'DIGITAL_AUTO' },
    );

    expect(fulfillment.id).toBeDefined();
    expect(fulfillment.storeId).toBe(h.storeId);
    expect(fulfillment.orderId).toBe(order.id);
    expect(fulfillment.status).toBe('PENDING');
    expect(fulfillment.strategy).toBe('DIGITAL_AUTO');
    expect(fulfillment.items).toHaveLength(1);
    expect(fulfillment.items[0]?.orderItemId).toBe(order.items[0]?.id);
    expect(fulfillment.items[0]?.status).toBe('PENDING');
  });

  it('successfully creates fulfillment for a PROCESSING order', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PROCESSING' });

    const fulfillment = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id, strategy: 'DIGITAL_AUTO' },
    );

    expect(fulfillment.status).toBe('PENDING');
    expect(fulfillment.orderId).toBe(order.id);
  });

  it('rejects fulfillment creation for an unpaid PENDING_PAYMENT order', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PENDING_PAYMENT' });

    await expect(
      h.fulfillmentService.createFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { orderId: order.id },
      ),
    ).rejects.toThrow(FulfillmentOrderNotPayableError);
  });

  it('rejects fulfillment creation for a CANCELLED order', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'CANCELLED' });

    await expect(
      h.fulfillmentService.createFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { orderId: order.id },
      ),
    ).rejects.toThrow(FulfillmentOrderInvalidStateError);
  });

  it('rejects fulfillment creation for an already FULFILLED order', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'FULFILLED' });

    await expect(
      h.fulfillmentService.createFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { orderId: order.id },
      ),
    ).rejects.toThrow(FulfillmentAlreadyCompletedError);
  });

  it('rejects duplicate fulfillment creation when active fulfillment exists', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });

    await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    await expect(
      h.fulfillmentService.createFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { orderId: order.id },
      ),
    ).rejects.toThrow(FulfillmentAlreadyExistsError);
  });

  it('strictly rejects fulfillment creation by a CUSTOMER caller', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });

    await expect(
      h.fulfillmentService.createFulfillment(
        {
          type: 'CUSTOMER',
          context: { storeId: h.storeId, customerId: h.customerA.id },
        },
        { orderId: order.id },
      ),
    ).rejects.toThrow(FulfillmentCustomerAccessDeniedError);
  });

  it('automatically assigns available digital inventory item when configured', async () => {
    const { product, order } = await setupProductAndOrder(h, {
      orderStatus: 'PAID',
      withDigitalItems: true,
    });

    const fulfillment = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id, strategy: 'DIGITAL_AUTO' },
    );

    expect(fulfillment.items[0]?.inventoryItemId).not.toBeNull();

    // Verify inventory item is now marked as ASSIGNED
    const items = await h.inventoryService.listInventoryItems(
      h.sellerContext,
      product.id,
      'ASSIGNED',
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe(fulfillment.items[0]?.inventoryItemId);
    expect(items[0]?.assignedOrderId).toBe(order.id);
  });

  it('handles products without serialized inventory items gracefully', async () => {
    const { order } = await setupProductAndOrder(h, {
      orderStatus: 'PAID',
      withDigitalItems: false,
    });

    const fulfillment = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id, strategy: 'DIGITAL_AUTO' },
    );

    expect(fulfillment.items[0]?.inventoryItemId).toBeNull();
    expect(fulfillment.items[0]?.status).toBe('PENDING');
  });

  it('attaches custom metadata during creation', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });

    const metadata = { priority: 'HIGH', campaign: 'promo_2026' };
    const fulfillment = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id, metadata },
    );

    expect(fulfillment.metadata).toEqual(metadata);
  });

  it('rejects invalid strategy', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });

    await expect(
      h.fulfillmentService.createFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { orderId: order.id, strategy: 'INVALID_STRATEGY' as unknown as 'DIGITAL_AUTO' },
      ),
    ).rejects.toThrow(FulfillmentError);
  });
});

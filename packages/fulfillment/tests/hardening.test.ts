import { describe, it, expect, beforeEach } from 'vitest';
import { createTestHarness, setupProductAndOrder, TestHarness } from './test-helpers.js';
import {
  FulfillmentAlreadyCompletedError,
  FulfillmentRetryNotAllowedError,
  FulfillmentExecutionError,
} from '../src/index.js';

describe('M09 Fulfillment Hardening & Safety Gate Suite', () => {
  let h: TestHarness;

  beforeEach(() => {
    h = createTestHarness('store_hardening_gate');
  });

  describe('A & F. Cancellation & Delivered Credential Safety', () => {
    it('strictly rejects cancellation of an already FULFILLED fulfillment', async () => {
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
        h.fulfillmentService.cancelFulfillment({ type: 'SELLER', context: h.sellerContext }, f.id),
      ).rejects.toThrow(FulfillmentAlreadyCompletedError);
    });

    it('does NOT restore credentials to AVAILABLE if item status is DELIVERED', async () => {
      const { product, order } = await setupProductAndOrder(h, {
        orderStatus: 'PAID',
        withDigitalItems: true,
      });

      const f = await h.fulfillmentService.createFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { orderId: order.id },
      );
      const assignedId = f.items[0]?.inventoryItemId;
      expect(assignedId).not.toBeNull();

      // Execute delivery so item becomes DELIVERED
      await h.fulfillmentService.executeFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { fulfillmentId: f.id },
      );

      // Verify item is DELIVERED
      const refreshedF = await h.fulfillmentRepo.findById(h.storeId, f.id);
      expect(refreshedF?.items[0]?.status).toBe('DELIVERED');

      // Attempting to cancel directly on FULFILLED is rejected
      await expect(
        h.fulfillmentService.cancelFulfillment({ type: 'SELLER', context: h.sellerContext }, f.id),
      ).rejects.toThrow(FulfillmentAlreadyCompletedError);

      // Verify credential in inventory remains ASSIGNED and is NEVER restored to AVAILABLE
      const availableItems = await h.inventoryService.listInventoryItems(
        h.sellerContext,
        product.id,
        'AVAILABLE',
      );
      expect(availableItems.some((i) => i.id === assignedId)).toBe(false);
    });

    it('does NOT restore credentials to AVAILABLE if fulfillment was in MANUAL_REVIEW (ambiguous outcome)', async () => {
      const { product, order } = await setupProductAndOrder(h, {
        orderStatus: 'PAID',
        withDigitalItems: true,
      });

      const f = await h.fulfillmentService.createFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { orderId: order.id },
      );
      const assignedId = f.items[0]?.inventoryItemId;

      // Put fulfillment into MANUAL_REVIEW via non-retryable provider failure
      h.mockProvider.setShouldFail(true, {
        failureCode: 'AMBIGUOUS_ERROR',
        failureReason: 'Ambiguous delivery state',
        retryable: false,
      });

      await expect(
        h.fulfillmentService.executeFulfillment(
          { type: 'SELLER', context: h.sellerContext },
          { fulfillmentId: f.id },
        ),
      ).rejects.toThrow();

      const inReview = await h.fulfillmentRepo.findById(h.storeId, f.id);
      expect(inReview?.status).toBe('MANUAL_REVIEW');

      // Cancel fulfillment in MANUAL_REVIEW
      await h.fulfillmentService.cancelFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        f.id,
        'Cancelled during ambiguous review',
      );

      // Credential must NOT be restored to AVAILABLE because delivery might have taken place
      const available = await h.inventoryService.listInventoryItems(
        h.sellerContext,
        product.id,
        'AVAILABLE',
      );
      expect(available.some((i) => i.id === assignedId)).toBe(false);
    });
  });

  describe('C. Provider Ambiguous Outcome Defenses', () => {
    it('transitions fulfillment to MANUAL_REVIEW when provider throws uncaught network error', async () => {
      const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });
      const f = await h.fulfillmentService.createFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { orderId: order.id },
      );

      // Simulate network socket crash during provider delivery
      h.mockProvider.setShouldThrow(true, new Error('ECONNRESET socket hang up'));

      await expect(
        h.fulfillmentService.executeFulfillment(
          { type: 'SELLER', context: h.sellerContext },
          { fulfillmentId: f.id },
        ),
      ).rejects.toThrow(FulfillmentExecutionError);

      const inReview = await h.fulfillmentRepo.findById(h.storeId, f.id);
      expect(inReview?.status).toBe('MANUAL_REVIEW');
      expect(inReview?.failureReason).toContain('Ambiguous provider outcome');
      expect(inReview?.failureReason).toContain('ECONNRESET socket hang up');
    });
  });

  describe('B. Digital Inventory Duplicate Assignment Defenses', () => {
    it('two concurrent orders for the same digital product assign distinct credentials without collision', async () => {
      const { product, order: order1 } = await setupProductAndOrder(h, {
        orderStatus: 'PAID',
        withDigitalItems: true, // Seeds 3 available credentials
      });

      // Create a second paid order for the same product
      const order2 = await h.orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId: h.storeId, customerId: h.customerB.id } },
        { items: [{ productId: product.id, quantity: 1 }] },
      );
      await h.orderService.transitionStatus(h.sellerContext, order2.id, 'PAID');

      // Fire concurrent fulfillment creations
      const [f1, f2] = await Promise.all([
        h.fulfillmentService.createFulfillment(
          { type: 'SELLER', context: h.sellerContext },
          { orderId: order1.id },
        ),
        h.fulfillmentService.createFulfillment(
          { type: 'SELLER', context: h.sellerContext },
          { orderId: order2.id },
        ),
      ]);

      const cred1 = f1.items[0]?.inventoryItemId;
      const cred2 = f2.items[0]?.inventoryItemId;

      expect(cred1).toBeDefined();
      expect(cred2).toBeDefined();
      // Must be two distinct credentials! Zero double-assignment!
      expect(cred1).not.toBe(cred2);
    });
  });

  describe('D & E. Inventory Consumption & Retry Defenses', () => {
    it('sequential duplicate execution consumes reserved stock strictly ONCE', async () => {
      const { product, order } = await setupProductAndOrder(h, {
        stockMode: 'TRACKED',
        initialStock: 10,
        orderStatus: 'PAID',
      });

      const f = await h.fulfillmentService.createFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { orderId: order.id },
      );

      // First execution succeeds
      await h.fulfillmentService.executeFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { fulfillmentId: f.id },
      );

      // Second execution attempt throws
      await expect(
        h.fulfillmentService.executeFulfillment(
          { type: 'SELLER', context: h.sellerContext },
          { fulfillmentId: f.id },
        ),
      ).rejects.toThrow(FulfillmentAlreadyCompletedError);

      // Stock was consumed strictly once: 9 on hand, 0 reserved
      const inv = await h.inventoryService.getInventory(h.sellerContext, product.id);
      expect(inv.quantityOnHand).toBe(9);
      expect(inv.quantityReserved).toBe(0);
    });

    it('concurrent executions consume reserved stock strictly ONCE', async () => {
      const { product, order } = await setupProductAndOrder(h, {
        stockMode: 'TRACKED',
        initialStock: 10,
        orderStatus: 'PAID',
      });

      const f = await h.fulfillmentService.createFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { orderId: order.id },
      );

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

      // Stock was consumed strictly once: 9 on hand, 0 reserved
      const inv = await h.inventoryService.getInventory(h.sellerContext, product.id);
      expect(inv.quantityOnHand).toBe(9);
      expect(inv.quantityReserved).toBe(0);
    });

    it('provider failure consumes ZERO stock and preserves reservation', async () => {
      const { product, order } = await setupProductAndOrder(h, {
        stockMode: 'TRACKED',
        initialStock: 10,
        orderStatus: 'PAID',
      });

      const f = await h.fulfillmentService.createFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { orderId: order.id },
      );

      h.mockProvider.setShouldFail(true);
      await expect(
        h.fulfillmentService.executeFulfillment(
          { type: 'SELLER', context: h.sellerContext },
          { fulfillmentId: f.id },
        ),
      ).rejects.toThrow();

      // Zero consumption: 10 on hand, 1 reserved
      const inv = await h.inventoryService.getInventory(h.sellerContext, product.id);
      expect(inv.quantityOnHand).toBe(10);
      expect(inv.quantityReserved).toBe(1);
    });

    it('ambiguous provider throw consumes ZERO stock and preserves reservation', async () => {
      const { product, order } = await setupProductAndOrder(h, {
        stockMode: 'TRACKED',
        initialStock: 10,
        orderStatus: 'PAID',
      });

      const f = await h.fulfillmentService.createFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { orderId: order.id },
      );

      h.mockProvider.setShouldThrow(true, new Error('Gateway timed out'));
      await expect(
        h.fulfillmentService.executeFulfillment(
          { type: 'SELLER', context: h.sellerContext },
          { fulfillmentId: f.id },
        ),
      ).rejects.toThrow();

      // Zero consumption: 10 on hand, 1 reserved
      const inv = await h.inventoryService.getInventory(h.sellerContext, product.id);
      expect(inv.quantityOnHand).toBe(10);
      expect(inv.quantityReserved).toBe(1);
    });

    it('concurrent retry and execute on the same fulfillment dispatches provider strictly ONCE', async () => {
      const { product, order } = await setupProductAndOrder(h, {
        stockMode: 'TRACKED',
        initialStock: 10,
        orderStatus: 'PAID',
      });

      const f = await h.fulfillmentService.createFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { orderId: order.id },
      );

      // Force initial failure
      h.mockProvider.setShouldFail(true);
      await expect(
        h.fulfillmentService.executeFulfillment(
          { type: 'SELLER', context: h.sellerContext },
          { fulfillmentId: f.id },
        ),
      ).rejects.toThrow();

      expect(h.mockProvider.deliveryCalls).toHaveLength(1);

      // Fix provider
      h.mockProvider.setShouldFail(false);

      // Concurrently fire retry and execute
      const results = await Promise.allSettled([
        h.fulfillmentService.retryFulfillment(
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

      // Total delivery calls to provider: 1 (failed) + 1 (successful retry) = 2 total
      expect(h.mockProvider.deliveryCalls).toHaveLength(2);

      // Inventory consumed strictly once
      const inv = await h.inventoryService.getInventory(h.sellerContext, product.id);
      expect(inv.quantityOnHand).toBe(9);
      expect(inv.quantityReserved).toBe(0);
    });

    it('retrying an already FULFILLED fulfillment throws FulfillmentRetryNotAllowedError', async () => {
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
  });
});

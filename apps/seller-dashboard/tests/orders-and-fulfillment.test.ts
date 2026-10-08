/**
 * Bintang Tech Studio — Seller Dashboard Orders & Fulfillment Test Suite.
 * Baseline: Milestone M12 Seller Dashboard Foundation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSellerDashboardTestHarness, SellerDashboardTestHarness } from './test-helpers.js';
import { SellerResourceNotFoundError } from '../src/errors.js';
import { PermissionDeniedError } from '@bintang/authorization';

describe('Seller Dashboard — Orders & Fulfillment Section', () => {
  let harness: SellerDashboardTestHarness;

  beforeEach(async () => {
    harness = await createSellerDashboardTestHarness();
  });

  describe('Orders Listing & Details', () => {
    it('lists orders scoped exclusively to active store', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const orders = await harness.dashboardService.listOrders(session.sessionToken);

      expect(orders.length).toBe(3);
      const ids = orders.map((o) => o.id);
      expect(ids).toContain(harness.orderA1.id);
      expect(ids).toContain(harness.orderA2.id);
      expect(ids).toContain(harness.orderA3.id);
      expect(ids).not.toContain(harness.orderB1.id);
    });

    it('filters orders by status', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const paidOrders = await harness.dashboardService.listOrders(session.sessionToken, {
        status: 'PAID',
      });

      expect(paidOrders.length).toBe(1);
      expect(paidOrders[0]?.id).toBe(harness.orderA2.id);
      expect(paidOrders[0]?.status).toBe('PAID');
    });

    it('retrieves order details with line items and customer information', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const detail = await harness.dashboardService.getOrderById(
        session.sessionToken,
        harness.orderA2.id,
      );

      expect(detail).toBeDefined();
      expect(detail.id).toBe(harness.orderA2.id);
      expect(detail.orderNumber).toBe(harness.orderA2.orderNumber);
      expect(detail.grandTotal).toBe('70000.00');
      expect(detail.customerName).toBe(harness.customerA2.name);
      expect(detail.customerEmail).toBe(harness.customerA2.email);
      expect(detail.items.length).toBe(1);
      expect(detail.items[0]?.productName).toBe(harness.productA2.name);
      expect(detail.items[0]?.quantity).toBe(2);
    });

    it('rejects cross-tenant order detail access with ResourceNotFoundError', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      await expect(
        harness.dashboardService.getOrderById(session.sessionToken, harness.orderB1.id),
      ).rejects.toThrow(SellerResourceNotFoundError);
    });
  });

  describe('Order Cancellation', () => {
    it('cancels pending order transitioning state via M07 state machine', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const cancelled = await harness.dashboardService.cancelOrder(session.sessionToken, {
        orderId: harness.orderA1.id,
        reason: 'Customer requested cancellation before payment',
      });

      expect(cancelled.status).toBe('CANCELLED');

      // Verify persistence in repository
      const reloaded = await harness.orderRepo.findById(harness.storeA.id, harness.orderA1.id);
      expect(reloaded?.status).toBe('CANCELLED');
    });

    it('rejects cancelling order from another store', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      await expect(
        harness.dashboardService.cancelOrder(session.sessionToken, {
          orderId: harness.orderB1.id,
          reason: 'Unauthorized cross-tenant cancel',
        }),
      ).rejects.toThrow();
    });

    it('enforces RBAC: STORE_STAFF cannot cancel orders (requires orders.cancel)', async () => {
      const sessionStaff = await harness.loginAs(harness.userDan, harness.storeA.id);
      await expect(
        harness.dashboardService.cancelOrder(sessionStaff.sessionToken, {
          orderId: harness.orderA1.id,
          reason: 'Staff attempted cancel',
        }),
      ).rejects.toThrow(PermissionDeniedError);
    });
  });

  describe('Fulfillment Queries & Zero Secret Leakage', () => {
    it('lists fulfillments for active store', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const fulfillments = await harness.dashboardService.listFulfillments(session.sessionToken);

      expect(fulfillments.length).toBe(1);
      expect(fulfillments[0]?.orderId).toBe(harness.orderA2.id);
      expect(fulfillments[0]?.status).toBe('COMPLETED');
    });

    it('retrieves fulfillment details and guarantees zero raw secret credential leakage', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const detail = await harness.dashboardService.getFulfillmentById(
        session.sessionToken,
        'ful_a2',
      );

      expect(detail).toBeDefined();
      expect(detail.id).toBe('ful_a2');
      expect(detail.orderId).toBe(harness.orderA2.id);
      expect(detail.status).toBe('COMPLETED');
      expect(detail.items.length).toBe(1);

      // CRITICAL INVARIANT: Zero credential or sensitive token leakage
      const serialized = JSON.stringify(detail);
      expect(serialized).not.toContain('ML-KEY-ALPHA');
      expect(serialized).not.toContain('secretApiKey');
      expect(serialized).not.toContain('credentialPayload');
    });

    it('rejects cross-tenant fulfillment lookup with ResourceNotFoundError', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      await expect(
        harness.dashboardService.getFulfillmentById(session.sessionToken, 'ful_b1'),
      ).rejects.toThrow(SellerResourceNotFoundError);
    });
  });
});

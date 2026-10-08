/**
 * Bintang Tech Studio — Platform Orders Overview & Support Tickets Test Suite.
 * Baseline: Milestone M14 Owner Console Foundation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestOwnerConsoleHarness, TestOwnerConsoleHarness } from './test-helpers.js';

describe('M14 Orders Overview & Support Tickets Suite', () => {
  let harness: TestOwnerConsoleHarness;
  let ownerToken: string;
  let adminToken: string;

  beforeEach(async () => {
    harness = createTestOwnerConsoleHarness();
    ownerToken = await harness.createOwnerSession();
    adminToken = await harness.createAdminSession();

    await harness.storeRepo.create({
      id: 'store_order_1',
      ownerUserId: 'usr_seller_1',
      name: 'Order Test Store',
      slug: 'order-test-store',
      templateVersionId: null,
      status: 'ACTIVE',
      currency: 'IDR',
      settings: {},
    });

    // Seed order in orderRepo
    await harness.orderRepo.create(
      'store_order_1',
      {
        id: 'ord_1',
        storeId: 'store_order_1',
        customerId: 'usr_cust_9988',
        orderNumber: 'ORD-202610-001',
        status: 'PAID',
        subtotal: '75000.00',
        discountTotal: '0.00',
        grandTotal: '75000.00',
        currency: 'IDR',
        voucherId: null,
        fulfillmentStatus: 'FULFILLED',
        metadata: {},
        createdAt: '2026-10-08T00:00:00.000Z',
        updatedAt: '2026-10-08T00:00:00.000Z',
      },
      [
        {
          id: 'item_1',
          storeId: 'store_order_1',
          orderId: 'ord_1',
          productId: 'prod_1',
          productName: 'Digital Item',
          quantity: 1,
          unitPrice: '75000.00',
          subtotal: '75000.00',
          metadata: {},
          createdAt: '2026-10-08T00:00:00.000Z',
        },
      ],
    );
  });

  it('aggregates cross-store order metrics and minimizes customer PII', async () => {
    const { metrics, recentOrders } = await harness.service.getOrderOverview(ownerToken);
    expect(metrics.totalOrders).toBe(1);
    expect(metrics.paidOrders).toBe(1);

    expect(recentOrders.length).toBe(1);
    const order = recentOrders[0]!;
    expect(order.orderNumber).toBe('ORD-202610-001');

    // Customer PII minimization verification
    expect(order.customerMaskedIdentity).toBe('cust_***9988');
    expect(order.customerMaskedIdentity).not.toContain('usr_cust_9988');
  });

  it('creates, lists, and updates support tickets with audit logging', async () => {
    const ticket = await harness.service.createTicket(adminToken, {
      storeId: 'store_order_1',
      subject: 'Telegram Bot webhook error',
      category: 'TECHNICAL',
      priority: 'HIGH',
      message: 'Merchant reporting intermittent webhook drops.',
    });

    expect(ticket.subject).toBe('Telegram Bot webhook error');
    expect(ticket.status).toBe('OPEN');
    expect(ticket.ticketNumber).toMatch(/^TICK-/);

    const list = await harness.service.listTickets(adminToken, { storeId: 'store_order_1' });
    expect(list.length).toBe(1);

    // Update ticket status
    const updated = await harness.service.updateTicket(adminToken, ticket.id, {
      status: 'IN_PROGRESS',
      assignedAdminId: 'usr_plat_admin_1',
      internalNote: 'Investigating Telegram Bot API response codes.',
    });

    expect(updated.status).toBe('IN_PROGRESS');
    expect(updated.assignedAdminId).toBe('usr_plat_admin_1');
    expect(updated.internalNotesCount).toBe(1);

    // Verify audit logs
    const logs = await harness.auditRepo.list({ resourceType: 'support_ticket' });
    expect(logs.length).toBe(2);
    expect(logs[0]!.action).toBe('SUPPORT_TICKET_UPDATED');
    expect(logs[1]!.action).toBe('SUPPORT_TICKET_CREATED');
  });
});

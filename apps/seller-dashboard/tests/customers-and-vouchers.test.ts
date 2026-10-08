/**
 * Bintang Tech Studio — Seller Dashboard Customers & Vouchers Test Suite.
 * Baseline: Milestone M12 Seller Dashboard Foundation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSellerDashboardTestHarness, SellerDashboardTestHarness } from './test-helpers.js';
import { ChannelFeatureDisabledError, SellerResourceNotFoundError } from '../src/errors.js';
import { PermissionDeniedError } from '@bintang/authorization';

describe('Seller Dashboard — Customers & Vouchers Section', () => {
  let harness: SellerDashboardTestHarness;

  beforeEach(async () => {
    harness = await createSellerDashboardTestHarness();
  });

  describe('Customers Section', () => {
    it('lists customers scoped exclusively to active store', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const customers = await harness.dashboardService.listCustomers(session.sessionToken);

      expect(customers.length).toBe(2);
      const ids = customers.map((c) => c.id);
      expect(ids).toContain(harness.customerA1.id);
      expect(ids).toContain(harness.customerA2.id);
      expect(ids).not.toContain(harness.customerB1.id);
    });

    it('retrieves single customer details and spending history', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const customer = await harness.dashboardService.getCustomerById(
        session.sessionToken,
        harness.customerA1.id,
      );

      expect(customer).toBeDefined();
      expect(customer.id).toBe(harness.customerA1.id);
      expect(customer.name).toBe(harness.customerA1.name);
      expect(customer.totalOrders).toBe(3);
      expect(customer.totalSpent).toBe('125000.00');
      expect(customer.formattedTotalSpent).toContain('125.000');
    });

    it('rejects cross-tenant customer lookup with ResourceNotFoundError', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      await expect(
        harness.dashboardService.getCustomerById(session.sessionToken, harness.customerB1.id),
      ).rejects.toThrow(SellerResourceNotFoundError);
    });
  });

  describe('Vouchers Section', () => {
    it('lists vouchers for active store', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const vouchers = await harness.dashboardService.listVouchers(session.sessionToken);

      expect(vouchers.length).toBe(1);
      expect(vouchers[0]?.id).toBe(harness.voucherA1.id);
      expect(vouchers[0]?.code).toBe('DISKON10');
      expect(vouchers[0]?.discountType).toBe('PERCENTAGE');
    });

    it('creates new voucher successfully when store is entitled', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const created = await harness.dashboardService.createVoucher(session.sessionToken, {
        code: 'PROMOFLASH',
        discountType: 'FIXED',
        discountValue: '15000.00',
        minimumPurchase: '50000.00',
        usageLimit: 50,
      });

      expect(created).toBeDefined();
      expect(created.code).toBe('PROMOFLASH');
      expect(created.discountValue).toBe('15000.00');
      expect(created.status).toBe('ACTIVE');
    });

    it('rejects voucher creation when plan does not have voucher entitlement', async () => {
      // Store D has features.voucher: false
      const session = await harness.loginAs(harness.userAlice, harness.storeD.id);

      await expect(
        harness.dashboardService.createVoucher(session.sessionToken, {
          code: 'UNENTITLED',
          discountType: 'FIXED',
          discountValue: '10000.00',
        }),
      ).rejects.toThrow(ChannelFeatureDisabledError);
    });

    it('updates voucher properties', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const updated = await harness.dashboardService.updateVoucher(
        session.sessionToken,
        harness.voucherA1.id,
        {
          discountValue: '15.00',
          usageLimit: 200,
        },
      );

      expect(updated.discountValue).toBe('15.00');
      expect(updated.usageLimit).toBe(200);
    });

    it('deletes voucher from active store', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      await harness.dashboardService.deleteVoucher(session.sessionToken, harness.voucherA1.id);

      const vouchers = await harness.dashboardService.listVouchers(session.sessionToken);
      expect(vouchers.length).toBe(0);
    });

    it('rejects deleting voucher belonging to another store', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      await expect(
        harness.dashboardService.deleteVoucher(session.sessionToken, harness.voucherB1.id),
      ).rejects.toThrow(SellerResourceNotFoundError);
    });

    it('enforces RBAC: STORE_STAFF cannot create or delete vouchers', async () => {
      const sessionStaff = await harness.loginAs(harness.userDan, harness.storeA.id);

      // Staff CAN list vouchers
      const vouchers = await harness.dashboardService.listVouchers(sessionStaff.sessionToken);
      expect(vouchers.length).toBe(1);

      // Staff CANNOT create voucher
      await expect(
        harness.dashboardService.createVoucher(sessionStaff.sessionToken, {
          code: 'STAFFVOUCHER',
          discountType: 'FIXED',
          discountValue: '5000.00',
        }),
      ).rejects.toThrow(PermissionDeniedError);

      // Staff CANNOT delete voucher
      await expect(
        harness.dashboardService.deleteVoucher(sessionStaff.sessionToken, harness.voucherA1.id),
      ).rejects.toThrow(PermissionDeniedError);
    });
  });
});

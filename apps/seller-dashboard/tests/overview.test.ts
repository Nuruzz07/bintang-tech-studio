/**
 * Bintang Tech Studio — Seller Dashboard Overview Test Suite.
 * Baseline: Milestone M12 Seller Dashboard Foundation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSellerDashboardTestHarness, SellerDashboardTestHarness } from './test-helpers.js';
import { StoreSuspendedError } from '../src/errors.js';
import { PermissionDeniedError } from '@bintang/authorization';

describe('Seller Dashboard — Overview Section', () => {
  let harness: SellerDashboardTestHarness;

  beforeEach(async () => {
    harness = await createSellerDashboardTestHarness();
  });

  describe('Metrics Calculation & Aggregation', () => {
    it('aggregates revenue, order counts, and low stock alerts for active store', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const overview = await harness.dashboardService.getOverview(session.sessionToken);

      expect(overview).toBeDefined();
      expect(overview.storeId).toBe(harness.storeA.id);
      expect(overview.storeName).toBe(harness.storeA.name);

      // Store A has 3 orders total: 1 PAID ("70000.00"), 1 PENDING_PAYMENT, 1 CANCELLED
      expect(overview.totalOrders).toBe(3);
      expect(overview.paidOrders).toBe(1);
      expect(overview.pendingOrders).toBe(1);
      expect(overview.grossRevenue).toBe('70000.00');
      expect(overview.formattedGrossRevenue).toContain('70.000');

      // Store A has productA2 with quantityOnHand: 3 <= 5
      expect(overview.lowStockCount).toBe(1);

      // Recent orders list belongs to Store A
      expect(overview.recentOrders.length).toBeGreaterThan(0);
      for (const o of overview.recentOrders) {
        expect(o.storeId).toBe(harness.storeA.id);
      }
    });

    it('enforces multi-tenant isolation between Store A and Store B metrics', async () => {
      const sessionA = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const overviewA = await harness.dashboardService.getOverview(sessionA.sessionToken);

      const sessionB = await harness.loginAs(harness.userCharlie, harness.storeB.id);
      const overviewB = await harness.dashboardService.getOverview(sessionB.sessionToken);

      // Store B has orderB1 (PAID, "150000.00")
      expect(overviewB.grossRevenue).toBe('150000.00');
      expect(overviewB.totalOrders).toBe(1);
      expect(overviewB.paidOrders).toBe(1);

      // Ensure no metric bleeding
      expect(overviewA.grossRevenue).not.toBe(overviewB.grossRevenue);
      expect(overviewA.recentOrders.map((o) => o.id)).not.toContain(overviewB.recentOrders[0]?.id);
    });
  });

  describe('Role Access', () => {
    it('allows STORE_ADMIN to view overview metrics', async () => {
      // Bob Admin has analytics.read
      const sessionBob = await harness.loginAs(harness.userBob, harness.storeA.id);
      const overviewBob = await harness.dashboardService.getOverview(sessionBob.sessionToken);
      expect(overviewBob.totalOrders).toBe(3);
      expect(overviewBob.grossRevenue).toBe('70000.00');
    });

    it('denies STORE_STAFF from viewing overview metrics (RBAC analytics.read)', async () => {
      // Dan Staff does not have analytics.read
      const sessionDan = await harness.loginAs(harness.userDan, harness.storeA.id);
      await expect(harness.dashboardService.getOverview(sessionDan.sessionToken)).rejects.toThrow(
        PermissionDeniedError,
      );
    });

    it('rejects overview access if store is suspended', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      await harness.storeRepo.update(harness.storeA.id, { status: 'SUSPENDED' });

      await expect(harness.dashboardService.getOverview(session.sessionToken)).rejects.toThrow(
        StoreSuspendedError,
      );
    });
  });
});

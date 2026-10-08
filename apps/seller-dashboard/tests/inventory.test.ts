/**
 * Bintang Tech Studio — Seller Dashboard Inventory Test Suite.
 * Baseline: Milestone M12 Seller Dashboard Foundation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSellerDashboardTestHarness, SellerDashboardTestHarness } from './test-helpers.js';
import { SellerResourceNotFoundError } from '../src/errors.js';
import { PermissionDeniedError } from '@bintang/authorization';

describe('Seller Dashboard — Inventory Section', () => {
  let harness: SellerDashboardTestHarness;

  beforeEach(async () => {
    harness = await createSellerDashboardTestHarness();
  });

  describe('Inventory Levels & Stock Tracking', () => {
    it('lists inventory levels scoped exclusively to active store', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const inventory = await harness.dashboardService.listInventory(session.sessionToken);

      expect(inventory.length).toBe(2);
      const invA1 = inventory.find((i) => i.productId === harness.productA1.id);
      const invA2 = inventory.find((i) => i.productId === harness.productA2.id);

      expect(invA1).toBeDefined();
      expect(invA1?.onHand).toBe(10);
      expect(invA1?.reserved).toBe(1);
      expect(invA1?.availableStock).toBe(9);
      expect(invA1?.isLowStock).toBe(false);

      expect(invA2).toBeDefined();
      expect(invA2?.onHand).toBe(3);
      expect(invA2?.isLowStock).toBe(true);

      // Verify Store B product is NOT present
      expect(inventory.find((i) => i.productId === harness.productB1.id)).toBeUndefined();
    });

    it('retrieves single product inventory level', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const inv = await harness.dashboardService.getInventoryByProductId(
        session.sessionToken,
        harness.productA1.id,
      );

      expect(inv.productId).toBe(harness.productA1.id);
      expect(inv.productName).toBe(harness.productA1.name);
      expect(inv.onHand).toBe(10);
      expect(inv.availableStock).toBe(9);
    });

    it('rejects cross-tenant inventory lookup with ResourceNotFoundError', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      await expect(
        harness.dashboardService.getInventoryByProductId(
          session.sessionToken,
          harness.productB1.id,
        ),
      ).rejects.toThrow(SellerResourceNotFoundError);
    });
  });

  describe('Stock Adjustments', () => {
    it('performs atomic stock IN adjustment increasing stock on hand', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const adjusted = await harness.dashboardService.adjustStock(
        session.sessionToken,
        harness.productA1.id,
        {
          quantity: 5,
          adjustmentType: 'INCREASE',
          reason: 'Restock batch #10',
        },
      );

      expect(adjusted.onHand).toBe(15);
      expect(adjusted.availableStock).toBe(14); // 15 - 1 reserved
    });

    it('performs atomic stock OUT adjustment decreasing stock on hand', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const adjusted = await harness.dashboardService.adjustStock(
        session.sessionToken,
        harness.productA1.id,
        {
          quantity: 3,
          adjustmentType: 'DECREASE',
          reason: 'Damaged item write-off',
        },
      );

      expect(adjusted.onHand).toBe(7);
      expect(adjusted.availableStock).toBe(6); // 7 - 1 reserved
    });

    it('performs atomic stock RECONCILIATION setting exact quantity', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const adjusted = await harness.dashboardService.adjustStock(
        session.sessionToken,
        harness.productA1.id,
        {
          quantity: 20,
          adjustmentType: 'SET',
          reason: 'Physical stock opname audit',
        },
      );

      expect(adjusted.onHand).toBe(20);
      expect(adjusted.availableStock).toBe(19);
    });

    it('rejects cross-tenant stock adjustment with ResourceNotFoundError', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      await expect(
        harness.dashboardService.adjustStock(session.sessionToken, harness.productB1.id, {
          quantity: 10,
          adjustmentType: 'INCREASE',
          reason: 'Malicious adjustment',
        }),
      ).rejects.toThrow(SellerResourceNotFoundError);
    });
  });

  describe('Digital Inventory Summary & Secret Protection', () => {
    it('returns aggregate counts for digital items without exposing raw secret payloads', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const summary = await harness.dashboardService.getDigitalInventorySummary(
        session.sessionToken,
        harness.productA1.id,
      );

      expect(summary).toBeDefined();
      expect(summary.productId).toBe(harness.productA1.id);
      expect(summary.totalItems).toBe(4);
      expect(summary.availableCount).toBe(2);
      expect(summary.reservedCount).toBe(1);
      expect(summary.consumedCount).toBe(1);

      // CRITICAL SECURITY INVARIANT: Zero credential payload leakage!
      const serialized = JSON.stringify(summary);
      expect(serialized).not.toContain('ML-KEY-ALPHA');
      expect(serialized).not.toContain('secretKey');
      expect(serialized).not.toContain('pin');
    });
  });

  describe('Role-Based Access Control', () => {
    it('allows STORE_STAFF to read inventory levels', async () => {
      const sessionStaff = await harness.loginAs(harness.userDan, harness.storeA.id);
      const inventory = await harness.dashboardService.listInventory(sessionStaff.sessionToken);
      expect(inventory.length).toBe(2);
    });

    it('denies STORE_STAFF from adjusting stock (requires inventory.update)', async () => {
      const sessionStaff = await harness.loginAs(harness.userDan, harness.storeA.id);
      await expect(
        harness.dashboardService.adjustStock(sessionStaff.sessionToken, harness.productA1.id, {
          quantity: 5,
          adjustmentType: 'INCREASE',
          reason: 'Staff attempted adjust',
        }),
      ).rejects.toThrow(PermissionDeniedError);
    });
  });
});

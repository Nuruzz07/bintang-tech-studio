/**
 * Bintang Tech Studio — Seller Dashboard Products & Categories Test Suite.
 * Baseline: Milestone M12 Seller Dashboard Foundation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSellerDashboardTestHarness, SellerDashboardTestHarness } from './test-helpers.js';
import { ProductLimitExceededError, SellerResourceNotFoundError } from '../src/errors.js';
import { PermissionDeniedError } from '@bintang/authorization';

describe('Seller Dashboard — Products & Categories Section', () => {
  let harness: SellerDashboardTestHarness;

  beforeEach(async () => {
    harness = await createSellerDashboardTestHarness();
  });

  describe('Products CRUD & Tenant Isolation', () => {
    it('lists products scoped exclusively to active store', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const products = await harness.dashboardService.listProducts(session.sessionToken);

      expect(products.length).toBe(2);
      expect(products.map((p) => p.id)).toContain(harness.productA1.id);
      expect(products.map((p) => p.id)).toContain(harness.productA2.id);
      expect(products.map((p) => p.id)).not.toContain(harness.productB1.id);
    });

    it('retrieves single product by id for active store', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const prod = await harness.dashboardService.getProduct(
        session.sessionToken,
        harness.productA1.id,
      );

      expect(prod).toBeDefined();
      expect(prod.id).toBe(harness.productA1.id);
      expect(prod.name).toBe(harness.productA1.name);
      expect(prod.price).toBe('25000.00');
    });

    it('rejects cross-tenant product lookup with ResourceNotFoundError', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      await expect(
        harness.dashboardService.getProduct(session.sessionToken, harness.productB1.id),
      ).rejects.toThrow(SellerResourceNotFoundError);
    });

    it('creates product and updates catalog when within entitlement limits', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const newProd = await harness.dashboardService.createProduct(session.sessionToken, {
        name: 'Valorant Points 1000',
        categoryId: harness.categoryA1.id,
        price: '110000.00',
        compareAtPrice: '120000.00',
        stockMode: 'TRACKED',
        productType: 'DIGITAL_CREDENTIAL',
      });

      expect(newProd).toBeDefined();
      expect(newProd.id).toBeDefined();
      expect(newProd.name).toBe('Valorant Points 1000');
      expect(newProd.storeId).toBe(harness.storeA.id);
      expect(newProd.price).toBe('110000.00');
    });

    it('enforces plan product limit (Starter allows max 20 products)', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);

      // Store A currently has 2 products. Let's add 18 more to reach limit (20)
      for (let i = 3; i <= 20; i++) {
        await harness.productRepo.create(harness.storeA.id, {
          id: `prod_bulk_${i}`,
          storeId: harness.storeA.id,
          categoryId: harness.categoryA1.id,
          name: `Bulk Product ${i}`,
          slug: `bulk-product-${i}`,
          description: null,
          productType: 'DIGITAL_CREDENTIAL',
          price: '10000.00',
          compareAtPrice: null,
          stockMode: 'UNLIMITED',
          status: 'ACTIVE',
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // 21st product creation must be rejected
      await expect(
        harness.dashboardService.createProduct(session.sessionToken, {
          name: 'Excess Product 21',
          price: '50000.00',
        }),
      ).rejects.toThrow(ProductLimitExceededError);
    });

    it('updates product attributes securely', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const updated = await harness.dashboardService.updateProduct(
        session.sessionToken,
        harness.productA1.id,
        {
          name: 'Mobile Legends 100 Diamonds (Promo)',
          price: '24000.00',
        },
      );

      expect(updated.name).toBe('Mobile Legends 100 Diamonds (Promo)');
      expect(updated.price).toBe('24000.00');
    });

    it('archives product cleanly', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const archived = await harness.dashboardService.archiveProduct(
        session.sessionToken,
        harness.productA2.id,
      );

      expect(archived.status).toBe('ARCHIVED');
    });

    it('enforces RBAC: STORE_STAFF cannot create, update, or archive products', async () => {
      const sessionStaff = await harness.loginAs(harness.userDan, harness.storeA.id);

      // Staff CAN read products
      const list = await harness.dashboardService.listProducts(sessionStaff.sessionToken);
      expect(list.length).toBeGreaterThan(0);

      // Staff CANNOT create product
      await expect(
        harness.dashboardService.createProduct(sessionStaff.sessionToken, {
          name: 'Staff Unauthorized Product',
          price: '10000.00',
        }),
      ).rejects.toThrow(PermissionDeniedError);

      // Staff CANNOT update product
      await expect(
        harness.dashboardService.updateProduct(sessionStaff.sessionToken, harness.productA1.id, {
          name: 'Staff Tampered Name',
        }),
      ).rejects.toThrow(PermissionDeniedError);

      // Staff CANNOT archive product
      await expect(
        harness.dashboardService.archiveProduct(sessionStaff.sessionToken, harness.productA1.id),
      ).rejects.toThrow(PermissionDeniedError);
    });
  });

  describe('Categories CRUD & Tenant Isolation', () => {
    it('lists categories scoped to active store', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const categories = await harness.dashboardService.listCategories(session.sessionToken);

      expect(categories.length).toBe(1);
      expect(categories[0]?.id).toBe(harness.categoryA1.id);
    });

    it('creates category with valid slug and sortOrder', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const newCat = await harness.dashboardService.createCategory(session.sessionToken, {
        name: 'Streaming Subscriptions',
        description: 'Netflix, Spotify, etc',
        sortOrder: 2,
      });

      expect(newCat.id).toBeDefined();
      expect(newCat.name).toBe('Streaming Subscriptions');
      expect(newCat.storeId).toBe(harness.storeA.id);
    });

    it('updates category details', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const updated = await harness.dashboardService.updateCategory(
        session.sessionToken,
        harness.categoryA1.id,
        {
          name: 'Voucher & Topup Game',
        },
      );

      expect(updated.name).toBe('Voucher & Topup Game');
    });

    it('archives category', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const archived = await harness.dashboardService.archiveCategory(
        session.sessionToken,
        harness.categoryA1.id,
      );

      expect(archived.status).toBe('ARCHIVED');
    });

    it('rejects cross-tenant category update with ResourceNotFoundError', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      await expect(
        harness.dashboardService.updateCategory(session.sessionToken, harness.categoryB1.id, {
          name: 'Store A Tampering Store B Category',
        }),
      ).rejects.toThrow(SellerResourceNotFoundError);
    });

    it('enforces RBAC: STORE_STAFF cannot create or archive categories', async () => {
      const sessionStaff = await harness.loginAs(harness.userDan, harness.storeA.id);

      await expect(
        harness.dashboardService.createCategory(sessionStaff.sessionToken, {
          name: 'Staff Unauthorized Category',
        }),
      ).rejects.toThrow(PermissionDeniedError);

      await expect(
        harness.dashboardService.archiveCategory(sessionStaff.sessionToken, harness.categoryA1.id),
      ).rejects.toThrow(PermissionDeniedError);
    });
  });
});

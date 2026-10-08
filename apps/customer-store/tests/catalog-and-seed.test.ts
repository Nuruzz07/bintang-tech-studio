import { describe, it, expect, beforeEach } from 'vitest';
import { createCustomerStoreTestHarness, CustomerStoreTestHarness } from './test-helpers.js';
import { seedTemplate01Catalog } from '../src/index.js';

describe('Customer Store — Catalog & Template 01 Seed (M05 / M06 Integration)', () => {
  let harness: CustomerStoreTestHarness;

  beforeEach(async () => {
    harness = await createCustomerStoreTestHarness();
  });

  it('successfully seeds the authoritative 8 categories and 36 products', async () => {
    const { customerStoreService, resolvedStore } = harness;

    const catalog = await customerStoreService.getCatalog(resolvedStore);

    expect(catalog.categories).toHaveLength(8);
    expect(catalog.products).toHaveLength(36);

    const categorySlugs = catalog.categories.map((c) => c.slug);
    expect(categorySlugs).toContain('streaming');
    expect(categorySlugs).toContain('ai-productivity');
    expect(categorySlugs).toContain('design');
    expect(categorySlugs).toContain('gaming');
    expect(categorySlugs).toContain('software');
    expect(categorySlugs).toContain('cloud-storage');
    expect(categorySlugs).toContain('education');
    expect(categorySlugs).toContain('digital-tools');
  });

  it('guarantees seed idempotency: repeated execution reuses categories and products without duplicates', async () => {
    const { catalogService, inventoryService, contextResolver, resolvedStore } = harness;
    const storeCtx = contextResolver.toStoreContext(resolvedStore);

    const secondSeed = await seedTemplate01Catalog(storeCtx, catalogService, inventoryService);

    expect(secondSeed.categoriesCreated).toBe(0);
    expect(secondSeed.categoriesReused).toBe(8);
    expect(secondSeed.productsCreated).toBe(0);
    expect(secondSeed.productsReused).toBe(36);

    // Verify catalog count remains strictly 8 and 36
    const catalog = await harness.customerStoreService.getCatalog(resolvedStore);
    expect(catalog.categories).toHaveLength(8);
    expect(catalog.products).toHaveLength(36);
  });

  it('filters catalog products by category slug accurately', async () => {
    const { customerStoreService, resolvedStore } = harness;

    const streamingCatalog = await customerStoreService.getCatalog(resolvedStore, {
      categorySlug: 'streaming',
    });
    expect(streamingCatalog.products).toHaveLength(5);
    for (const prod of streamingCatalog.products) {
      expect(prod.categoryName).toBe('Streaming');
    }

    const aiCatalog = await customerStoreService.getCatalog(resolvedStore, {
      categorySlug: 'ai-productivity',
    });
    expect(aiCatalog.products).toHaveLength(6);
    for (const prod of aiCatalog.products) {
      expect(prod.categoryName).toBe('AI & Productivity');
    }
  });

  it('supports text search filtering across product name and description', async () => {
    const { customerStoreService, resolvedStore } = harness;

    const searchResults = await customerStoreService.getCatalog(resolvedStore, {
      search: 'canva',
    });
    expect(searchResults.products.length).toBeGreaterThanOrEqual(1);
    expect(searchResults.products.some((p) => p.name === 'Canva Pro 1 Tahun')).toBe(true);
  });

  it('retrieves rich authoritative product details including benefits, duration, and stock', async () => {
    const { customerStoreService, resolvedStore } = harness;

    const catalog = await customerStoreService.getCatalog(resolvedStore);
    const spotifySummary = catalog.products.find((p) => p.name === 'Spotify Premium')!;

    const detail = await customerStoreService.getProductDetail(resolvedStore, spotifySummary.id);

    expect(detail.id).toBe(spotifySummary.id);
    expect(detail.name).toBe('Spotify Premium');
    expect(detail.price).toBe('19000.00');
    expect(detail.formattedPrice).toBe('Rp 19.000');
    expect(detail.compareAtPrice).toBe('55000.00');
    expect(detail.formattedCompareAtPrice).toBe('Rp 55.000');
    expect(detail.duration).toBe('1 Bulan (Private)');
    expect(detail.monogram).toBe('SP');
    expect(detail.benefits).toHaveLength(4);
    expect(detail.benefits[0]).toBe('Bebas iklan 100%');
    expect(detail.stockQuantity).toBe(24);
    expect(detail.isAvailable).toBe(true);
  });

  it('lists promotional vouchers for customer display', () => {
    const { customerStoreService } = harness;

    const vouchers = customerStoreService.listPromotionalVouchers();
    expect(vouchers.length).toBe(5);

    const bintang10 = vouchers.find((v) => v.code === 'BINTANG10');
    expect(bintang10).toBeDefined();
    expect(bintang10?.badge).toBe('Diskon 10%');
    expect(bintang10?.status).toBe('ACTIVE');

    const expired = vouchers.find((v) => v.code === 'EXPIRED2025');
    expect(expired?.status).toBe('EXPIRED');
  });
});

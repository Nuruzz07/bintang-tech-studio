import { describe, it, expect, beforeEach } from 'vitest';
import { createCustomerStoreTestHarness, CustomerStoreTestHarness } from './test-helpers.js';
import { ClientCartManager } from '../src/index.js';

describe('Customer Store — Cart & Authoritative Valuation (M05 / M06 / M07)', () => {
  let harness: CustomerStoreTestHarness;

  beforeEach(async () => {
    harness = await createCustomerStoreTestHarness();
  });

  it('calculates cart valuation authoritatively based on server-side product prices', async () => {
    const { customerStoreService, resolvedStore } = harness;

    const catalog = await customerStoreService.getCatalog(resolvedStore);
    const spotify = catalog.products.find((p) => p.name === 'Spotify Premium')!; // 19000.00
    const canva = catalog.products.find((p) => p.name === 'Canva Pro 1 Tahun')!; // 15000.00

    const draftItems = [
      { productId: spotify.id, quantity: 2 }, // 38000.00
      { productId: canva.id, quantity: 1 }, // 15000.00
    ];

    const valuation = await customerStoreService.getCartValuation(resolvedStore, draftItems);

    expect(valuation.isValid).toBe(true);
    expect(valuation.lines).toHaveLength(2);
    expect(valuation.lines[0]!.unitPrice).toBe('19000.00');
    expect(valuation.lines[0]!.lineTotal).toBe('38000.00');
    expect(valuation.lines[1]!.unitPrice).toBe('15000.00');
    expect(valuation.lines[1]!.lineTotal).toBe('15000.00');
    expect(valuation.subtotal).toBe('53000.00');
    expect(valuation.grandTotal).toBe('53000.00');
  });

  it('rejects cart valuation if an item has zero or negative quantity', async () => {
    const { customerStoreService, resolvedStore } = harness;

    const catalog = await customerStoreService.getCatalog(resolvedStore);
    const spotify = catalog.products.find((p) => p.name === 'Spotify Premium')!;

    const draftItems = [{ productId: spotify.id, quantity: 0 }];

    const valuation = await customerStoreService.getCartValuation(resolvedStore, draftItems);

    expect(valuation.isValid).toBe(false);
    expect(valuation.validationIssues.length).toBeGreaterThan(0);
    expect(valuation.validationIssues[0]).toContain('greater than zero');
  });

  it('detects and flags out-of-stock items during cart valuation', async () => {
    const { customerStoreService, resolvedStore } = harness;

    const catalog = await customerStoreService.getCatalog(resolvedStore);
    const midjourney = catalog.products.find((p) => p.name === 'Midjourney Standard')!; // stock: 8

    // Request 100 units (way above available stock of 8)
    const draftItems = [{ productId: midjourney.id, quantity: 100 }];

    const valuation = await customerStoreService.getCartValuation(resolvedStore, draftItems);

    expect(valuation.isValid).toBe(false);
    expect(valuation.validationIssues.some((issue) => issue.includes('tidak mencukupi'))).toBe(
      true,
    );
    expect(valuation.lines[0]!.isAvailable).toBe(false);
    expect(valuation.lines[0]!.stockIssue).toContain('Requested 100');
  });

  it('manages client-side cart draft in memory while acknowledging it is UI state only', () => {
    const cartManager = new ClientCartManager('00000000-0000-0000-0000-000000000001');

    cartManager.addItem({ productId: 'prod_1', name: 'Spotify', priceDisplay: 'Rp 19.000' }, 1);
    cartManager.addItem({ productId: 'prod_1', name: 'Spotify', priceDisplay: 'Rp 19.000' }, 2);
    cartManager.addItem({ productId: 'prod_2', name: 'Canva', priceDisplay: 'Rp 15.000' }, 1);

    expect(cartManager.getTotalCount()).toBe(4);
    expect(cartManager.getItems()).toHaveLength(2);

    const payload = cartManager.toServerPayload();
    expect(payload).toEqual([
      { productId: 'prod_1', quantity: 3 },
      { productId: 'prod_2', quantity: 1 },
    ]);

    cartManager.updateQuantity('prod_1', 1);
    expect(cartManager.getTotalCount()).toBe(2);

    cartManager.removeItem('prod_2');
    expect(cartManager.getItems()).toHaveLength(1);

    cartManager.clear();
    expect(cartManager.getTotalCount()).toBe(0);
  });
});

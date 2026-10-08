import { describe, it, expect, beforeEach } from 'vitest';
import { createCustomerStoreTestHarness, CustomerStoreTestHarness } from './test-helpers.js';
import { IdempotencyConflictError } from '@bintang/orders';

describe('Customer Store — Concurrency & Idempotency Defenses (M06 / M07 / M10)', () => {
  let harness: CustomerStoreTestHarness;

  beforeEach(async () => {
    harness = await createCustomerStoreTestHarness();
  });

  it('guarantees identical response when repeating checkout with the same idempotency key', async () => {
    const { customerStoreService, resolvedStore, customerSessionA } = harness;

    const catalog = await customerStoreService.getCatalog(resolvedStore);
    const spotify = catalog.products.find((p) => p.name === 'Spotify Premium')!;

    const key = 'idem_key_chk_repeat_101';

    const order1 = await customerStoreService.checkout(resolvedStore, customerSessionA, {
      items: [{ productId: spotify.id, quantity: 1 }],
      customerName: 'Alice',
      idempotencyKey: key,
    });

    const order2 = await customerStoreService.checkout(resolvedStore, customerSessionA, {
      items: [{ productId: spotify.id, quantity: 1 }],
      customerName: 'Alice',
      idempotencyKey: key,
    });

    expect(order1.orderId).toBe(order2.orderId);
    expect(order1.orderNumber).toBe(order2.orderNumber);
    expect(order1.grandTotal).toBe(order2.grandTotal);
  });

  it('detects and rejects payload tampering on the same idempotency key', async () => {
    const { customerStoreService, resolvedStore, customerSessionA } = harness;

    const catalog = await customerStoreService.getCatalog(resolvedStore);
    const spotify = catalog.products.find((p) => p.name === 'Spotify Premium')!;

    const key = 'idem_key_chk_tamper_202';

    await customerStoreService.checkout(resolvedStore, customerSessionA, {
      items: [{ productId: spotify.id, quantity: 1 }],
      customerName: 'Alice',
      idempotencyKey: key,
    });

    // Mutate quantity from 1 to 2 with same key
    await expect(
      customerStoreService.checkout(resolvedStore, customerSessionA, {
        items: [{ productId: spotify.id, quantity: 2 }],
        customerName: 'Alice',
        idempotencyKey: key,
      }),
    ).rejects.toThrow(IdempotencyConflictError);
  });

  it('prevents inventory overselling when parallel checkouts compete for limited stock', async () => {
    const {
      customerStoreService,
      resolvedStore,
      customerSessionA,
      customerSessionB,
      catalogService,
      inventoryService,
      contextResolver,
    } = harness;
    const storeCtx = contextResolver.toStoreContext(resolvedStore);

    // Create a product with strictly 1 unit of stock
    const rareProd = await catalogService.createProduct(storeCtx, {
      name: 'Rare License 1x',
      slug: 'rare-lic-1x',
      price: '100000.00',
      stockMode: 'TRACKED',
      status: 'ACTIVE',
    });

    await inventoryService.initializeInventory(storeCtx, rareProd.id, 1);

    // Customer A and Customer B both attempt to buy the only available unit in parallel
    const promiseA = customerStoreService.checkout(resolvedStore, customerSessionA, {
      items: [{ productId: rareProd.id, quantity: 1 }],
      customerName: 'Alice',
      idempotencyKey: 'buy_rare_alice',
    });

    const promiseB = customerStoreService.checkout(resolvedStore, customerSessionB, {
      items: [{ productId: rareProd.id, quantity: 1 }],
      customerName: 'Bob',
      idempotencyKey: 'buy_rare_bob',
    });

    const results = await Promise.allSettled([promiseA, promiseB]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    // Exactly one must succeed, and one must fail due to out-of-stock
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    // Final inventory: exactly 1 reserved, 0 available
    const finalInv = await inventoryService.getInventory(storeCtx, rareProd.id);
    expect(finalInv.quantityOnHand).toBe(1);
    expect(finalInv.quantityReserved).toBe(1);
  });

  it('consistently returns customer order history across repeated fetches', async () => {
    const { customerStoreService, resolvedStore, customerSessionA } = harness;

    const catalog = await customerStoreService.getCatalog(resolvedStore);
    const spotify = catalog.products.find((p) => p.name === 'Spotify Premium')!;

    await customerStoreService.checkout(resolvedStore, customerSessionA, {
      items: [{ productId: spotify.id, quantity: 1 }],
      customerName: 'Alice',
    });

    const list1 = await customerStoreService.listCustomerOrders(resolvedStore, customerSessionA);
    const list2 = await customerStoreService.listCustomerOrders(resolvedStore, customerSessionA);

    expect(list1).toHaveLength(1);
    expect(list2).toHaveLength(1);
    expect(list1[0]!.orderNumber).toBe(list2[0]!.orderNumber);
  });
});

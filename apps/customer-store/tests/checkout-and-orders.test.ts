import { describe, it, expect, beforeEach } from 'vitest';
import { createCustomerStoreTestHarness, CustomerStoreTestHarness } from './test-helpers.js';
import { CheckoutValidationError, CartValidationError } from '../src/index.js';

describe('Customer Store — Checkout & Authoritative Orders (M07 Integration)', () => {
  let harness: CustomerStoreTestHarness;

  beforeEach(async () => {
    harness = await createCustomerStoreTestHarness();
  });

  it('successfully creates an authoritative order with inventory reservation via M07', async () => {
    const {
      customerStoreService,
      resolvedStore,
      customerSessionA,
      inventoryService,
      contextResolver,
    } = harness;
    const storeCtx = contextResolver.toStoreContext(resolvedStore);

    const catalog = await customerStoreService.getCatalog(resolvedStore);
    const spotify = catalog.products.find((p) => p.name === 'Spotify Premium')!; // stock: 24, price: 19000

    const initialInv = await inventoryService.getInventory(storeCtx, spotify.id);
    expect(initialInv.quantityReserved).toBe(0);

    const checkoutResult = await customerStoreService.checkout(resolvedStore, customerSessionA, {
      items: [{ productId: spotify.id, quantity: 2 }],
      customerName: 'Alice Customer',
      customerEmail: 'alice@example.com',
      customerPhone: '08123456789',
      notes: 'Harap kirim segera',
    });

    expect(checkoutResult.orderId).toBeDefined();
    expect(checkoutResult.orderNumber).toMatch(/^ORD-/);
    expect(checkoutResult.status).toBe('PENDING_PAYMENT');
    expect(checkoutResult.subtotal).toBe('38000.00');
    expect(checkoutResult.grandTotal).toBe('38000.00');
    expect(checkoutResult.items).toHaveLength(1);
    expect(checkoutResult.items[0]!.productName).toBe('Spotify Premium');
    expect(checkoutResult.items[0]!.unitPrice).toBe('19000.00');
    expect(checkoutResult.items[0]!.quantity).toBe(2);
    expect(checkoutResult.items[0]!.subtotal).toBe('38000.00');

    // Verify inventory reservation in M06
    const updatedInv = await inventoryService.getInventory(storeCtx, spotify.id);
    expect(updatedInv.quantityReserved).toBe(2);
    expect(updatedInv.quantityOnHand).toBe(24);
  });

  it('rejects checkout with empty items or missing customer name', async () => {
    const { customerStoreService, resolvedStore, customerSessionA } = harness;

    await expect(
      customerStoreService.checkout(resolvedStore, customerSessionA, {
        items: [],
        customerName: 'Alice',
      }),
    ).rejects.toThrow(CheckoutValidationError);

    await expect(
      customerStoreService.checkout(resolvedStore, customerSessionA, {
        items: [{ productId: 'any_prod', quantity: 1 }],
        customerName: '   ',
      }),
    ).rejects.toThrow(CheckoutValidationError);
  });

  it('rejects checkout if cart contains out of stock items', async () => {
    const { customerStoreService, resolvedStore, customerSessionA } = harness;

    const catalog = await customerStoreService.getCatalog(resolvedStore);
    const midjourney = catalog.products.find((p) => p.name === 'Midjourney Standard')!; // stock: 8

    await expect(
      customerStoreService.checkout(resolvedStore, customerSessionA, {
        items: [{ productId: midjourney.id, quantity: 20 }],
        customerName: 'Alice',
      }),
    ).rejects.toThrow(CartValidationError);
  });

  it('supports idempotency key on checkout to prevent duplicate orders', async () => {
    const { customerStoreService, resolvedStore, customerSessionA } = harness;

    const catalog = await customerStoreService.getCatalog(resolvedStore);
    const spotify = catalog.products.find((p) => p.name === 'Spotify Premium')!;

    const idempotencyKey = 'idemp_chk_order_001';

    const order1 = await customerStoreService.checkout(resolvedStore, customerSessionA, {
      items: [{ productId: spotify.id, quantity: 1 }],
      customerName: 'Alice',
      idempotencyKey,
    });

    const order2 = await customerStoreService.checkout(resolvedStore, customerSessionA, {
      items: [{ productId: spotify.id, quantity: 1 }],
      customerName: 'Alice',
      idempotencyKey,
    });

    expect(order1.orderId).toBe(order2.orderId);
    expect(order1.orderNumber).toBe(order2.orderNumber);
  });
});

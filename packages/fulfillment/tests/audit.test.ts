import { describe, it, expect, beforeEach } from 'vitest';
import { createTestHarness, setupProductAndOrder, TestHarness } from './test-helpers.js';
import {
  PublicFulfillment,
  FulfillmentNotFoundError,
  FulfillmentOrderNotPayableError,
} from '../src/index.js';
import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import { Product } from '@bintang/commerce';

describe('M09 Fulfillment Comprehensive Audit & Lifecycle Suite', () => {
  let h: TestHarness;

  beforeEach(() => {
    h = createTestHarness('store_audit_master');
  });

  it('completes the entire end-to-end digital fulfillment journey cleanly', async () => {
    // 1. Setup Product with Tracked stock and 3 serialized credentials
    const { product, order } = await setupProductAndOrder(h, {
      stockMode: 'TRACKED',
      initialStock: 10,
      withDigitalItems: true,
      orderStatus: 'PENDING_PAYMENT',
    });

    // 2. Initial state checks
    let inv = await h.inventoryService.getInventory(h.sellerContext, product.id);
    expect(inv.quantityOnHand).toBe(10);
    expect(inv.quantityReserved).toBe(1);

    // 3. Reject fulfillment creation prior to payment
    await expect(
      h.fulfillmentService.createFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { orderId: order.id },
      ),
    ).rejects.toThrow(FulfillmentOrderNotPayableError);

    // 4. Customer pays (transition to PAID)
    await h.orderService.transitionStatus(h.sellerContext, order.id, 'PAID');

    // 5. Inventory remains unconsumed at PAID
    inv = await h.inventoryService.getInventory(h.sellerContext, product.id);
    expect(inv.quantityOnHand).toBe(10);
    expect(inv.quantityReserved).toBe(1);

    // 6. Seller creates fulfillment
    const fulfillment = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id, strategy: 'DIGITAL_AUTO' },
    );
    expect(fulfillment.status).toBe('PENDING');
    const assignedCredentialId = fulfillment.items[0]?.inventoryItemId;
    expect(assignedCredentialId).not.toBeNull();

    // 7. Verify credential is marked ASSIGNED
    const assignedItems = await h.inventoryService.listInventoryItems(
      h.sellerContext,
      product.id,
      'ASSIGNED',
    );
    expect(assignedItems.some((i) => i.id === assignedCredentialId)).toBe(true);

    // 8. Seller executes fulfillment delivery
    const executed = await h.fulfillmentService.executeFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { fulfillmentId: fulfillment.id },
    );
    expect(executed.status).toBe('FULFILLED');
    expect(executed.items[0]?.status).toBe('DELIVERED');
    expect(executed.items[0]?.payloadReference).toContain(assignedCredentialId!);

    // 9. Order is automatically updated to FULFILLED
    const finishedOrder = await h.orderRepo.findById(h.storeId, order.id);
    expect(finishedOrder?.status).toBe('FULFILLED');

    // 10. Inventory reservation is consumed exactly once
    inv = await h.inventoryService.getInventory(h.sellerContext, product.id);
    expect(inv.quantityOnHand).toBe(9);
    expect(inv.quantityReserved).toBe(0);

    // 11. Customer views sanitized PublicFulfillment
    const customerCaller = {
      type: 'CUSTOMER' as const,
      context: { storeId: h.storeId, customerId: h.customerA.id },
    };
    const pub = (await h.fulfillmentService.getFulfillment(
      customerCaller,
      fulfillment.id,
    )) as PublicFulfillment;

    expect(pub.id).toBe(fulfillment.id);
    expect(pub.status).toBe('FULFILLED');
    expect(pub.items[0]?.status).toBe('DELIVERED');
    expect(pub.items[0]?.payloadReference).toBeDefined();
    // Sanitized: internal inventoryItemId is NOT exposed to customer
    expect('inventoryItemId' in (pub.items[0] ?? {})).toBe(false);
  });

  it('completes the end-to-end failure, hold, and recovery cycle', async () => {
    const { product, order } = await setupProductAndOrder(h, {
      stockMode: 'TRACKED',
      initialStock: 5,
      orderStatus: 'PAID',
    });

    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    // 1. Simulate gateway network failure
    h.mockProvider.setShouldFail(true, {
      failureCode: 'NET_TIMEOUT',
      failureReason: 'Socket timeout during dispatch',
      retryable: true,
    });

    await expect(
      h.fulfillmentService.executeFulfillment(
        { type: 'SELLER', context: h.sellerContext },
        { fulfillmentId: f.id },
      ),
    ).rejects.toThrow();

    // 2. Inventory is NOT consumed or released
    let inv = await h.inventoryService.getInventory(h.sellerContext, product.id);
    expect(inv.quantityOnHand).toBe(5);
    expect(inv.quantityReserved).toBe(1);

    // 3. Retry while provider is operational
    h.mockProvider.setShouldFail(false);
    const recovered = await h.fulfillmentService.retryFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { fulfillmentId: f.id },
    );

    expect(recovered.status).toBe('FULFILLED');

    // 4. Inventory is consumed exactly once
    inv = await h.inventoryService.getInventory(h.sellerContext, product.id);
    expect(inv.quantityOnHand).toBe(4);
    expect(inv.quantityReserved).toBe(0);
  });

  it('completes the end-to-end cancellation with inventory restoration', async () => {
    const { product, order } = await setupProductAndOrder(h, {
      stockMode: 'TRACKED',
      withDigitalItems: true,
      orderStatus: 'PAID',
    });

    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    const credentialId = f.items[0]?.inventoryItemId;
    expect(credentialId).not.toBeNull();

    // Cancel fulfillment
    const cancelled = await h.fulfillmentService.cancelFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      f.id,
      'Customer requested cancellation before dispatch',
    );

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.items[0]?.status).toBe('REVOKED');

    // Verify digital credential returned to AVAILABLE
    const available = await h.inventoryService.listInventoryItems(
      h.sellerContext,
      product.id,
      'AVAILABLE',
    );
    expect(available.some((i) => i.id === credentialId)).toBe(true);
  });

  it('supports fulfillment for SERVICE products', async () => {
    const now = new Date().toISOString();
    const serviceProductId = 'prod_service_101';
    const serviceProduct: Product = {
      id: serviceProductId,
      storeId: h.storeId,
      categoryId: null,
      name: '1-on-1 Consultation Call',
      slug: 'consultation-call',
      description: '60 minutes consulting',
      productType: 'SERVICE',
      price: '150000.00',
      compareAtPrice: null,
      stockMode: 'UNLIMITED',
      status: 'ACTIVE',
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };
    await h.productRepo.create(h.storeId, serviceProduct);

    await h.customerRepo.create(h.storeId, h.customerA);
    const order = await h.orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId: h.storeId, customerId: h.customerA.id } },
      { items: [{ productId: serviceProductId, quantity: 1 }] },
    );
    await h.orderService.transitionStatus(h.sellerContext, order.id, 'PAID');

    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id, strategy: 'SERVICE' },
    );
    expect(f.strategy).toBe('SERVICE');
    expect(f.items[0]?.itemType).toBe('SERVICE');

    const executed = await h.fulfillmentService.executeFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { fulfillmentId: f.id },
    );
    expect(executed.status).toBe('FULFILLED');
  });

  it('resists hostile cross-tenant tampering across all fulfillment endpoints', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });
    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    const attackerContext = createAuthenticatedStoreContext({
      storeId: 'store_attacker_evil',
      userId: 'user_evil',
      membershipId: 'mem_evil',
      role: 'STORE_OWNER',
    });

    const attackerSeller = { type: 'SELLER' as const, context: attackerContext };

    // Attack 1: read Store A fulfillment
    await expect(h.fulfillmentService.getFulfillment(attackerSeller, f.id)).rejects.toThrow(
      FulfillmentNotFoundError,
    );

    // Attack 2: execute Store A fulfillment
    await expect(
      h.fulfillmentService.executeFulfillment(attackerSeller, { fulfillmentId: f.id }),
    ).rejects.toThrow(FulfillmentNotFoundError);

    // Attack 3: retry Store A fulfillment
    await expect(
      h.fulfillmentService.retryFulfillment(attackerSeller, { fulfillmentId: f.id }),
    ).rejects.toThrow(FulfillmentNotFoundError);

    // Attack 4: cancel Store A fulfillment
    await expect(h.fulfillmentService.cancelFulfillment(attackerSeller, f.id)).rejects.toThrow(
      FulfillmentNotFoundError,
    );
  });
});

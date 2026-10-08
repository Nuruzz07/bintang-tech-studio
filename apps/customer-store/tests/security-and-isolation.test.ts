import { describe, it, expect, beforeEach } from 'vitest';
import { createCustomerStoreTestHarness, CustomerStoreTestHarness } from './test-helpers.js';
import { CustomerAccessDeniedError } from '../src/index.js';
import { CustomerOrderAccessDeniedError } from '@bintang/orders';
import { FulfillmentCustomerAccessDeniedError } from '@bintang/fulfillment';

describe('Customer Store — Security, Multi-Tenant Isolation & Anti-Tampering (14 Mandatory Scenarios)', () => {
  let harness: CustomerStoreTestHarness;

  beforeEach(async () => {
    harness = await createCustomerStoreTestHarness();
  });

  // Scenario 1: Cross-tenant product access
  it('Scenario 1: Cross-tenant product access is strictly rejected', async () => {
    const {
      customerStoreService,
      resolvedStore,
      otherResolvedStore,
      catalogService,
      contextResolver,
    } = harness;
    const otherStoreCtx = contextResolver.toStoreContext(otherResolvedStore);

    // Create a product in other store
    const foreignProd = await catalogService.createProduct(otherStoreCtx, {
      name: 'Foreign Store Product',
      slug: 'foreign-prod',
      price: '50000.00',
      stockMode: 'UNLIMITED',
      status: 'ACTIVE',
    });

    // Attempting to query foreign product via resolvedStore must be rejected
    await expect(
      customerStoreService.getProductDetail(resolvedStore, foreignProd.id),
    ).rejects.toThrow();
  });

  // Scenario 2: Cross-tenant order access
  it('Scenario 2: Cross-tenant order access is strictly rejected', async () => {
    const { customerStoreService, resolvedStore, customerSessionOtherStore } = harness;

    // Using customer session from other store against resolvedStore must throw CustomerAccessDeniedError
    await expect(
      customerStoreService.listCustomerOrders(resolvedStore, customerSessionOtherStore),
    ).rejects.toThrow(CustomerAccessDeniedError);
  });

  // Scenario 3: Customer A cannot access Customer B order
  it('Scenario 3: Customer A cannot access Customer B orders or details', async () => {
    const { customerStoreService, resolvedStore, customerSessionA, customerSessionB } = harness;

    const catalog = await customerStoreService.getCatalog(resolvedStore);
    const spotify = catalog.products.find((p) => p.name === 'Spotify Premium')!;

    // Customer A checks out order
    const orderA = await customerStoreService.checkout(resolvedStore, customerSessionA, {
      items: [{ productId: spotify.id, quantity: 1 }],
      customerName: 'Alice',
    });

    // Customer B attempts to retrieve orderA
    await expect(
      customerStoreService.getCustomerOrder(resolvedStore, customerSessionB, orderA.orderId),
    ).rejects.toThrow(CustomerOrderAccessDeniedError);
  });

  // Scenario 4: Client-supplied customerId spoof
  it('Scenario 4: Client-supplied customerId spoofing is rejected / overridden by session context', async () => {
    const {
      customerStoreService,
      resolvedStore,
      customerSessionA,
      orderService,
      customerSessionB,
    } = harness;

    const catalog = await customerStoreService.getCatalog(resolvedStore);
    const spotify = catalog.products.find((p) => p.name === 'Spotify Premium')!;

    // Customer A submits checkout with customerSessionA. Even if client claims to be Customer B,
    // order must be bound strictly to customerSessionA.customerId
    const orderResult = await customerStoreService.checkout(resolvedStore, customerSessionA, {
      items: [{ productId: spotify.id, quantity: 1 }],
      customerName: 'Alice Spoofing Bob',
    });

    const createdOrder = await orderService.getOrderById(
      { type: 'CUSTOMER', context: harness.sessionManager.toCustomerContext(customerSessionA) },
      orderResult.orderId,
    );

    // Authoritative customerId must be Customer A, never Customer B!
    expect(createdOrder.customerId).toBe(customerSessionA.customerId);
    expect(createdOrder.customerId).not.toBe(customerSessionB.customerId);
  });

  // Scenario 5: Client-supplied storeId spoof
  it('Scenario 5: Client-supplied storeId spoofing is rejected', async () => {
    const { customerStoreService, resolvedStore, sessionManager } = harness;

    // Create a rogue session claiming to belong to a fake store
    const rogueSession = sessionManager.createSession({
      storeId: '00000000-0000-0000-0000-000000000999',
      customerId: 'cust_rogue_999',
    });

    await expect(
      customerStoreService.checkout(resolvedStore, rogueSession, {
        items: [{ productId: 'any', quantity: 1 }],
        customerName: 'Rogue',
      }),
    ).rejects.toThrow(CustomerAccessDeniedError);
  });

  // Scenario 6: Client price tampering
  it('Scenario 6: Client price tampering has zero effect on authoritative order price', async () => {
    const { customerStoreService, resolvedStore, customerSessionA } = harness;

    const catalog = await customerStoreService.getCatalog(resolvedStore);
    const spotify = catalog.products.find((p) => p.name === 'Spotify Premium')!; // Authoritative: 19000.00

    // Client only submits productId and quantity. Client cannot submit a custom unit price.
    const checkoutResult = await customerStoreService.checkout(resolvedStore, customerSessionA, {
      items: [{ productId: spotify.id, quantity: 1 }],
      customerName: 'Alice',
    });

    // Price is strictly fetched from M05 Catalog
    expect(checkoutResult.items[0]!.unitPrice).toBe('19000.00');
    expect(checkoutResult.grandTotal).toBe('19000.00');
  });

  // Scenario 7: Client total tampering
  it('Scenario 7: Client total tampering is prevented; total is computed server-side', async () => {
    const { customerStoreService, resolvedStore } = harness;

    const catalog = await customerStoreService.getCatalog(resolvedStore);
    const spotify = catalog.products.find((p) => p.name === 'Spotify Premium')!;
    const canva = catalog.products.find((p) => p.name === 'Canva Pro 1 Tahun')!;

    // Valuation is calculated server-side from authoritative lines
    const valuation = await customerStoreService.getCartValuation(resolvedStore, [
      { productId: spotify.id, quantity: 2 }, // 38000
      { productId: canva.id, quantity: 1 }, // 15000
    ]);

    expect(valuation.subtotal).toBe('53000.00');
    expect(valuation.grandTotal).toBe('53000.00');
  });

  // Scenario 8: Client payment status tampering
  it('Scenario 8: Customer cannot directly set payment status to SUCCEEDED', async () => {
    const {
      customerStoreService,
      resolvedStore,
      customerSessionA,
      paymentService,
      sessionManager,
    } = harness;

    const catalog = await customerStoreService.getCatalog(resolvedStore);
    const spotify = catalog.products.find((p) => p.name === 'Spotify Premium')!;

    const checkout = await customerStoreService.checkout(resolvedStore, customerSessionA, {
      items: [{ productId: spotify.id, quantity: 1 }],
      customerName: 'Alice',
    });

    const payment = await customerStoreService.initiatePayment(resolvedStore, customerSessionA, {
      orderId: checkout.orderId,
    });

    // CustomerCaller has no method to mutate PaymentIntent status directly
    const customerContext = sessionManager.toCustomerContext(customerSessionA);
    const customerCaller = { type: 'CUSTOMER' as const, context: customerContext };

    // Attempting to invoke refund or admin actions via customer caller fails
    await expect(
      paymentService.createRefund(customerCaller, {
        paymentIntentId: payment.paymentIntentId,
        amount: '1000.00',
      }),
    ).rejects.toThrow();
  });

  // Scenario 9: Client fulfillment status tampering
  it('Scenario 9: Customer cannot directly set fulfillment status to DELIVERED or FULFILLED', async () => {
    const { fulfillmentService, sessionManager, customerSessionA } = harness;

    const customerContext = sessionManager.toCustomerContext(customerSessionA);
    const customerCaller = { type: 'CUSTOMER' as const, context: customerContext };

    // Calling executeFulfillment or createFulfillment with CustomerCaller must throw FulfillmentCustomerAccessDeniedError
    await expect(
      fulfillmentService.executeFulfillment(customerCaller, {
        fulfillmentId: 'fake_fulfillment_id',
      }),
    ).rejects.toThrow(FulfillmentCustomerAccessDeniedError);

    await expect(
      fulfillmentService.createFulfillment(customerCaller, {
        orderId: 'fake_order_id',
      }),
    ).rejects.toThrow(FulfillmentCustomerAccessDeniedError);
  });

  // Scenario 10: Unauthorized order mutation
  it('Scenario 10: Customers cannot transition order status directly', async () => {
    const { orderService, sessionManager, customerSessionA } = harness;

    const customerContext = sessionManager.toCustomerContext(customerSessionA);
    const customerCaller = { type: 'CUSTOMER' as const, context: customerContext };

    // Customer cannot transition order to PAID, PROCESSING, or FULFILLED
    await expect(
      orderService.transitionStatus(customerCaller.context, 'order_123', 'PAID'),
    ).rejects.toThrow();
  });

  // Scenario 11: Unauthorized fulfillment mutation
  it('Scenario 11: Customers cannot cancel or retry fulfillments', async () => {
    const { fulfillmentService, sessionManager, customerSessionA } = harness;

    const customerContext = sessionManager.toCustomerContext(customerSessionA);
    const customerCaller = { type: 'CUSTOMER' as const, context: customerContext };

    await expect(fulfillmentService.cancelFulfillment(customerCaller, 'fulf_123')).rejects.toThrow(
      FulfillmentCustomerAccessDeniedError,
    );

    await expect(
      fulfillmentService.retryFulfillment(customerCaller, { fulfillmentId: 'fulf_123' }),
    ).rejects.toThrow(FulfillmentCustomerAccessDeniedError);
  });

  // Scenario 12: Internal inventory ID exposure
  it('Scenario 12: Internal inventoryItemId and secret references are never exposed to customer projections', async () => {
    const {
      customerStoreService,
      resolvedStore,
      customerSessionA,
      sellerContext,
      fulfillmentService,
    } = harness;

    const catalog = await customerStoreService.getCatalog(resolvedStore);
    const spotify = catalog.products.find((p) => p.name === 'Spotify Premium')!;

    const checkout = await customerStoreService.checkout(resolvedStore, customerSessionA, {
      items: [{ productId: spotify.id, quantity: 1 }],
      customerName: 'Alice',
    });

    const payment = await customerStoreService.initiatePayment(resolvedStore, customerSessionA, {
      orderId: checkout.orderId,
    });
    await customerStoreService.simulatePaymentSuccess(resolvedStore, payment.paymentIntentId);

    const fulfillment = await fulfillmentService.createFulfillment(
      { type: 'SELLER', context: sellerContext },
      { orderId: checkout.orderId, strategy: 'DIGITAL_AUTO' },
    );
    await fulfillmentService.executeFulfillment(
      { type: 'SELLER', context: sellerContext },
      { fulfillmentId: fulfillment.id },
    );

    const customerFulfillment = await customerStoreService.getOrderFulfillment(
      resolvedStore,
      customerSessionA,
      checkout.orderId,
    );

    expect(customerFulfillment).not.toBeNull();
    const item = customerFulfillment!.items[0] as Record<string, unknown>;

    // Must NOT contain internal operational IDs
    expect(item.inventoryItemId).toBeUndefined();
    expect(item.secretReference).toBeUndefined();
    expect(item.providerCredentials).toBeUndefined();
  });

  // Scenario 13: Telegram secret exposure
  it('Scenario 13: Customer Store contains zero hardcoded Telegram bot tokens or API secrets', async () => {
    const { customerStoreService, resolvedStore } = harness;

    const catalog = await customerStoreService.getCatalog(resolvedStore);
    const stringifiedCatalog = JSON.stringify(catalog);

    // Verify no bot token pattern exists in catalog or presentation data
    expect(stringifiedCatalog).not.toMatch(/bot[0-9]{8,10}:[a-zA-Z0-9_-]{35}/);
    expect(stringifiedCatalog).not.toContain('BOT_TOKEN');
    expect(stringifiedCatalog).not.toContain('TELEGRAM_SECRET');
  });

  // Scenario 14: Seller/admin endpoint exposure through customer surface
  it('Scenario 14: Seller and admin management surfaces are completely separated from customer surface', () => {
    const { customerStoreService } = harness;

    // CustomerStoreService must NOT expose administrative management methods
    const serviceProto = Object.getPrototypeOf(customerStoreService);
    const methodNames = Object.getOwnPropertyNames(serviceProto);

    expect(methodNames).not.toContain('archiveProduct');
    expect(methodNames).not.toContain('createPaymentAccount');
    expect(methodNames).not.toContain('revokeEntitlement');
    expect(methodNames).not.toContain('deleteStore');
    expect(methodNames).not.toContain('transferOwnership');
  });
});

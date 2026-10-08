import { describe, it, expect, beforeEach } from 'vitest';
import { createCustomerStoreTestHarness, CustomerStoreTestHarness } from './test-helpers.js';
import { PaymentNotAllowedError } from '../src/index.js';

describe('Customer Store — Payment & Fulfillment Flow (M08 / M09 Integration)', () => {
  let harness: CustomerStoreTestHarness;

  beforeEach(async () => {
    harness = await createCustomerStoreTestHarness();
  });

  it('coordinates the complete commerce journey: Order -> Payment Intent -> Simulation -> Fulfillment -> Customer Order Details', async () => {
    const {
      customerStoreService,
      resolvedStore,
      customerSessionA,
      sellerContext,
      fulfillmentService,
      inventoryService,
      contextResolver,
    } = harness;
    const storeCtx = contextResolver.toStoreContext(resolvedStore);

    // 1. Order Creation via Checkout
    const catalog = await customerStoreService.getCatalog(resolvedStore);
    const spotify = catalog.products.find((p) => p.name === 'Spotify Premium')!;

    const checkoutResult = await customerStoreService.checkout(resolvedStore, customerSessionA, {
      items: [{ productId: spotify.id, quantity: 1 }],
      customerName: 'Alice Customer',
    });
    const orderId = checkoutResult.orderId;

    // 2. Customer Initiates Payment (PaymentIntent via M08)
    const paymentResult = await customerStoreService.initiatePayment(
      resolvedStore,
      customerSessionA,
      {
        orderId,
      },
    );

    expect(paymentResult.paymentIntentId).toBeDefined();
    expect(paymentResult.orderId).toBe(orderId);
    expect(paymentResult.amount).toBe('19000.00');
    expect(paymentResult.currency).toBe('IDR');
    expect(paymentResult.status).toBe('PENDING');
    expect(paymentResult.qrPayload).toContain('ID.CO.QRIS');

    // 3. Simulate Payment Settlement (Approved M08 Webhook Path)
    const settlementResult = await customerStoreService.simulatePaymentSuccess(
      resolvedStore,
      paymentResult.paymentIntentId,
    );
    expect(settlementResult.success).toBe(true);
    expect(settlementResult.paymentIntentStatus).toBe('SUCCEEDED');

    // Verify order transitioned to PAID
    const orderAfterPayment = await customerStoreService.getCustomerOrder(
      resolvedStore,
      customerSessionA,
      orderId,
    );
    expect(orderAfterPayment.status).toBe('PAID');

    // 4. Seller / System Executes Fulfillment (M09)
    const fulfillment = await fulfillmentService.createFulfillment(
      { type: 'SELLER', context: sellerContext },
      { orderId, strategy: 'DIGITAL_AUTO' },
    );

    const executedFulfillment = await fulfillmentService.executeFulfillment(
      { type: 'SELLER', context: sellerContext },
      { fulfillmentId: fulfillment.id },
    );
    expect(executedFulfillment.status).toBe('FULFILLED');

    // 5. Customer Views Fulfillment Status (Sanitized Public Projection)
    const customerFulfillment = await customerStoreService.getOrderFulfillment(
      resolvedStore,
      customerSessionA,
      orderId,
    );

    expect(customerFulfillment).not.toBeNull();
    expect(customerFulfillment?.id).toBe(fulfillment.id);
    expect(customerFulfillment?.status).toBe('FULFILLED');
    expect(customerFulfillment?.items).toHaveLength(1);
    expect(customerFulfillment?.items[0]!.status).toBe('DELIVERED');
    expect(customerFulfillment?.items[0]!.payloadReference).toBeDefined();

    // Verify internal inventoryItemId is NOT exposed to customer projection
    expect(
      (customerFulfillment?.items[0] as Record<string, unknown>).inventoryItemId,
    ).toBeUndefined();

    // 6. Verify M06/M07 Inventory Consumption Occurred
    const finalInv = await inventoryService.getInventory(storeCtx, spotify.id);
    expect(finalInv.quantityOnHand).toBe(23); // Decreased by 1
    expect(finalInv.quantityReserved).toBe(0); // Reset to 0
  });

  it('rejects initiating payment if order is already cancelled', async () => {
    const { customerStoreService, resolvedStore, customerSessionA, orderService, sellerContext } =
      harness;

    const catalog = await customerStoreService.getCatalog(resolvedStore);
    const spotify = catalog.products.find((p) => p.name === 'Spotify Premium')!;

    const checkout = await customerStoreService.checkout(resolvedStore, customerSessionA, {
      items: [{ productId: spotify.id, quantity: 1 }],
      customerName: 'Alice',
    });

    // Cancel order via seller context
    await orderService.cancelOrder({ type: 'SELLER', context: sellerContext }, checkout.orderId);

    // Attempting to pay cancelled order must be rejected
    await expect(
      customerStoreService.initiatePayment(resolvedStore, customerSessionA, {
        orderId: checkout.orderId,
      }),
    ).rejects.toThrow(PaymentNotAllowedError);
  });
});

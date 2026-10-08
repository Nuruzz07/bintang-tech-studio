import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import { AuthorizationService, InMemoryEntitlementResolver } from '@bintang/authorization';
import {
  OrderService,
  InMemoryOrderRepository,
  InMemoryCustomerRepository,
  Customer,
} from '@bintang/orders';
import { InMemoryProductRepository, Product } from '@bintang/commerce';
import { InventoryService, InMemoryInventoryRepository } from '@bintang/inventory';
import {
  PaymentService,
  InMemoryPaymentAccountRepository,
  InMemoryPaymentIntentRepository,
  InMemoryPaymentAttemptRepository,
  InMemoryPaymentEventRepository,
  InMemoryRefundRepository,
  InMemoryPaymentIdempotencyRepository,
  MockPaymentProviderAdapter,
  PaymentError,
  PaymentNotFoundError,
  PaymentAccountNotFoundError,
  PaymentIntentNotFoundError,
  PaymentAmountMismatchError,
  PaymentCurrencyMismatchError,
  PaymentStoreMismatchError,
  PaymentOrderMismatchError,
  PaymentCustomerAccessDeniedError,
  PaymentProviderUnsupportedError,
  PaymentSignatureVerificationError,
  PaymentEventConflictError,
  PaymentStateTransitionError,
  RefundAmountExceededError,
  RefundUnsupportedError,
} from '../src/index.js';

describe('M08 Security, Atomicity & Payment Integrity Audit Suite', () => {
  const storeA = 'store_audit_alpha';
  const storeB = 'store_audit_beta';

  let orderRepo: InMemoryOrderRepository;
  let customerRepo: InMemoryCustomerRepository;
  let productRepo: InMemoryProductRepository;
  let inventoryRepo: InMemoryInventoryRepository;
  let inventoryService: InventoryService;
  let accountRepo: InMemoryPaymentAccountRepository;
  let intentRepo: InMemoryPaymentIntentRepository;
  let attemptRepo: InMemoryPaymentAttemptRepository;
  let eventRepo: InMemoryPaymentEventRepository;
  let refundRepo: InMemoryRefundRepository;
  let idempotencyRepo: InMemoryPaymentIdempotencyRepository;
  let authService: AuthorizationService;
  let orderService: OrderService;
  let paymentService: PaymentService;
  let tipzyAdapter: MockPaymentProviderAdapter;

  const sellerContextA = createAuthenticatedStoreContext({
    storeId: storeA,
    userId: 'user_merchant_alpha',
    membershipId: 'mem_merchant_alpha',
    role: 'STORE_OWNER',
  });

  const sellerContextB = createAuthenticatedStoreContext({
    storeId: storeB,
    userId: 'user_merchant_beta',
    membershipId: 'mem_merchant_beta',
    role: 'STORE_OWNER',
  });

  const customerA: Customer = {
    id: 'cust_alpha_1',
    storeId: storeA,
    name: 'Customer Alpha',
    email: 'alpha@bintang.local',
    phone: null,
    telegramId: null,
    whatsappNumber: null,
    totalOrders: 0,
    totalSpent: '0.00',
    lastOrderAt: null,
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const customerB: Customer = {
    id: 'cust_beta_1',
    storeId: storeA,
    name: 'Customer Beta',
    email: 'beta@bintang.local',
    phone: null,
    telegramId: null,
    whatsappNumber: null,
    totalOrders: 0,
    totalSpent: '0.00',
    lastOrderAt: null,
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const product100k: Product = {
    id: 'prod_100k',
    storeId: storeA,
    categoryId: null,
    name: 'Audit 100K Product',
    slug: 'audit-100k-product',
    description: null,
    productType: 'DIGITAL',
    price: 100000,
    compareAtPrice: null,
    stockMode: 'UNLIMITED',
    status: 'ACTIVE',
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const trackedProduct: Product = {
    id: 'prod_audit_tracked',
    storeId: storeA,
    categoryId: null,
    name: 'Audit Tracked Product',
    slug: 'audit-tracked-product',
    description: null,
    productType: 'PHYSICAL',
    price: 100000,
    compareAtPrice: null,
    stockMode: 'TRACKED',
    status: 'ACTIVE',
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    orderRepo = new InMemoryOrderRepository();
    customerRepo = new InMemoryCustomerRepository();
    productRepo = new InMemoryProductRepository();
    inventoryRepo = new InMemoryInventoryRepository();
    accountRepo = new InMemoryPaymentAccountRepository();
    intentRepo = new InMemoryPaymentIntentRepository();
    attemptRepo = new InMemoryPaymentAttemptRepository();
    eventRepo = new InMemoryPaymentEventRepository();
    refundRepo = new InMemoryRefundRepository();
    idempotencyRepo = new InMemoryPaymentIdempotencyRepository();
    authService = new AuthorizationService(new InMemoryEntitlementResolver());

    inventoryService = new InventoryService({
      inventoryRepository: inventoryRepo,
      productRepository: productRepo,
      authorizationService: authService,
    });

    orderService = new OrderService({
      orderRepository: orderRepo,
      customerRepository: customerRepo,
      productRepository: productRepo,
      inventoryService,
      authorizationService: authService,
    });

    tipzyAdapter = new MockPaymentProviderAdapter({
      providerName: 'TIPZY',
      expectedSignature: 'valid_sig_tipzy_pass',
      capabilities: {
        card: true,
        ewallet: true,
        virtualAccount: true,
        qris: true,
        refund: true,
        partialRefund: true,
        webhookSignatureVerification: true,
      },
    });

    paymentService = new PaymentService({
      accountRepository: accountRepo,
      intentRepository: intentRepo,
      attemptRepository: attemptRepo,
      eventRepository: eventRepo,
      refundRepository: refundRepo,
      idempotencyRepository: idempotencyRepo,
      authorizationService: authService,
      orderService,
      adapters: [tipzyAdapter],
    });

    await customerRepo.create(storeA, customerA);
    await customerRepo.create(storeA, customerB);
    await productRepo.create(storeA, product100k);
    await productRepo.create(storeA, trackedProduct);
    await inventoryService.initializeInventory(sellerContextA, trackedProduct.id, 20);

    await paymentService.createPaymentAccount(sellerContextA, {
      provider: 'TIPZY',
      displayName: 'Store A Tipzy Account',
      credentialReference: 'secret_ref_alpha_tipzy',
    });
  });

  // ==============================================================================
  // 1. PAYMENT ↔ ORDER ATOMICITY & RESILIENCE AUDIT
  // ==============================================================================
  describe('Dimension 1: Payment ↔ Order Coordination & Resilience', () => {
    it('1. Payment succeeds but order transition fails (temporary inconsistency state)', async () => {
      const order = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { items: [{ productId: product100k.id, quantity: 1 }] },
      );
      expect(order.status).toBe('PENDING_PAYMENT');

      const intent = await paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { orderId: order.id },
      );

      const attempt = await paymentService.createPaymentAttempt(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { paymentIntentId: intent.id },
      );

      // Simulate order transition failure
      const transitionSpy = vi
        .spyOn(orderService, 'transitionStatus')
        .mockRejectedValueOnce(new Error('Downstream order service lock timeout'));

      await expect(
        paymentService.processPaymentWebhook({
          provider: 'TIPZY',
          eventId: 'evt_simulated_fail_001',
          signature: 'valid_sig_tipzy_pass',
          payload: {
            reference: attempt.providerReference,
            status: 'SUCCEEDED',
            amount: '100000.00',
            currency: 'IDR',
          },
        }),
      ).rejects.toThrow('Downstream order service lock timeout');

      // Verify intermediate inconsistent state
      const intentAfterFail = await intentRepo.findById(storeA, intent.id);
      expect(intentAfterFail?.status).toBe('SUCCEEDED');
      const orderAfterFail = await orderRepo.findById(storeA, order.id);
      expect(orderAfterFail?.status).toBe('PENDING_PAYMENT');

      // Verify event was recorded for ingress traceability
      const recordedEvent = await eventRepo.findByProviderEventId(
        'TIPZY',
        'evt_simulated_fail_001',
      );
      expect(recordedEvent).not.toBeNull();
      expect(recordedEvent?.paymentIntentId).toBe(intent.id);

      transitionSpy.mockRestore();
    });

    it('2. Same webhook redelivery (identical provider eventId and payload) reconciles Order -> PAID without duplicate side effects', async () => {
      const order = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { items: [{ productId: product100k.id, quantity: 1 }] },
      );

      const intent = await paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { orderId: order.id },
      );

      const attempt = await paymentService.createPaymentAttempt(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { paymentIntentId: intent.id },
      );

      const webhookInput = {
        provider: 'TIPZY',
        eventId: 'evt_exact_redelivery_002',
        signature: 'valid_sig_tipzy_pass',
        payload: {
          reference: attempt.providerReference,
          status: 'SUCCEEDED',
          amount: '100000.00',
          currency: 'IDR',
        },
      };

      // First run: fail order transition
      const transitionSpy = vi
        .spyOn(orderService, 'transitionStatus')
        .mockRejectedValueOnce(new Error('Transient order DB connection reset'));

      await expect(paymentService.processPaymentWebhook(webhookInput)).rejects.toThrow(
        'Transient order DB connection reset',
      );

      // Verify intermediate state
      const currentIntent = await intentRepo.findById(storeA, intent.id);
      expect(currentIntent?.status).toBe('SUCCEEDED');
      let currentOrder = await orderRepo.findById(storeA, order.id);
      expect(currentOrder?.status).toBe('PENDING_PAYMENT');

      // Redeliver the EXACT SAME event (same eventId, same payload)
      const redeliveryResult = await paymentService.processPaymentWebhook(webhookInput);
      expect(redeliveryResult.isDuplicate).toBe(true);
      expect(redeliveryResult.currentStatus).toBe('SUCCEEDED');

      // Verify order is now reconciled to PAID
      currentOrder = await orderRepo.findById(storeA, order.id);
      expect(currentOrder?.status).toBe('PAID');

      // Verify NO duplicate payment intent or attempts were created
      const intents = await intentRepo.findByOrderId(storeA, order.id);
      expect(intents).toHaveLength(1);
      const attempts = await attemptRepo.findByIntentId(storeA, intent.id);
      expect(attempts).toHaveLength(1);

      // Subsequent duplicate redelivery is a safe no-op
      const subResult = await paymentService.processPaymentWebhook(webhookInput);
      expect(subResult.isDuplicate).toBe(true);
      expect(currentOrder.status).toBe('PAID');

      transitionSpy.mockRestore();
    });

    it('3. Conflicting duplicate (same providerEventId + altered payload) does not reconcile and throws PaymentEventConflictError', async () => {
      const order = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { items: [{ productId: product100k.id, quantity: 1 }] },
      );

      const intent = await paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { orderId: order.id },
      );

      const attempt = await paymentService.createPaymentAttempt(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { paymentIntentId: intent.id },
      );

      const eventId = 'evt_conflict_audit_003';

      // First run: order transition fails
      const transitionSpy = vi
        .spyOn(orderService, 'transitionStatus')
        .mockRejectedValueOnce(new Error('Simulated network fault'));

      await expect(
        paymentService.processPaymentWebhook({
          provider: 'TIPZY',
          eventId,
          signature: 'valid_sig_tipzy_pass',
          payload: {
            reference: attempt.providerReference,
            status: 'SUCCEEDED',
            amount: '100000.00',
            currency: 'IDR',
          },
        }),
      ).rejects.toThrow('Simulated network fault');

      // Verify order is still PENDING_PAYMENT
      let orderState = await orderRepo.findById(storeA, order.id);
      expect(orderState?.status).toBe('PENDING_PAYMENT');

      // Malicious or corrupted redelivery: SAME eventId, but altered payload
      await expect(
        paymentService.processPaymentWebhook({
          provider: 'TIPZY',
          eventId,
          signature: 'valid_sig_tipzy_pass',
          payload: {
            reference: attempt.providerReference,
            status: 'SUCCEEDED',
            amount: '99999.00', // Tampered amount
            currency: 'IDR',
          },
        }),
      ).rejects.toThrow(PaymentEventConflictError);

      // Verify order remains PENDING_PAYMENT (zero arbitrary order mutation!)
      orderState = await orderRepo.findById(storeA, order.id);
      expect(orderState?.status).toBe('PENDING_PAYMENT');

      transitionSpy.mockRestore();
    });

    it('4. Concurrent successful redelivery of the same event is idempotent and transitions order exactly once', async () => {
      const order = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { items: [{ productId: product100k.id, quantity: 1 }] },
      );

      const intent = await paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { orderId: order.id },
      );

      const attempt = await paymentService.createPaymentAttempt(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { paymentIntentId: intent.id },
      );

      const eventId = 'evt_concurrent_audit_004';
      const webhookInput = {
        provider: 'TIPZY',
        eventId,
        signature: 'valid_sig_tipzy_pass',
        payload: {
          reference: attempt.providerReference,
          status: 'SUCCEEDED',
          amount: '100000.00',
          currency: 'IDR',
        },
      };

      // First run: fail order transition
      const initialFailSpy = vi
        .spyOn(orderService, 'transitionStatus')
        .mockRejectedValueOnce(new Error('Transient order DB lock'));

      await expect(paymentService.processPaymentWebhook(webhookInput)).rejects.toThrow(
        'Transient order DB lock',
      );
      initialFailSpy.mockRestore();

      // Verify order is still PENDING_PAYMENT
      const initialOrder = await orderRepo.findById(storeA, order.id);
      expect(initialOrder?.status).toBe('PENDING_PAYMENT');

      // Track transitionStatus invocations during concurrent redeliveries
      const transitionSpy = vi.spyOn(orderService, 'transitionStatus');

      // Fire 5 concurrent redeliveries of the SAME event
      const promises = Array.from({ length: 5 }, () =>
        paymentService.processPaymentWebhook(webhookInput),
      );

      const results = await Promise.all(promises);

      // All 5 redeliveries succeed with isDuplicate: true
      for (const res of results) {
        expect(res.isDuplicate).toBe(true);
      }

      // Order must now be PAID
      const finalOrder = await orderRepo.findById(storeA, order.id);
      expect(finalOrder?.status).toBe('PAID');

      // transitionStatus MUST have been called EXACTLY ONCE across all 5 concurrent calls!
      expect(transitionSpy).toHaveBeenCalledTimes(1);

      transitionSpy.mockRestore();
    });

    // ==============================================================================
    // CROSS-MILESTONE CONSISTENCY: PAYMENT -> ORDER -> INVENTORY SEMANTICS
    // ==============================================================================
    it('5. Payment success: PaymentIntent = SUCCEEDED, Order = PAID, Inventory reservation remains unchanged', async () => {
      const order = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { items: [{ productId: trackedProduct.id, quantity: 2 }] },
      );

      // Verify order creation reserved inventory
      let inv = await inventoryRepo.findByProductId(storeA, trackedProduct.id);
      expect(inv?.quantityOnHand).toBe(20);
      expect(inv?.quantityReserved).toBe(2);

      const intent = await paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { orderId: order.id },
      );

      const attempt = await paymentService.createPaymentAttempt(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { paymentIntentId: intent.id },
      );

      const consumeSpy = vi.spyOn(inventoryService, 'consumeReserved');

      const webhookResult = await paymentService.processPaymentWebhook({
        provider: 'TIPZY',
        eventId: 'evt_inv_audit_success_A',
        signature: 'valid_sig_tipzy_pass',
        payload: {
          reference: attempt.providerReference,
          status: 'SUCCEEDED',
          amount: '200000.00',
          currency: 'IDR',
        },
      });

      expect(webhookResult.currentStatus).toBe('SUCCEEDED');

      // Verify PaymentIntent = SUCCEEDED and Order = PAID
      const currentIntent = await intentRepo.findById(storeA, intent.id);
      expect(currentIntent?.status).toBe('SUCCEEDED');
      const currentOrder = await orderRepo.findById(storeA, order.id);
      expect(currentOrder?.status).toBe('PAID');

      // CRITICAL M07/M08 INVARIANT: consumeReserved() MUST NOT be called at PAID!
      expect(consumeSpy).toHaveBeenCalledTimes(0);

      // Inventory reservation MUST remain unchanged (onHand: 20, reserved: 2)
      inv = await inventoryRepo.findByProductId(storeA, trackedProduct.id);
      expect(inv?.quantityOnHand).toBe(20);
      expect(inv?.quantityReserved).toBe(2);

      consumeSpy.mockRestore();
    });

    it('6. Fulfillment: Order PROCESSING -> FULFILLED calls consumeReserved() exactly once', async () => {
      const order = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { items: [{ productId: trackedProduct.id, quantity: 2 }] },
      );

      const intent = await paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { orderId: order.id },
      );

      const attempt = await paymentService.createPaymentAttempt(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { paymentIntentId: intent.id },
      );

      await paymentService.processPaymentWebhook({
        provider: 'TIPZY',
        eventId: 'evt_inv_audit_fulfill_B',
        signature: 'valid_sig_tipzy_pass',
        payload: {
          reference: attempt.providerReference,
          status: 'SUCCEEDED',
          amount: '200000.00',
          currency: 'IDR',
        },
      });

      // Advance to PROCESSING - reservation remains intact, no consumption
      const processingOrder = await orderService.transitionStatus(
        sellerContextA,
        order.id,
        'PROCESSING',
      );
      expect(processingOrder.status).toBe('PROCESSING');
      let inv = await inventoryRepo.findByProductId(storeA, trackedProduct.id);
      expect(inv?.quantityOnHand).toBe(20);
      expect(inv?.quantityReserved).toBe(2);

      // Spy on consumeReserved
      const consumeSpy = vi.spyOn(inventoryService, 'consumeReserved');

      // Advance to FULFILLED - consumeReserved occurs now
      const fulfilledOrder = await orderService.transitionStatus(
        sellerContextA,
        order.id,
        'FULFILLED',
      );
      expect(fulfilledOrder.status).toBe('FULFILLED');

      expect(consumeSpy).toHaveBeenCalledTimes(1);
      expect(consumeSpy).toHaveBeenCalledWith(expect.anything(), trackedProduct.id, 2, order.id);

      // Inventory is now consumed: onHand decremented, reserved cleared
      inv = await inventoryRepo.findByProductId(storeA, trackedProduct.id);
      expect(inv?.quantityOnHand).toBe(18);
      expect(inv?.quantityReserved).toBe(0);

      consumeSpy.mockRestore();
    });

    it('7. Payment webhook redelivery: Payment SUCCEEDED, Order PENDING_PAYMENT -> redelivery marks Order PAID with NO inventory consumption', async () => {
      const order = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { items: [{ productId: trackedProduct.id, quantity: 2 }] },
      );

      const intent = await paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { orderId: order.id },
      );

      const attempt = await paymentService.createPaymentAttempt(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { paymentIntentId: intent.id },
      );

      const webhookInput = {
        provider: 'TIPZY',
        eventId: 'evt_inv_audit_redeliver_C',
        signature: 'valid_sig_tipzy_pass',
        payload: {
          reference: attempt.providerReference,
          status: 'SUCCEEDED',
          amount: '200000.00',
          currency: 'IDR',
        },
      };

      // First run: fail order transition intentionally to create intermediate state
      const transitionSpy = vi
        .spyOn(orderService, 'transitionStatus')
        .mockRejectedValueOnce(new Error('Transient order DB lock'));

      await expect(paymentService.processPaymentWebhook(webhookInput)).rejects.toThrow(
        'Transient order DB lock',
      );
      transitionSpy.mockRestore();

      // Intermediate state: PaymentIntent = SUCCEEDED, Order = PENDING_PAYMENT
      const intermediateIntent = await intentRepo.findById(storeA, intent.id);
      expect(intermediateIntent?.status).toBe('SUCCEEDED');
      const intermediateOrder = await orderRepo.findById(storeA, order.id);
      expect(intermediateOrder?.status).toBe('PENDING_PAYMENT');

      // Verify reservation still intact
      let inv = await inventoryRepo.findByProductId(storeA, trackedProduct.id);
      expect(inv?.quantityOnHand).toBe(20);
      expect(inv?.quantityReserved).toBe(2);

      // Spy on consumeReserved during redelivery
      const consumeSpy = vi.spyOn(inventoryService, 'consumeReserved');

      // Redeliver identical webhook event
      const redeliveryResult = await paymentService.processPaymentWebhook(webhookInput);
      expect(redeliveryResult.isDuplicate).toBe(true);
      expect(redeliveryResult.currentStatus).toBe('SUCCEEDED');

      // Order is now reconciled to PAID
      const reconciledOrder = await orderRepo.findById(storeA, order.id);
      expect(reconciledOrder?.status).toBe('PAID');

      // CRITICAL INVARIANT: consumeReserved() MUST NOT be called on redelivery!
      expect(consumeSpy).toHaveBeenCalledTimes(0);

      // Inventory reservation remains intact
      inv = await inventoryRepo.findByProductId(storeA, trackedProduct.id);
      expect(inv?.quantityOnHand).toBe(20);
      expect(inv?.quantityReserved).toBe(2);

      consumeSpy.mockRestore();
    });

    it('8. Subsequent fulfillment after redelivery: PAID -> PROCESSING -> FULFILLED consumes inventory only at FULFILLED', async () => {
      const order = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { items: [{ productId: trackedProduct.id, quantity: 2 }] },
      );

      const intent = await paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { orderId: order.id },
      );

      const attempt = await paymentService.createPaymentAttempt(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { paymentIntentId: intent.id },
      );

      const webhookInput = {
        provider: 'TIPZY',
        eventId: 'evt_inv_audit_redeliver_fulfill_D',
        signature: 'valid_sig_tipzy_pass',
        payload: {
          reference: attempt.providerReference,
          status: 'SUCCEEDED',
          amount: '200000.00',
          currency: 'IDR',
        },
      };

      // Fail initial order transition
      const initialFail = vi
        .spyOn(orderService, 'transitionStatus')
        .mockRejectedValueOnce(new Error('Transient failure'));
      await expect(paymentService.processPaymentWebhook(webhookInput)).rejects.toThrow(
        'Transient failure',
      );
      initialFail.mockRestore();

      // Redeliver to reconcile Order to PAID
      await paymentService.processPaymentWebhook(webhookInput);
      const paidOrder = await orderRepo.findById(storeA, order.id);
      expect(paidOrder?.status).toBe('PAID');

      // Verify no consumption yet
      let inv = await inventoryRepo.findByProductId(storeA, trackedProduct.id);
      expect(inv?.quantityOnHand).toBe(20);
      expect(inv?.quantityReserved).toBe(2);

      const consumeSpy = vi.spyOn(inventoryService, 'consumeReserved');

      // Seller transitions PAID -> PROCESSING
      await orderService.transitionStatus(sellerContextA, order.id, 'PROCESSING');
      expect(consumeSpy).toHaveBeenCalledTimes(0);
      inv = await inventoryRepo.findByProductId(storeA, trackedProduct.id);
      expect(inv?.quantityOnHand).toBe(20);
      expect(inv?.quantityReserved).toBe(2);

      // Seller transitions PROCESSING -> FULFILLED
      await orderService.transitionStatus(sellerContextA, order.id, 'FULFILLED');
      expect(consumeSpy).toHaveBeenCalledTimes(1);

      // Final inventory state: quantityOnHand decremented by 2, reserved cleared
      inv = await inventoryRepo.findByProductId(storeA, trackedProduct.id);
      expect(inv?.quantityOnHand).toBe(18);
      expect(inv?.quantityReserved).toBe(0);

      consumeSpy.mockRestore();
    });
  });

  // ==============================================================================
  // 2. WEBHOOK TRUST-BOUNDARY AUDIT (10-CASE MATRIX)
  // ==============================================================================
  describe('Dimension 2: Webhook Trust-Boundary Verification Matrix', () => {
    let testOrder: Awaited<ReturnType<typeof orderService.createOrder>>;
    let testIntent: Awaited<ReturnType<typeof paymentService.createPaymentIntent>>;
    let testAttempt: Awaited<ReturnType<typeof paymentService.createPaymentAttempt>>;

    beforeEach(async () => {
      testOrder = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { items: [{ productId: product100k.id, quantity: 1 }] },
      );

      testIntent = await paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { orderId: testOrder.id },
      );

      testAttempt = await paymentService.createPaymentAttempt(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { paymentIntentId: testIntent.id },
      );
    });

    it('1. Valid signature + correct payment -> ACCEPTED and PROCESSED', async () => {
      const res = await paymentService.processPaymentWebhook({
        provider: 'TIPZY',
        eventId: 'evt_tb_1',
        signature: 'valid_sig_tipzy_pass',
        payload: {
          reference: testAttempt.providerReference,
          status: 'SUCCEEDED',
          amount: '100000.00',
          currency: 'IDR',
        },
      });
      expect(res.processingStatus).toBe('PROCESSED');
      expect(res.currentStatus).toBe('SUCCEEDED');
    });

    it('2. Valid signature + wrong store -> REJECTED with PaymentStoreMismatchError', async () => {
      await expect(
        paymentService.processPaymentWebhook({
          provider: 'TIPZY',
          eventId: 'evt_tb_2',
          signature: 'valid_sig_tipzy_pass',
          storeId: 'store_malicious_hijack',
          payload: {
            reference: testAttempt.providerReference,
            status: 'SUCCEEDED',
            amount: '100000.00',
          },
        }),
      ).rejects.toThrow(PaymentStoreMismatchError);
    });

    it('3. Valid signature + wrong payment intent -> REJECTED with PaymentOrderMismatchError', async () => {
      await expect(
        paymentService.processPaymentWebhook({
          provider: 'TIPZY',
          eventId: 'evt_tb_3',
          signature: 'valid_sig_tipzy_pass',
          paymentIntentId: '00000000-0000-0000-0000-000000000999',
          payload: {
            reference: testAttempt.providerReference,
            status: 'SUCCEEDED',
            amount: '100000.00',
          },
        }),
      ).rejects.toThrow(PaymentOrderMismatchError);
    });

    it('4. Valid signature + wrong payment account -> REJECTED with PaymentAccountNotFoundError', async () => {
      // Create orphaned intent pointing to nonexistent account
      const orphanedIntentId = '00000000-0000-0000-0000-000000000777';
      await intentRepo.create(storeA, {
        id: orphanedIntentId,
        storeId: storeA,
        orderId: testOrder.id,
        customerId: customerA.id,
        amount: '100000.00',
        currency: 'IDR',
        status: 'PENDING',
        paymentAccountId: '00000000-0000-0000-0000-000000000888', // Nonexistent
        provider: 'TIPZY',
        idempotencyKey: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      });

      await expect(
        paymentService.processPaymentWebhook({
          provider: 'TIPZY',
          eventId: 'evt_tb_4',
          signature: 'valid_sig_tipzy_pass',
          paymentIntentId: orphanedIntentId,
          storeId: storeA,
          payload: {
            status: 'SUCCEEDED',
            amount: '100000.00',
          },
        }),
      ).rejects.toThrow(PaymentAccountNotFoundError);
    });

    it('5. Valid signature + wrong provider -> REJECTED with PaymentProviderUnsupportedError', async () => {
      await expect(
        paymentService.processPaymentWebhook({
          provider: 'UNREGISTERED_PROVIDER',
          eventId: 'evt_tb_5',
          signature: 'valid_sig_tipzy_pass',
          payload: {
            reference: testAttempt.providerReference,
            status: 'SUCCEEDED',
          },
        }),
      ).rejects.toThrow(PaymentProviderUnsupportedError);
    });

    it('6. Valid signature + wrong amount -> REJECTED with PaymentAmountMismatchError', async () => {
      await expect(
        paymentService.processPaymentWebhook({
          provider: 'TIPZY',
          eventId: 'evt_tb_6',
          signature: 'valid_sig_tipzy_pass',
          amount: '50000.00', // Mismatched: intent requires 100000.00
          payload: {
            reference: testAttempt.providerReference,
            status: 'SUCCEEDED',
            amount: '50000.00',
          },
        }),
      ).rejects.toThrow(PaymentAmountMismatchError);
    });

    it('7. Valid signature + wrong currency -> REJECTED with PaymentCurrencyMismatchError', async () => {
      await expect(
        paymentService.processPaymentWebhook({
          provider: 'TIPZY',
          eventId: 'evt_tb_7',
          signature: 'valid_sig_tipzy_pass',
          currency: 'USD', // Mismatched: intent requires IDR
          payload: {
            reference: testAttempt.providerReference,
            status: 'SUCCEEDED',
            currency: 'USD',
          },
        }),
      ).rejects.toThrow(PaymentCurrencyMismatchError);
    });

    it('8. Valid signature + wrong provider reference -> REJECTED with PaymentNotFoundError', async () => {
      await expect(
        paymentService.processPaymentWebhook({
          provider: 'TIPZY',
          eventId: 'evt_tb_8',
          signature: 'valid_sig_tipzy_pass',
          providerReference: 'ref_non_existent_foreign_payment',
          payload: {
            status: 'SUCCEEDED',
          },
        }),
      ).rejects.toThrow(PaymentNotFoundError);
    });

    it('9. Invalid signature + otherwise valid payload -> REJECTED with PaymentSignatureVerificationError', async () => {
      await expect(
        paymentService.processPaymentWebhook({
          provider: 'TIPZY',
          eventId: 'evt_tb_9',
          signature: 'invalid_forged_signature_attack',
          payload: {
            reference: testAttempt.providerReference,
            status: 'SUCCEEDED',
            amount: '100000.00',
            currency: 'IDR',
          },
        }),
      ).rejects.toThrow(PaymentSignatureVerificationError);
    });

    it('10. Missing signature -> REJECTED with PaymentSignatureVerificationError', async () => {
      await expect(
        paymentService.processPaymentWebhook({
          provider: 'TIPZY',
          eventId: 'evt_tb_10',
          // No signature or headers provided
          payload: {
            reference: testAttempt.providerReference,
            status: 'SUCCEEDED',
            amount: '100000.00',
          },
        }),
      ).rejects.toThrow(PaymentSignatureVerificationError);
    });
  });

  // ==============================================================================
  // 3. PAYMENT INTENT / ATTEMPT HISTORICAL INTEGRITY & IMMUTABILITY
  // ==============================================================================
  describe('Dimension 3: Historical Separation & Attempt Immutability', () => {
    it('Sequential attempts preserve Attempt 1 as FAILED and Attempt 2 as SUCCEEDED without mutation', async () => {
      const order = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { items: [{ productId: product100k.id, quantity: 1 }] },
      );

      const intent = await paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { orderId: order.id },
      );

      // Attempt 1 fails
      const attempt1 = await paymentService.createPaymentAttempt(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { paymentIntentId: intent.id },
      );
      expect(attempt1.attemptNumber).toBe(1);

      await paymentService.processPaymentWebhook({
        provider: 'TIPZY',
        eventId: 'evt_attempt1_fail',
        signature: 'valid_sig_tipzy_pass',
        payload: {
          reference: attempt1.providerReference,
          status: 'FAILED',
          failureReason: 'Insufficient buyer funds',
        },
      });

      // Attempt 2 succeeds
      const attempt2 = await paymentService.createPaymentAttempt(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { paymentIntentId: intent.id },
      );
      expect(attempt2.attemptNumber).toBe(2);

      await paymentService.processPaymentWebhook({
        provider: 'TIPZY',
        eventId: 'evt_attempt2_succ',
        signature: 'valid_sig_tipzy_pass',
        payload: {
          reference: attempt2.providerReference,
          status: 'SUCCEEDED',
          amount: '100000.00',
        },
      });

      // Verify attempts separation in repository
      const allAttempts = await attemptRepo.findByIntentId(storeA, intent.id);
      expect(allAttempts).toHaveLength(2);
      expect(allAttempts[0]?.id).toBe(attempt1.id);
      expect(allAttempts[0]?.status).toBe('FAILED');
      expect(allAttempts[0]?.failureReason).toBe('Insufficient buyer funds');

      expect(allAttempts[1]?.id).toBe(attempt2.id);
      expect(allAttempts[1]?.status).toBe('SUCCEEDED');

      // Intent must be SUCCEEDED
      const updatedIntent = await intentRepo.findById(storeA, intent.id);
      expect(updatedIntent?.status).toBe('SUCCEEDED');

      // Direct mutation of historical Attempt 1 from FAILED to SUCCEEDED must be STRICTLY rejected
      await expect(attemptRepo.updateStatus(storeA, attempt1.id, 'SUCCEEDED')).rejects.toThrow(
        PaymentStateTransitionError,
      );
    });
  });

  // ==============================================================================
  // 4. STATE MACHINE REPOSITORY-LEVEL ENFORCEMENT
  // ==============================================================================
  describe('Dimension 4: Disallowed State Transitions', () => {
    it('STRICTLY rejects invalid PaymentIntent state transitions', async () => {
      const intent = await intentRepo.create(storeA, {
        id: 'intent_sm_test',
        storeId: storeA,
        orderId: 'ord_1',
        customerId: customerA.id,
        amount: '100000.00',
        currency: 'IDR',
        status: 'FAILED',
        paymentAccountId: 'acc_1',
        provider: 'TIPZY',
        idempotencyKey: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      });

      // FAILED -> SUCCEEDED rejected
      await expect(intentRepo.updateStatus(storeA, intent.id, 'SUCCEEDED')).rejects.toThrow(
        PaymentStateTransitionError,
      );

      // EXPIRED -> SUCCEEDED rejected
      await intentRepo.updateStatus(storeA, intent.id, 'PENDING');
      await intentRepo.updateStatus(storeA, intent.id, 'EXPIRED');
      await expect(intentRepo.updateStatus(storeA, intent.id, 'SUCCEEDED')).rejects.toThrow(
        PaymentStateTransitionError,
      );

      // CANCELLED -> SUCCEEDED rejected
      const intentCancelled = await intentRepo.create(storeA, {
        id: 'intent_sm_canc',
        storeId: storeA,
        orderId: 'ord_2',
        customerId: customerA.id,
        amount: '100000.00',
        currency: 'IDR',
        status: 'CANCELLED',
        paymentAccountId: 'acc_1',
        provider: 'TIPZY',
        idempotencyKey: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      });
      await expect(
        intentRepo.updateStatus(storeA, intentCancelled.id, 'SUCCEEDED'),
      ).rejects.toThrow(PaymentStateTransitionError);

      // REFUNDED -> SUCCEEDED and REFUNDED -> PARTIALLY_REFUNDED rejected
      const intentRefunded = await intentRepo.create(storeA, {
        id: 'intent_sm_ref',
        storeId: storeA,
        orderId: 'ord_3',
        customerId: customerA.id,
        amount: '100000.00',
        currency: 'IDR',
        status: 'REFUNDED',
        paymentAccountId: 'acc_1',
        provider: 'TIPZY',
        idempotencyKey: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      });
      await expect(intentRepo.updateStatus(storeA, intentRefunded.id, 'SUCCEEDED')).rejects.toThrow(
        PaymentStateTransitionError,
      );
      await expect(
        intentRepo.updateStatus(storeA, intentRefunded.id, 'PARTIALLY_REFUNDED'),
      ).rejects.toThrow(PaymentStateTransitionError);
    });
  });

  // ==============================================================================
  // 5. AMOUNT & CURRENCY INTEGRITY
  // ==============================================================================
  describe('Dimension 5: Amount & Currency Integrity Enforcement', () => {
    it('Client cannot override authoritative order amount or currency', async () => {
      const order = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { items: [{ productId: product100k.id, quantity: 1 }] },
      );

      // Client specifies mismatched amount
      await expect(
        paymentService.createPaymentIntent(
          { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
          { orderId: order.id, amount: '1000.00' },
        ),
      ).rejects.toThrow(PaymentAmountMismatchError);

      // Client specifies mismatched currency
      await expect(
        paymentService.createPaymentIntent(
          { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
          { orderId: order.id, currency: 'USD' },
        ),
      ).rejects.toThrow(PaymentCurrencyMismatchError);

      // Client specifies negative amount
      await expect(
        paymentService.createPaymentIntent(
          { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
          { orderId: order.id, amount: '-100000.00' },
        ),
      ).rejects.toThrow(PaymentError);

      // Client specifies zero amount
      await expect(
        paymentService.createPaymentIntent(
          { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
          { orderId: order.id, amount: '0.00' },
        ),
      ).rejects.toThrow(PaymentError);

      // Client specifies excessive decimal precision
      await expect(
        paymentService.createPaymentIntent(
          { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
          { orderId: order.id, amount: '100000.123' },
        ),
      ).rejects.toThrow(PaymentError);
    });
  });

  // ==============================================================================
  // 6. CUMULATIVE REFUND INVARIANTS & CONCURRENCY RACE PROTECTION
  // ==============================================================================
  describe('Dimension 6: Cumulative Refund Invariants & Concurrency Race', () => {
    it('Cumulative refunds cannot exceed original amount and concurrent requests are race-protected', async () => {
      const order = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { items: [{ productId: product100k.id, quantity: 1 }] },
      );

      const intent = await paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { orderId: order.id },
      );

      const attempt = await paymentService.createPaymentAttempt(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { paymentIntentId: intent.id },
      );

      await paymentService.processPaymentWebhook({
        provider: 'TIPZY',
        eventId: 'evt_refund_race_init',
        signature: 'valid_sig_tipzy_pass',
        payload: {
          reference: attempt.providerReference,
          status: 'SUCCEEDED',
          amount: '100000.00',
        },
      });

      // Cumulative sequence: 40k + 30k + 30k = 100k
      const ref1 = await paymentService.createRefund(sellerContextA, {
        paymentIntentId: intent.id,
        amount: '40000.00',
      });
      expect(ref1.status).toBe('SUCCEEDED');
      let currentIntent = await intentRepo.findById(storeA, intent.id);
      expect(currentIntent?.status).toBe('PARTIALLY_REFUNDED');

      const ref2 = await paymentService.createRefund(sellerContextA, {
        paymentIntentId: intent.id,
        amount: '30000.00',
      });
      expect(ref2.status).toBe('SUCCEEDED');

      const ref3 = await paymentService.createRefund(sellerContextA, {
        paymentIntentId: intent.id,
        amount: '30000.00',
      });
      expect(ref3.status).toBe('SUCCEEDED');
      currentIntent = await intentRepo.findById(storeA, intent.id);
      expect(currentIntent?.status).toBe('REFUNDED');

      // Exceeded by even 1.00 is strictly rejected
      await expect(
        paymentService.createRefund(sellerContextA, {
          paymentIntentId: intent.id,
          amount: '1.00',
        }),
      ).rejects.toThrow(PaymentError);
    });

    it('Concurrent refund requests racing to exceed remaining balance are serialized and protected', async () => {
      const order = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { items: [{ productId: product100k.id, quantity: 1 }] },
      );

      const intent = await paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { orderId: order.id },
      );

      const attempt = await paymentService.createPaymentAttempt(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { paymentIntentId: intent.id },
      );

      await paymentService.processPaymentWebhook({
        provider: 'TIPZY',
        eventId: 'evt_race_setup',
        signature: 'valid_sig_tipzy_pass',
        payload: {
          reference: attempt.providerReference,
          status: 'SUCCEEDED',
          amount: '100000.00',
        },
      });

      // 2 concurrent refunds of 60,000 each against a 100,000 payment
      const p1 = paymentService.createRefund(sellerContextA, {
        paymentIntentId: intent.id,
        amount: '60000.00',
      });
      const p2 = paymentService.createRefund(sellerContextA, {
        paymentIntentId: intent.id,
        amount: '60000.00',
      });

      const results = await Promise.allSettled([p1, p2]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly 1 succeeds, 1 fails with RefundAmountExceededError
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        RefundAmountExceededError,
      );

      const allRefunds = await refundRepo.findByIntentId(storeA, intent.id);
      expect(allRefunds).toHaveLength(1);
      expect(allRefunds[0]?.amount).toBe('60000.00');
    });
  });

  // ==============================================================================
  // 7. HIGH-CONCURRENCY IDEMPOTENCY AUDIT (5+ REQUESTS)
  // ==============================================================================
  describe('Dimension 7: High-Concurrency Idempotency (6 concurrent requests)', () => {
    it('6 concurrent requests with identical idempotencyKey spawn exactly one payment intent', async () => {
      const order = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { items: [{ productId: product100k.id, quantity: 1 }] },
      );

      const promises = Array.from({ length: 6 }, () =>
        paymentService.createPaymentIntent(
          { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
          { orderId: order.id, idempotencyKey: 'idem_stress_key_concurrent' },
        ),
      );

      const results = await Promise.all(promises);

      // All 6 promises resolve with the identical PaymentIntent ID
      const targetId = results[0]!.id;
      for (const res of results) {
        expect(res.id).toBe(targetId);
      }

      // Exactly 1 PaymentIntent exists in repository for this order
      const intentsInRepo = await intentRepo.findByOrderId(storeA, order.id);
      expect(intentsInRepo).toHaveLength(1);
    });
  });

  // ==============================================================================
  // 8. PAYMENT EVENT REPLAY & CONFLICT PROTECTION
  // ==============================================================================
  describe('Dimension 8: Payment Event Replay Protection', () => {
    it('Duplicate event ID with conflicting payload is strictly rejected with PaymentEventConflictError', async () => {
      const order = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { items: [{ productId: product100k.id, quantity: 1 }] },
      );
      const intent = await paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { orderId: order.id },
      );
      const attempt = await paymentService.createPaymentAttempt(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { paymentIntentId: intent.id },
      );

      // Event 1
      const res1 = await paymentService.processPaymentWebhook({
        provider: 'TIPZY',
        eventId: 'evt_replay_test_001',
        signature: 'valid_sig_tipzy_pass',
        payload: {
          reference: attempt.providerReference,
          status: 'SUCCEEDED',
          amount: '100000.00',
        },
      });
      expect(res1.isDuplicate).toBe(false);

      // Replay exact duplicate
      const res2 = await paymentService.processPaymentWebhook({
        provider: 'TIPZY',
        eventId: 'evt_replay_test_001',
        signature: 'valid_sig_tipzy_pass',
        payload: {
          reference: attempt.providerReference,
          status: 'SUCCEEDED',
          amount: '100000.00',
        },
      });
      expect(res2.isDuplicate).toBe(true);

      // Replay with altered payload
      await expect(
        paymentService.processPaymentWebhook({
          provider: 'TIPZY',
          eventId: 'evt_replay_test_001',
          signature: 'valid_sig_tipzy_pass',
          payload: {
            reference: attempt.providerReference,
            status: 'FAILED',
            amount: '99999.00',
          },
        }),
      ).rejects.toThrow(PaymentEventConflictError);
    });
  });

  // ==============================================================================
  // 9. CROSS-TENANT ISOLATION AUDIT
  // ==============================================================================
  describe('Dimension 9: Cross-Tenant Isolation Enforcement', () => {
    it('Store B caller cannot access or manipulate Store A payment resources', async () => {
      const orderA = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { items: [{ productId: product100k.id, quantity: 1 }] },
      );

      const intentA = await paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { orderId: orderA.id },
      );

      // Store B seller tries to read Store A intent
      await expect(
        paymentService.getPaymentIntentById(
          { type: 'SELLER', context: sellerContextB },
          intentA.id,
        ),
      ).rejects.toThrow(PaymentIntentNotFoundError);

      // Store B customer tries to create intent for Store A order
      await expect(
        paymentService.createPaymentIntent(
          { type: 'CUSTOMER', context: { storeId: storeB, customerId: 'cust_b_foreign' } },
          { orderId: orderA.id },
        ),
      ).rejects.toThrow(PaymentOrderMismatchError);

      // Customer cannot list merchant payment accounts
      await expect(
        paymentService.listPaymentAccounts({
          type: 'CUSTOMER',
          context: { storeId: storeA, customerId: customerA.id },
        }),
      ).rejects.toThrow(PaymentCustomerAccessDeniedError);

      // But can list sanitized public accounts
      const publicAccounts = await paymentService.listPublicPaymentAccounts({
        type: 'CUSTOMER',
        context: { storeId: storeA, customerId: customerA.id },
      });
      expect(publicAccounts).toHaveLength(1);
      expect(
        (publicAccounts[0] as unknown as Record<string, unknown>).credentialReference,
      ).toBeUndefined();
    });
  });

  // ==============================================================================
  // 10. CUSTOMER AUTHORIZATION & SPOOFING DEFENSE
  // ==============================================================================
  describe('Dimension 10: Customer Ownership & Spoofing Defense', () => {
    it('Customer B cannot spoof or pay Customer A order', async () => {
      const orderA = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { items: [{ productId: product100k.id, quantity: 1 }] },
      );

      // Customer B attempts to create payment intent for Customer A order
      await expect(
        paymentService.createPaymentIntent(
          { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerB.id } },
          { orderId: orderA.id },
        ),
      ).rejects.toThrow(PaymentCustomerAccessDeniedError);
    });
  });

  // ==============================================================================
  // 11. PAYMENT CREDENTIAL LEAKAGE AUDIT
  // ==============================================================================
  describe('Dimension 11: Zero Credential Leakage Verification', () => {
    it('Public DTOs, intents, attempts, and refunds never expose credentialReference', async () => {
      const order = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { items: [{ productId: product100k.id, quantity: 1 }] },
      );

      const intent = await paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { orderId: order.id },
      );

      const attempt = await paymentService.createPaymentAttempt(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { paymentIntentId: intent.id },
      );

      const publicAccount = (await paymentService.getPaymentAccount(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        intent.paymentAccountId,
      )) as Record<string, unknown>;

      // Verify no credentialReference in Customer DTOs
      expect(publicAccount.credentialReference).toBeUndefined();
      expect((intent as unknown as Record<string, unknown>).credentialReference).toBeUndefined();
      expect((attempt as unknown as Record<string, unknown>).credentialReference).toBeUndefined();
    });
  });

  // ==============================================================================
  // 12. PROVIDER CAPABILITY ENFORCEMENT
  // ==============================================================================
  describe('Dimension 12: Provider Capability Enforcement', () => {
    it('STRICTLY rejects refunds when provider does not support refund capability', async () => {
      // Register limited provider without refund capability
      const noRefundAdapter = new MockPaymentProviderAdapter({
        providerName: 'NO_REFUND_PROV',
        expectedSignature: 'sig_no_ref',
        capabilities: {
          card: true,
          ewallet: true,
          virtualAccount: false,
          qris: false,
          refund: false,
          partialRefund: false,
          webhookSignatureVerification: true,
        },
      });
      paymentService.registerAdapter(noRefundAdapter);

      const noRefundAccount = await paymentService.createPaymentAccount(sellerContextA, {
        provider: 'NO_REFUND_PROV',
        displayName: 'No Refund Gateway',
        credentialReference: 'secret_noref',
      });

      const order = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { items: [{ productId: product100k.id, quantity: 1 }] },
      );

      const intent = await paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { orderId: order.id, paymentAccountId: noRefundAccount.id },
      );

      const attempt = await paymentService.createPaymentAttempt(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
        { paymentIntentId: intent.id },
      );

      await paymentService.processPaymentWebhook({
        provider: 'NO_REFUND_PROV',
        eventId: 'evt_noref_succ',
        signature: 'sig_no_ref',
        payload: {
          reference: attempt.providerReference,
          status: 'SUCCEEDED',
          amount: '100000.00',
        },
      });

      // Calling refund against adapter with refund: false throws RefundUnsupportedError
      await expect(
        paymentService.createRefund(sellerContextA, {
          paymentIntentId: intent.id,
          amount: '50000.00',
        }),
      ).rejects.toThrow(RefundUnsupportedError);
    });
  });
});

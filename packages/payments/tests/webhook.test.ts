import { describe, it, expect, beforeEach } from 'vitest';
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
  MockPaymentProviderAdapter,
  PaymentSignatureVerificationError,
  PaymentEventConflictError,
} from '../src/index.js';

describe('M08 Webhook Ingress & Order State Coordination Suite', () => {
  const storeId = 'store_webhook_test';

  let orderRepo: InMemoryOrderRepository;
  let customerRepo: InMemoryCustomerRepository;
  let productRepo: InMemoryProductRepository;
  let inventoryRepo: InMemoryInventoryRepository;
  let accountRepo: InMemoryPaymentAccountRepository;
  let intentRepo: InMemoryPaymentIntentRepository;
  let attemptRepo: InMemoryPaymentAttemptRepository;
  let eventRepo: InMemoryPaymentEventRepository;
  let refundRepo: InMemoryRefundRepository;
  let authService: AuthorizationService;
  let orderService: OrderService;
  let paymentService: PaymentService;
  let mockAdapter: MockPaymentProviderAdapter;

  const sellerContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_webhook_merchant',
    membershipId: 'mem_webhook_merchant',
    role: 'STORE_OWNER',
  });

  const customer: Customer = {
    id: 'cust_webhook_1',
    storeId,
    name: 'Webhook Customer',
    email: 'webhook@test.local',
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

  const product: Product = {
    id: 'prod_webhook_1',
    storeId,
    categoryId: null,
    name: 'Webhook Item',
    slug: 'webhook-item',
    description: null,
    productType: 'DIGITAL',
    price: 85000,
    compareAtPrice: null,
    stockMode: 'UNLIMITED',
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
    authService = new AuthorizationService(new InMemoryEntitlementResolver());

    const inventoryService = new InventoryService({
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

    mockAdapter = new MockPaymentProviderAdapter({
      providerName: 'TIPZY',
      expectedSignature: 'valid_secure_signature_123',
    });

    paymentService = new PaymentService({
      accountRepository: accountRepo,
      intentRepository: intentRepo,
      attemptRepository: attemptRepo,
      eventRepository: eventRepo,
      refundRepository: refundRepo,
      authorizationService: authService,
      orderService,
      adapters: [mockAdapter],
    });

    await customerRepo.create(storeId, customer);
    await productRepo.create(storeId, product);

    await paymentService.createPaymentAccount(sellerContext, {
      provider: 'TIPZY',
      displayName: 'Webhook Tipzy Account',
      credentialReference: 'vault:webhook:key',
    });
  });

  it('Valid webhook signature triggers SUCCEEDED payment and transitions M07 Order to PAID', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );
    expect(order.status).toBe('PENDING_PAYMENT');

    const intent = await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { orderId: order.id },
    );

    const attempt = await paymentService.createPaymentAttempt(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { paymentIntentId: intent.id },
    );

    const webhookResult = await paymentService.processPaymentWebhook({
      provider: 'TIPZY',
      eventId: 'evt_success_001',
      headers: {
        'x-webhook-signature': 'valid_secure_signature_123',
      },
      rawBody: JSON.stringify({
        event: 'payment.success',
        attemptId: attempt.id,
        reference: attempt.providerReference,
        status: 'SUCCEEDED',
      }),
      payload: {
        event: 'payment.success',
        attemptId: attempt.id,
        reference: attempt.providerReference,
        status: 'SUCCEEDED',
      },
    });

    expect(webhookResult.processingStatus).toBe('PROCESSED');
    expect(webhookResult.isDuplicate).toBe(false);

    // Verify intent status updated to SUCCEEDED
    const updatedIntent = await intentRepo.findById(storeId, intent.id);
    expect(updatedIntent?.status).toBe('SUCCEEDED');

    // Verify attempt status updated to SUCCEEDED
    const updatedAttempt = await attemptRepo.findById(storeId, attempt.id);
    expect(updatedAttempt?.status).toBe('SUCCEEDED');

    // Verify authoritative order updated to PAID
    const updatedOrder = await orderService.getOrderById(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      order.id,
    );
    expect(updatedOrder.status).toBe('PAID');
  });

  it('Webhook with invalid signature is strictly rejected with PaymentSignatureVerificationError', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );

    const intent = await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { orderId: order.id },
    );

    const attempt = await paymentService.createPaymentAttempt(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { paymentIntentId: intent.id },
    );

    await expect(
      paymentService.processPaymentWebhook({
        provider: 'TIPZY',
        eventId: 'evt_invalid_sig_002',
        headers: {
          'x-webhook-signature': 'tampered_fake_signature',
        },
        rawBody: '{"tampered":true}',
        payload: {
          event: 'payment.success',
          attemptId: attempt.id,
          reference: attempt.providerReference,
        },
      }),
    ).rejects.toThrow(PaymentSignatureVerificationError);
  });

  it('Webhook with missing signature is strictly rejected with PaymentSignatureVerificationError', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );

    const intent = await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { orderId: order.id },
    );

    const attempt = await paymentService.createPaymentAttempt(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { paymentIntentId: intent.id },
    );

    await expect(
      paymentService.processPaymentWebhook({
        provider: 'TIPZY',
        eventId: 'evt_no_sig_003',
        headers: {},
        payload: {
          event: 'payment.success',
          attemptId: attempt.id,
          reference: attempt.providerReference,
        },
      }),
    ).rejects.toThrow(PaymentSignatureVerificationError);
  });

  it('Webhook reporting FAILED attempt marks attempt FAILED while Order remains PENDING_PAYMENT', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );

    const intent = await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { orderId: order.id },
    );

    const attempt = await paymentService.createPaymentAttempt(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { paymentIntentId: intent.id },
    );

    const webhookResult = await paymentService.processPaymentWebhook({
      provider: 'TIPZY',
      eventId: 'evt_failed_004',
      headers: {
        'x-webhook-signature': 'valid_secure_signature_123',
      },
      rawBody: JSON.stringify({
        event: 'payment.failed',
        attemptId: attempt.id,
        reference: attempt.providerReference,
        status: 'FAILED',
      }),
      payload: {
        event: 'payment.failed',
        attemptId: attempt.id,
        reference: attempt.providerReference,
        status: 'FAILED',
      },
    });

    expect(webhookResult.processingStatus).toBe('PROCESSED');

    // Attempt is FAILED
    const updatedAttempt = await attemptRepo.findById(storeId, attempt.id);
    expect(updatedAttempt?.status).toBe('FAILED');

    // Order remains PENDING_PAYMENT so customer can retry
    const currentOrder = await orderService.getOrderById(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      order.id,
    );
    expect(currentOrder.status).toBe('PENDING_PAYMENT');
  });

  it('Replaying exact duplicate webhook is idempotent and returns isDuplicate: true', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );

    const intent = await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { orderId: order.id },
    );

    const attempt = await paymentService.createPaymentAttempt(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { paymentIntentId: intent.id },
    );

    const payload = {
      event: 'payment.success',
      attemptId: attempt.id,
      reference: attempt.providerReference,
      status: 'SUCCEEDED',
    };

    const firstResult = await paymentService.processPaymentWebhook({
      provider: 'TIPZY',
      eventId: 'evt_replay_005',
      headers: { 'x-webhook-signature': 'valid_secure_signature_123' },
      rawBody: JSON.stringify(payload),
      payload,
    });
    expect(firstResult.isDuplicate).toBe(false);

    // Second delivery of same webhook
    const secondResult = await paymentService.processPaymentWebhook({
      provider: 'TIPZY',
      eventId: 'evt_replay_005',
      headers: { 'x-webhook-signature': 'valid_secure_signature_123' },
      rawBody: JSON.stringify(payload),
      payload,
    });
    expect(secondResult.isDuplicate).toBe(true);
    expect(secondResult.processingStatus).toBe(firstResult.processingStatus);
  });

  it('Replaying webhook with same eventId but conflicting payload throws PaymentEventConflictError', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );

    const intent = await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { orderId: order.id },
    );

    const attempt = await paymentService.createPaymentAttempt(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { paymentIntentId: intent.id },
    );

    await paymentService.processPaymentWebhook({
      provider: 'TIPZY',
      eventId: 'evt_conflict_006',
      headers: { 'x-webhook-signature': 'valid_secure_signature_123' },
      rawBody: '{"amount": 85000, "note": "first"}',
      payload: {
        event: 'payment.success',
        attemptId: attempt.id,
        reference: attempt.providerReference,
        status: 'SUCCEEDED',
        amount: 85000,
        note: 'first',
      },
    });

    // Same eventId with altered payload
    await expect(
      paymentService.processPaymentWebhook({
        provider: 'TIPZY',
        eventId: 'evt_conflict_006',
        headers: { 'x-webhook-signature': 'valid_secure_signature_123' },
        rawBody: '{"amount": 85000, "note": "altered"}',
        payload: {
          event: 'payment.success',
          attemptId: attempt.id,
          reference: attempt.providerReference,
          status: 'SUCCEEDED',
          amount: 85000,
          note: 'altered',
        },
      }),
    ).rejects.toThrow(PaymentEventConflictError);
  });
});

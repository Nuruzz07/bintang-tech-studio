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
  RefundAmountExceededError,
  RefundUnsupportedError,
  PaymentError,
} from '../src/index.js';

describe('M08 Refund Foundation & Financial Balance Suite', () => {
  const storeId = 'store_refund_test';

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
    userId: 'user_refund_merchant',
    membershipId: 'mem_refund_merchant',
    role: 'STORE_OWNER',
  });

  const customer: Customer = {
    id: 'cust_refund_1',
    storeId,
    name: 'Refund Customer',
    email: 'refund@test.local',
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
    id: 'prod_refund_1',
    storeId,
    categoryId: null,
    name: 'Refundable Course',
    slug: 'refundable-course',
    description: null,
    productType: 'DIGITAL',
    price: 100000, // Rp 100,000.00
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
      displayName: 'Refund Tipzy Account',
      credentialReference: 'vault:refund:key',
    });
  });

  async function createSucceededIntent(): Promise<string> {
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
      eventId: `evt_${Date.now()}_${Math.random()}`,
      headers: { 'x-webhook-signature': 'valid_secure_signature_123' },
      rawBody: '{}',
      payload: {
        event: 'payment.success',
        attemptId: attempt.id,
        reference: attempt.providerReference,
        status: 'SUCCEEDED',
        amount: 100000,
      },
    });

    return intent.id;
  }

  it('Full refund transitions payment intent to REFUNDED', async () => {
    const intentId = await createSucceededIntent();

    const refund = await paymentService.createRefund(sellerContext, {
      paymentIntentId: intentId,
      amount: '100000.00',
      reason: 'Customer requested full refund',
    });

    expect(refund.status).toBe('SUCCEEDED');
    expect(refund.amount).toBe('100000.00');

    const updatedIntent = await intentRepo.findById(storeId, intentId);
    expect(updatedIntent?.status).toBe('REFUNDED');
  });

  it('Partial refund transitions payment intent to PARTIALLY_REFUNDED', async () => {
    const intentId = await createSucceededIntent();

    const refund = await paymentService.createRefund(sellerContext, {
      paymentIntentId: intentId,
      amount: '40000.00',
      reason: 'Partial discount refund',
    });

    expect(refund.status).toBe('SUCCEEDED');
    expect(refund.amount).toBe('40000.00');

    const updatedIntent = await intentRepo.findById(storeId, intentId);
    expect(updatedIntent?.status).toBe('PARTIALLY_REFUNDED');
  });

  it('Sequential partial refunds exhausting balance transition intent to REFUNDED', async () => {
    const intentId = await createSucceededIntent();

    // First refund: 60,000
    await paymentService.createRefund(sellerContext, {
      paymentIntentId: intentId,
      amount: '60000.00',
    });

    let intent = await intentRepo.findById(storeId, intentId);
    expect(intent?.status).toBe('PARTIALLY_REFUNDED');

    // Second refund: remaining 40,000
    await paymentService.createRefund(sellerContext, {
      paymentIntentId: intentId,
      amount: '40000.00',
    });

    intent = await intentRepo.findById(storeId, intentId);
    expect(intent?.status).toBe('REFUNDED');
  });

  it('STRICTLY rejects refund amount exceeding refundable balance', async () => {
    const intentId = await createSucceededIntent();

    await expect(
      paymentService.createRefund(sellerContext, {
        paymentIntentId: intentId,
        amount: '150000.00', // exceeds 100,000
      }),
    ).rejects.toThrow(RefundAmountExceededError);
  });

  it('STRICTLY rejects partial refund that exceeds remaining balance after prior refunds', async () => {
    const intentId = await createSucceededIntent();

    await paymentService.createRefund(sellerContext, {
      paymentIntentId: intentId,
      amount: '80000.00',
    });

    // Remaining is 20,000. Trying 30,000 must fail.
    await expect(
      paymentService.createRefund(sellerContext, {
        paymentIntentId: intentId,
        amount: '30000.00',
      }),
    ).rejects.toThrow(RefundAmountExceededError);
  });

  it('Rejects refund on payment intent that is not SUCCEEDED', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );

    const intent = await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { orderId: order.id },
    );

    // Intent is PENDING
    await expect(
      paymentService.createRefund(sellerContext, {
        paymentIntentId: intent.id,
        amount: '100000.00',
      }),
    ).rejects.toThrow(PaymentError);
  });

  it('Throws RefundUnsupportedError if provider does not support refund capability', async () => {
    const nonRefundingAdapter = new MockPaymentProviderAdapter({
      providerName: 'NO_REFUND_PROV',
      capabilities: { refund: false },
    });
    paymentService.registerAdapter(nonRefundingAdapter);

    // Create an account with the non-refunding adapter
    const noRefundAccount = await paymentService.createPaymentAccount(sellerContext, {
      provider: 'NO_REFUND_PROV',
      displayName: 'No Refund Gateway',
      credentialReference: 'vault:ref:norefund',
      capabilities: ['directApi'],
    });

    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );

    const intent = await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { orderId: order.id, paymentAccountId: noRefundAccount.id },
    );

    // Manually mark succeeded to test refund capability defense
    await intentRepo.updateStatus(storeId, intent.id, 'PROCESSING');
    await intentRepo.updateStatus(storeId, intent.id, 'SUCCEEDED');

    await expect(
      paymentService.createRefund(sellerContext, {
        paymentIntentId: intent.id,
        amount: '50000.00',
      }),
    ).rejects.toThrow(RefundUnsupportedError);
  });

  it('Lists all refunds created within the store boundary', async () => {
    const intentId = await createSucceededIntent();

    await paymentService.createRefund(sellerContext, {
      paymentIntentId: intentId,
      amount: '20000.00',
      reason: 'Refund 1',
    });

    await paymentService.createRefund(sellerContext, {
      paymentIntentId: intentId,
      amount: '30000.00',
      reason: 'Refund 2',
    });

    const allRefunds = await refundRepo.findByIntentId(storeId, intentId);
    expect(allRefunds).toHaveLength(2);
    expect(allRefunds[0]?.amount).toBe('20000.00');
    expect(allRefunds[1]?.amount).toBe('30000.00');
  });
});

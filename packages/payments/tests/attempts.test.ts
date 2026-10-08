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
  PaymentError,
} from '../src/index.js';

describe('M08 Payment Attempts Suite', () => {
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

  const storeId = 'store_test_payment_attempts';
  const sellerContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_merchant_att',
    membershipId: 'mem_merchant_att',
    role: 'STORE_OWNER',
  });

  const customer: Customer = {
    id: 'cust_att_01',
    storeId,
    name: 'Customer Attempt Tester',
    email: 'att@example.com',
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
    id: 'prod_att_1',
    storeId,
    categoryId: null,
    name: 'Subscription Access',
    slug: 'subscription-access',
    description: null,
    productType: 'DIGITAL',
    price: 50000,
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

    mockAdapter = new MockPaymentProviderAdapter({ providerName: 'TIPZY' });

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
      displayName: 'Main Tipzy Gateway',
      credentialReference: 'vault:ref:tipzy_main',
    });
  });

  it('spawns payment attempt #1 and transitions intent status to PROCESSING', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );

    const intent = await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { orderId: order.id },
    );
    expect(intent.status).toBe('PENDING');

    const attempt = await paymentService.createPaymentAttempt(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { paymentIntentId: intent.id },
    );

    expect(attempt.id).toBeDefined();
    expect(attempt.attemptNumber).toBe(1);
    expect(attempt.provider).toBe('TIPZY');
    expect(attempt.providerReference).toBeDefined();
    expect(attempt.paymentUrl).toContain('mock-gateway.example.com');
    expect(attempt.status).toBe('PENDING');

    // Intent should now be PROCESSING
    const updatedIntent = await paymentService.getPaymentIntentById(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      intent.id,
    );
    expect(updatedIntent.status).toBe('PROCESSING');
  });

  it('supports multiple sequential attempts under one intent without overwriting historical truth', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );

    const intent = await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { orderId: order.id },
    );

    // Attempt 1
    const attempt1 = await paymentService.createPaymentAttempt(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { paymentIntentId: intent.id },
    );
    expect(attempt1.attemptNumber).toBe(1);

    // Simulate Attempt 1 failing at provider
    await attemptRepo.updateStatus(storeId, attempt1.id, 'FAILED', {
      failureReason: 'User closed payment window',
    });

    // Attempt 2 (customer retries with another method/link)
    const attempt2 = await paymentService.createPaymentAttempt(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { paymentIntentId: intent.id },
    );
    expect(attempt2.attemptNumber).toBe(2);
    expect(attempt2.id).not.toBe(attempt1.id);

    // Verify historical audit trail: Both attempt records exist
    const attempts = await paymentService.listPaymentAttempts(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      intent.id,
    );
    expect(attempts.length).toBe(2);
    expect(attempts[0]!.id).toBe(attempt1.id);
    expect(attempts[0]!.status).toBe('FAILED');
    expect(attempts[0]!.failureReason).toBe('User closed payment window');
    expect(attempts[1]!.id).toBe(attempt2.id);
    expect(attempts[1]!.status).toBe('PENDING');
  });

  it('rejects creating attempt on SUCCEEDED payment intent', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );

    const intent = await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { orderId: order.id },
    );

    // Manually mark intent as SUCCEEDED
    await intentRepo.updateStatus(storeId, intent.id, 'PROCESSING');
    await intentRepo.updateStatus(storeId, intent.id, 'SUCCEEDED');

    await expect(
      paymentService.createPaymentAttempt(
        { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
        { paymentIntentId: intent.id },
      ),
    ).rejects.toThrow(PaymentError);
  });
});

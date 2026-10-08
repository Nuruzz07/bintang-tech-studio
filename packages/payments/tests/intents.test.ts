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
  PaymentAmountMismatchError,
  PaymentCurrencyMismatchError,
  PaymentOrderMismatchError,
  PaymentCustomerAccessDeniedError,
  OrderNotPayableError,
} from '../src/index.js';

describe('M08 Payment Intents & Amount Security Suite', () => {
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

  const storeId = 'store_test_payment_intents';
  const sellerContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_merchant_intent',
    membershipId: 'mem_merchant_intent',
    role: 'STORE_OWNER',
  });

  const customerA: Customer = {
    id: 'cust_intent_a',
    storeId,
    name: 'Customer A',
    email: 'ca@example.com',
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
    id: 'cust_intent_b',
    storeId,
    name: 'Customer B',
    email: 'cb@example.com',
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
    id: 'prod_intent_1',
    storeId,
    categoryId: null,
    name: 'Valuable Course Access',
    slug: 'valuable-course-access',
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

    await customerRepo.create(storeId, customerA);
    await customerRepo.create(storeId, customerB);
    await productRepo.create(storeId, product);

    // Setup active payment account
    await paymentService.createPaymentAccount(sellerContext, {
      provider: 'TIPZY',
      displayName: 'Main Tipzy Account',
      credentialReference: 'vault:ref:tipzy_prod',
    });
  });

  it('creates a valid payment intent deriving authoritative order amount and currency', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );
    expect(order.grandTotal).toBe('100000.00');

    const intent = await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { orderId: order.id },
    );

    expect(intent.id).toBeDefined();
    expect(intent.storeId).toBe(storeId);
    expect(intent.orderId).toBe(order.id);
    expect(intent.customerId).toBe(customerA.id);
    expect(intent.amount).toBe('100000.00');
    expect(intent.currency).toBe('IDR');
    expect(intent.status).toBe('PENDING');
    expect(new Date(intent.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('STRICTLY REJECTS underpayment attack where customer attempts amount 1000 for 100000 order', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );
    expect(order.grandTotal).toBe('100000.00');

    // Malicious attempt: client specifies amount 1000.00
    await expect(
      paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
        {
          orderId: order.id,
          amount: '1000.00', // Tampered amount!
        },
      ),
    ).rejects.toThrow(PaymentAmountMismatchError);

    // Verify 0 payment intents created
    const intents = await intentRepo.list(storeId);
    expect(intents.length).toBe(0);
  });

  it('rejects currency mismatch between client input and authoritative order', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );

    await expect(
      paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
        {
          orderId: order.id,
          currency: 'USD', // Mismatched currency
        },
      ),
    ).rejects.toThrow(PaymentCurrencyMismatchError);
  });

  it('rejects creating payment intent for non-existent order with PaymentOrderMismatchError', async () => {
    await expect(
      paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
        { orderId: 'non_existent_order_id' },
      ),
    ).rejects.toThrow(PaymentOrderMismatchError);
  });

  it('rejects creating payment intent for already PAID order with OrderNotPayableError', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );

    // Transition order to PAID
    await orderService.transitionStatus(sellerContext, order.id, 'PAID');

    await expect(
      paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
        { orderId: order.id },
      ),
    ).rejects.toThrow(OrderNotPayableError);
  });

  it('rejects creating payment intent for CANCELLED order with OrderNotPayableError', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );

    await orderService.cancelOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      order.id,
    );

    await expect(
      paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
        { orderId: order.id },
      ),
    ).rejects.toThrow(OrderNotPayableError);
  });

  it('prevents Customer B from creating payment intent for Customer A order', async () => {
    const orderA = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );

    await expect(
      paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId, customerId: customerB.id } },
        { orderId: orderA.id },
      ),
    ).rejects.toThrow(PaymentCustomerAccessDeniedError);
  });

  it('retrieves created payment intent by ID within customer ownership boundary', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );

    const intent = await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { orderId: order.id },
    );

    const fetched = await paymentService.getPaymentIntentById(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      intent.id,
    );

    expect(fetched.id).toBe(intent.id);
    expect(fetched.amount).toBe(intent.amount);
  });
});

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
  PaymentAccountNotFoundError,
  PaymentIntentNotFoundError,
  PaymentAccount,
} from '../src/index.js';

describe('M08 Tenant Isolation & Cross-Store Boundary Suite', () => {
  const storeA = 'store_isolation_alpha';
  const storeB = 'store_isolation_beta';

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

  let accountB: PaymentAccount;

  const sellerAContext = createAuthenticatedStoreContext({
    storeId: storeA,
    userId: 'user_seller_a',
    membershipId: 'mem_seller_a',
    role: 'STORE_OWNER',
  });

  const sellerBContext = createAuthenticatedStoreContext({
    storeId: storeB,
    userId: 'user_seller_b',
    membershipId: 'mem_seller_b',
    role: 'STORE_OWNER',
  });

  const customerB: Customer = {
    id: 'cust_iso_b',
    storeId: storeB,
    name: 'Customer Beta',
    email: 'cb@tenant.local',
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

  const productB: Product = {
    id: 'prod_iso_b',
    storeId: storeB,
    categoryId: null,
    name: 'Store B Product',
    slug: 'store-b-product',
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

    const mockAdapter = new MockPaymentProviderAdapter({ providerName: 'TIPZY' });
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

    await customerRepo.create(storeB, customerB);
    await productRepo.create(storeB, productB);

    await paymentService.createPaymentAccount(sellerAContext, {
      provider: 'TIPZY',
      displayName: 'Store A Tipzy',
      credentialReference: 'vault:secret:key_a',
    });

    accountB = await paymentService.createPaymentAccount(sellerBContext, {
      provider: 'TIPZY',
      displayName: 'Store B Tipzy',
      credentialReference: 'vault:secret:key_b',
    });
  });

  it('Store A cannot retrieve or mutate Store B payment account', async () => {
    await expect(
      paymentService.getPaymentAccount({ type: 'SELLER', context: sellerAContext }, accountB.id),
    ).rejects.toThrow(PaymentAccountNotFoundError);
  });

  it('Store A cannot retrieve Store B payment intent', async () => {
    const orderB = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId: storeB, customerId: customerB.id } },
      { items: [{ productId: productB.id, quantity: 1 }] },
    );

    const intentB = await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId: storeB, customerId: customerB.id } },
      { orderId: orderB.id, paymentAccountId: accountB.id },
    );

    // Store A seller attempts retrieval
    await expect(
      paymentService.getPaymentIntentById({ type: 'SELLER', context: sellerAContext }, intentB.id),
    ).rejects.toThrow(PaymentIntentNotFoundError);

    // Store A customer attempts retrieval
    await expect(
      paymentService.getPaymentIntentById(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: 'cust_a' } },
        intentB.id,
      ),
    ).rejects.toThrow(PaymentIntentNotFoundError);
  });

  it('STRICTLY rejects creating a payment attempt across tenant store boundaries', async () => {
    const orderB = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId: storeB, customerId: customerB.id } },
      { items: [{ productId: productB.id, quantity: 1 }] },
    );

    const intentB = await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId: storeB, customerId: customerB.id } },
      { orderId: orderB.id },
    );

    // Caller from Store A tries to create attempt for Intent B
    await expect(
      paymentService.createPaymentAttempt(
        { type: 'CUSTOMER', context: { storeId: storeA, customerId: 'cust_a' } },
        { paymentIntentId: intentB.id },
      ),
    ).rejects.toThrow(PaymentIntentNotFoundError);
  });

  it('STRICTLY rejects refund operations across tenant store boundaries', async () => {
    const orderB = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId: storeB, customerId: customerB.id } },
      { items: [{ productId: productB.id, quantity: 1 }] },
    );

    const intentB = await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId: storeB, customerId: customerB.id } },
      { orderId: orderB.id },
    );

    // Seller A tries to issue refund on Intent B
    await expect(
      paymentService.createRefund(
        { type: 'SELLER', context: sellerAContext },
        { paymentIntentId: intentB.id, amount: '50000.00' },
      ),
    ).rejects.toThrow(PaymentIntentNotFoundError);
  });

  it('Payment account list returns only the inquiring tenant accounts', async () => {
    const listA = await paymentService.listPaymentAccounts(sellerAContext);
    const listB = await paymentService.listPaymentAccounts(sellerBContext);

    expect(listA).toHaveLength(1);
    expect(listA[0]?.storeId).toBe(storeA);
    expect(listA[0]?.displayName).toBe('Store A Tipzy');

    expect(listB).toHaveLength(1);
    expect(listB[0]?.storeId).toBe(storeB);
    expect(listB[0]?.displayName).toBe('Store B Tipzy');
  });

  it('Payment intent list returns only the inquiring tenant intents', async () => {
    const customerA: Customer = {
      id: 'cust_iso_a',
      storeId: storeA,
      name: 'Customer Alpha',
      email: 'ca@tenant.local',
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
    const productA: Product = {
      id: 'prod_iso_a',
      storeId: storeA,
      categoryId: null,
      name: 'Store A Product',
      slug: 'store-a-product',
      description: null,
      productType: 'DIGITAL',
      price: 10000,
      compareAtPrice: null,
      stockMode: 'UNLIMITED',
      status: 'ACTIVE',
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await customerRepo.create(storeA, customerA);
    await productRepo.create(storeA, productA);

    const orderA = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
      { items: [{ productId: productA.id, quantity: 1 }] },
    );
    await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId: storeA, customerId: customerA.id } },
      { orderId: orderA.id },
    );

    const listA = await paymentService.listPaymentIntents({
      type: 'SELLER',
      context: sellerAContext,
    });
    const listB = await paymentService.listPaymentIntents({
      type: 'SELLER',
      context: sellerBContext,
    });

    expect(listA).toHaveLength(1);
    expect(listA[0]?.storeId).toBe(storeA);
    expect(listB).toHaveLength(0);
  });
});

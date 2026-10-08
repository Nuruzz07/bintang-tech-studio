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
  PaymentCustomerAccessDeniedError,
} from '../src/index.js';

describe('M08 Authorization & Security Boundary Suite', () => {
  const storeId = 'store_auth_test';

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

  const ownerContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_owner',
    membershipId: 'mem_owner',
    role: 'STORE_OWNER',
  });

  const staffWithoutManageContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_staff',
    membershipId: 'mem_staff',
    role: 'STORE_STAFF',
    permissions: ['payments.read', 'orders.read'],
  });

  const customerA: Customer = {
    id: 'cust_auth_a',
    storeId,
    name: 'Customer A',
    email: 'ca@auth.local',
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
    id: 'cust_auth_b',
    storeId,
    name: 'Customer B',
    email: 'cb@auth.local',
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
    id: 'prod_auth_1',
    storeId,
    categoryId: null,
    name: 'Auth Test Product',
    slug: 'auth-test-product',
    description: null,
    productType: 'DIGITAL',
    price: 150000,
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

    await customerRepo.create(storeId, customerA);
    await customerRepo.create(storeId, customerB);
    await productRepo.create(storeId, product);

    await paymentService.createPaymentAccount(ownerContext, {
      provider: 'TIPZY',
      displayName: 'Main Tipzy Account',
      credentialReference: 'vault:auth:secret_key',
    });
  });

  it('STORE_STAFF without payments.manage is forbidden from creating payment account', async () => {
    await expect(
      paymentService.createPaymentAccount(staffWithoutManageContext, {
        provider: 'TIPZY',
        displayName: 'Unauthorized Account',
        credentialReference: 'vault:unauthorized',
      }),
    ).rejects.toThrow();
  });

  it('Customer cannot create payment account', async () => {
    await expect(
      paymentService.createPaymentAccount(
        {
          type: 'CUSTOMER',
          context: { storeId, customerId: customerA.id },
        } as unknown as AuthenticatedStoreContext,
        {
          provider: 'TIPZY',
          displayName: 'Customer Created Account',
          credentialReference: 'vault:bad',
        },
      ),
    ).rejects.toThrow();
  });

  it('Customer receives public payment account projection with credentialReference stripped', async () => {
    const accounts = await accountRepo.list(storeId);
    const accountId = accounts[0]!.id;

    const publicAccount = (await paymentService.getPaymentAccount(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      accountId,
    )) as unknown as Record<string, unknown>;

    expect(publicAccount.id).toBe(accountId);
    expect(publicAccount.displayName).toBe('Main Tipzy Account');
    expect(publicAccount.credentialReference).toBeUndefined();
    expect(publicAccount.configuration).toBeUndefined();
  });

  it('Owner receives complete payment account including credentialReference', async () => {
    const accounts = await accountRepo.list(storeId);
    const accountId = accounts[0]!.id;

    const fullAccount = await paymentService.getPaymentAccount(
      { type: 'SELLER', context: ownerContext },
      accountId,
    );

    expect(fullAccount.id).toBe(accountId);
    expect('credentialReference' in fullAccount).toBe(true);
    expect((fullAccount as PaymentAccount).credentialReference).toBe('vault:auth:secret_key');
  });

  it('Customer B is strictly forbidden from viewing Customer A payment intent', async () => {
    const orderA = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );

    const intentA = await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { orderId: orderA.id },
    );

    // Customer B tries to view Intent A
    await expect(
      paymentService.getPaymentIntentById(
        { type: 'CUSTOMER', context: { storeId, customerId: customerB.id } },
        intentA.id,
      ),
    ).rejects.toThrow(PaymentCustomerAccessDeniedError);
  });

  it('Customer is strictly forbidden from issuing refunds', async () => {
    const orderA = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );

    const intentA = await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { orderId: orderA.id },
    );

    await expect(
      paymentService.createRefund(
        { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
        { paymentIntentId: intentA.id, amount: '50000.00' },
      ),
    ).rejects.toThrow(PaymentCustomerAccessDeniedError);
  });

  it('Seller can view all payment intents within the store', async () => {
    const orderA = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );

    const intentA = await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { orderId: orderA.id },
    );

    const fetchedBySeller = await paymentService.getPaymentIntentById(
      { type: 'SELLER', context: ownerContext },
      intentA.id,
    );

    expect(fetchedBySeller.id).toBe(intentA.id);
    expect(fetchedBySeller.amount).toBe(intentA.amount);
  });
});

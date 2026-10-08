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
  InMemoryPaymentIdempotencyRepository,
  MockPaymentProviderAdapter,
  PaymentIdempotencyConflictError,
} from '../src/index.js';

describe('M08 Idempotency & Concurrency Protection Suite', () => {
  const storeId = 'store_idemp_test';

  let orderRepo: InMemoryOrderRepository;
  let customerRepo: InMemoryCustomerRepository;
  let productRepo: InMemoryProductRepository;
  let inventoryRepo: InMemoryInventoryRepository;
  let accountRepo: InMemoryPaymentAccountRepository;
  let intentRepo: InMemoryPaymentIntentRepository;
  let attemptRepo: InMemoryPaymentAttemptRepository;
  let eventRepo: InMemoryPaymentEventRepository;
  let refundRepo: InMemoryRefundRepository;
  let idempotencyRepo: InMemoryPaymentIdempotencyRepository;
  let authService: AuthorizationService;
  let orderService: OrderService;
  let paymentService: PaymentService;

  const sellerContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_idemp_merchant',
    membershipId: 'mem_idemp_merchant',
    role: 'STORE_OWNER',
  });

  const customerA: Customer = {
    id: 'cust_idemp_a',
    storeId,
    name: 'Customer A',
    email: 'ca@idemp.local',
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
    id: 'cust_idemp_b',
    storeId,
    name: 'Customer B',
    email: 'cb@idemp.local',
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

  const product1: Product = {
    id: 'prod_idemp_1',
    storeId,
    categoryId: null,
    name: 'Idempotent Product 1',
    slug: 'idempotent-product-1',
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

  const product2: Product = {
    id: 'prod_idemp_2',
    storeId,
    categoryId: null,
    name: 'Idempotent Product 2',
    slug: 'idempotent-product-2',
    description: null,
    productType: 'DIGITAL',
    price: 200000,
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
    idempotencyRepo = new InMemoryPaymentIdempotencyRepository();
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
      idempotencyRepository: idempotencyRepo,
      authorizationService: authService,
      orderService,
      adapters: [mockAdapter],
    });

    await customerRepo.create(storeId, customerA);
    await customerRepo.create(storeId, customerB);
    await productRepo.create(storeId, product1);
    await productRepo.create(storeId, product2);

    await paymentService.createPaymentAccount(sellerContext, {
      provider: 'TIPZY',
      displayName: 'Idemp Account',
      credentialReference: 'vault:idemp:key',
    });
  });

  it('Replaying identical createPaymentIntent returns cached result without creating duplicate records', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { items: [{ productId: product1.id, quantity: 1 }] },
    );

    const idempotencyKey = 'idemp_key_123';

    const intent1 = await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { orderId: order.id, idempotencyKey },
    );

    // Replay with identical payload & key
    const intent2 = await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { orderId: order.id, idempotencyKey },
    );

    expect(intent2.id).toBe(intent1.id);
    expect(intent2.createdAt).toBe(intent1.createdAt);

    // Verify only 1 record created in database
    const allIntents = await intentRepo.list(storeId);
    expect(allIntents).toHaveLength(1);
  });

  it('Replaying createPaymentIntent with SAME key but DIFFERENT orderId throws PaymentIdempotencyConflictError', async () => {
    const order1 = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { items: [{ productId: product1.id, quantity: 1 }] },
    );
    const order2 = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { items: [{ productId: product2.id, quantity: 1 }] },
    );

    const idempotencyKey = 'idemp_conflict_key';

    await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { orderId: order1.id, idempotencyKey },
    );

    // Replay with same key but different orderId
    await expect(
      paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
        { orderId: order2.id, idempotencyKey },
      ),
    ).rejects.toThrow(PaymentIdempotencyConflictError);
  });

  it('Different customers can safely use the same idempotency key without collision', async () => {
    const orderA = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { items: [{ productId: product1.id, quantity: 1 }] },
    );
    const orderB = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customerB.id } },
      { items: [{ productId: product1.id, quantity: 1 }] },
    );

    const commonKey = 'shared_client_idempotency_key';

    const intentA = await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { orderId: orderA.id, idempotencyKey: commonKey },
    );

    const intentB = await paymentService.createPaymentIntent(
      { type: 'CUSTOMER', context: { storeId, customerId: customerB.id } },
      { orderId: orderB.id, idempotencyKey: commonKey },
    );

    expect(intentA.id).not.toBe(intentB.id);
    expect(intentA.orderId).toBe(orderA.id);
    expect(intentB.orderId).toBe(orderB.id);

    const allIntents = await intentRepo.list(storeId);
    expect(allIntents).toHaveLength(2);
  });

  it('In-memory idempotency repository stores and retrieves records by compound key', async () => {
    const repo = new InMemoryPaymentIdempotencyRepository();
    const now = new Date().toISOString();

    await repo.set({
      storeId,
      actorId: 'user_1',
      key: 'key_alpha',
      requestHash: 'hash_1',
      response: { status: 'OK' },
      createdAt: now,
    });

    const result = await repo.get(storeId, 'user_1', 'key_alpha');
    expect(result).not.toBeNull();
    expect(result?.key).toBe('key_alpha');
    expect(result?.response).toEqual({ status: 'OK' });

    const nonExistent = await repo.get(storeId, 'user_1', 'key_beta');
    expect(nonExistent).toBeNull();
  });

  it('Concurrent execution with identical idempotency key is serialized without duplicate intent', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
      { items: [{ productId: product1.id, quantity: 1 }] },
    );

    const key = 'concurrent_race_key';

    // Fire 2 concurrent requests simultaneously
    const [res1, res2] = await Promise.all([
      paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
        { orderId: order.id, idempotencyKey: key },
      ),
      paymentService.createPaymentIntent(
        { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
        { orderId: order.id, idempotencyKey: key },
      ),
    ]);

    expect(res1.id).toBe(res2.id);
    const allIntents = await intentRepo.list(storeId);
    expect(allIntents).toHaveLength(1);
  });
});

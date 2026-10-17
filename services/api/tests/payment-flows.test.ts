/**
 * Bintang Tech Studio - HTTP API Gateway Payment & Fulfillment Integration Suite.
 *
 * Exercises the end-to-end web customer checkout journey over HTTP transport:
 * 1. POST /api/v1/stores/:storeId/orders -> Creates order and reserves stock
 * 2. POST /api/v1/stores/:storeId/orders/:orderId/payments -> Initiates payment intent and attempt
 * 3. POST /api/v1/webhooks/payments/MOCK_PAYMENT -> Simulates provider webhook settlement
 * 4. GET /api/v1/stores/:storeId/orders/:orderId -> Verifies order transitioned to PAID
 * 5. GET /api/v1/stores/:storeId/orders/:orderId/fulfillment -> Retrieves sanitized digital license
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AddressInfo } from 'node:net';
import { StructuredLogger } from '@bintang/observability';
import { Store, StoreRepository } from '@bintang/tenancy';
import { AuthorizationService, InMemoryEntitlementResolver } from '@bintang/authorization';
import {
  CatalogService,
  InMemoryProductRepository,
  InMemoryCategoryRepository,
  Category,
  Product,
} from '@bintang/commerce';
import { InventoryService, InMemoryInventoryRepository } from '@bintang/inventory';
import {
  OrderService,
  InMemoryOrderRepository,
  InMemoryCustomerRepository,
  InMemoryIdempotencyRepository,
  Customer,
} from '@bintang/orders';
import {
  PaymentService,
  InMemoryPaymentAccountRepository,
  InMemoryPaymentIntentRepository,
  InMemoryPaymentAttemptRepository,
  InMemoryPaymentEventRepository,
  InMemoryRefundRepository,
  InMemoryPaymentIdempotencyRepository,
  MockPaymentProviderAdapter,
} from '@bintang/payments';
import {
  FulfillmentService,
  InMemoryFulfillmentRepository,
  InMemoryFulfillmentItemRepository,
  InMemoryFulfillmentIdempotencyRepository,
  MockFulfillmentProviderAdapter,
} from '@bintang/fulfillment';
import { createApiServer, ApiServerInstance } from '../src/index.js';

class TestStoreRepository implements StoreRepository {
  private readonly stores = new Map<string, Store>();

  setStore(store: Store): void {
    this.stores.set(store.id, store);
  }

  async findById(id: string): Promise<Store | null> {
    return this.stores.get(id) || null;
  }

  async findBySlug(slug: string): Promise<Store | null> {
    for (const store of this.stores.values()) {
      if (store.slug.toLowerCase() === slug.toLowerCase()) {
        return store;
      }
    }
    return null;
  }

  async findByOwnerUserId(ownerUserId: string): Promise<Store[]> {
    return Array.from(this.stores.values()).filter((s) => s.ownerUserId === ownerUserId);
  }

  async create(store: Omit<Store, 'id' | 'createdAt' | 'updatedAt'>): Promise<Store> {
    const id = `store_${Math.random().toString(36).substring(2, 10)}`;
    const now = new Date().toISOString();
    const newStore: Store = { id, ...store, createdAt: now, updatedAt: now };
    this.stores.set(id, newStore);
    return newStore;
  }

  async update(id: string, updates: Partial<Omit<Store, 'id' | 'createdAt'>>): Promise<Store> {
    const existing = this.stores.get(id);
    if (!existing) throw new Error('Store not found');
    const updated: Store = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.stores.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.stores.delete(id);
  }
}

describe('HTTP API Gateway Payment & Fulfillment Flow', () => {
  let serverInstance: ApiServerInstance;
  let baseUrl: string;

  // Repositories
  let storeRepo: TestStoreRepository;
  let categoryRepo: InMemoryCategoryRepository;
  let productRepo: InMemoryProductRepository;
  let inventoryRepo: InMemoryInventoryRepository;
  let orderRepo: InMemoryOrderRepository;
  let customerRepo: InMemoryCustomerRepository;
  let idempotencyRepo: InMemoryIdempotencyRepository;

  // Payments Repositories
  let paymentAccountRepo: InMemoryPaymentAccountRepository;
  let paymentIntentRepo: InMemoryPaymentIntentRepository;
  let paymentAttemptRepo: InMemoryPaymentAttemptRepository;
  let paymentEventRepo: InMemoryPaymentEventRepository;
  let refundRepo: InMemoryRefundRepository;
  let paymentIdempotencyRepo: InMemoryPaymentIdempotencyRepository;

  // Fulfillment Repositories
  let fulfillmentRepo: InMemoryFulfillmentRepository;
  let fulfillmentItemRepo: InMemoryFulfillmentItemRepository;
  let fulfillmentIdempotencyRepo: InMemoryFulfillmentIdempotencyRepository;

  // Services
  let authService: AuthorizationService;
  let catalogService: CatalogService;
  let inventoryService: InventoryService;
  let orderService: OrderService;
  let paymentService: PaymentService;
  let fulfillmentService: FulfillmentService;
  let mockPaymentAdapter: MockPaymentProviderAdapter;
  let mockFulfillmentAdapter: MockFulfillmentProviderAdapter;
  let logger: StructuredLogger;

  const storeId = 'store_pilot_web_01';
  const customerId = 'cust_pilot_web_buyer';

  beforeAll(async () => {
    logger = new StructuredLogger({ requestId: 'payment-flows-test' });
    storeRepo = new TestStoreRepository();
    categoryRepo = new InMemoryCategoryRepository();
    productRepo = new InMemoryProductRepository();
    inventoryRepo = new InMemoryInventoryRepository();
    orderRepo = new InMemoryOrderRepository();
    customerRepo = new InMemoryCustomerRepository();
    idempotencyRepo = new InMemoryIdempotencyRepository();

    paymentAccountRepo = new InMemoryPaymentAccountRepository();
    paymentIntentRepo = new InMemoryPaymentIntentRepository();
    paymentAttemptRepo = new InMemoryPaymentAttemptRepository();
    paymentEventRepo = new InMemoryPaymentEventRepository();
    refundRepo = new InMemoryRefundRepository();
    paymentIdempotencyRepo = new InMemoryPaymentIdempotencyRepository();

    fulfillmentRepo = new InMemoryFulfillmentRepository();
    fulfillmentItemRepo = new InMemoryFulfillmentItemRepository(fulfillmentRepo);
    fulfillmentIdempotencyRepo = new InMemoryFulfillmentIdempotencyRepository();

    authService = new AuthorizationService(new InMemoryEntitlementResolver());

    catalogService = new CatalogService({
      categoryRepository: categoryRepo,
      productRepository: productRepo,
      authorizationService: authService,
    });

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
      idempotencyRepository: idempotencyRepo,
    });

    mockPaymentAdapter = new MockPaymentProviderAdapter({ providerName: 'MOCK_PAYMENT' });
    paymentService = new PaymentService({
      accountRepository: paymentAccountRepo,
      intentRepository: paymentIntentRepo,
      attemptRepository: paymentAttemptRepo,
      eventRepository: paymentEventRepo,
      refundRepository: refundRepo,
      idempotencyRepository: paymentIdempotencyRepo,
      authorizationService: authService,
      orderService,
      adapters: [mockPaymentAdapter],
    });

    mockFulfillmentAdapter = new MockFulfillmentProviderAdapter('MOCK_DIGITAL');
    fulfillmentService = new FulfillmentService({
      fulfillmentRepository: fulfillmentRepo,
      fulfillmentItemRepository: fulfillmentItemRepo,
      idempotencyRepository: fulfillmentIdempotencyRepo,
      authorizationService: authService,
      orderService,
      inventoryService,
      providers: [mockFulfillmentAdapter],
    });

    // Seed Store
    const now = new Date().toISOString();
    storeRepo.setStore({
      id: storeId,
      name: 'Bintang Web Pilot Store',
      slug: 'bintang-pilot',
      ownerUserId: 'user_owner_01',
      templateVersionId: 'tmpl-01',
      status: 'ACTIVE',
      currency: 'IDR',
      settings: {},
      createdAt: now,
      updatedAt: now,
    });

    // Seed Active Payment Account
    await paymentAccountRepo.create(storeId, {
      id: `acc_${storeId}`,
      storeId,
      provider: 'MOCK_PAYMENT',
      displayName: 'QRIS Sandbox',
      status: 'ACTIVE',
      currency: 'IDR',
      credentialReference: 'vault:secret:sandbox_key',
      capabilities: ['createPayment', 'verifyPayment', 'webhook'],
      configuration: {},
      createdAt: now,
      updatedAt: now,
    });

    // Seed Digital Product & Inventory
    const category: Category = {
      id: 'cat_dig_01',
      storeId,
      name: 'Digital Services',
      slug: 'digital-services',
      description: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };
    await categoryRepo.create(storeId, category);

    const product: Product = {
      id: 'prod_vpn_prem',
      storeId,
      categoryId: category.id,
      name: '1-Month VPN Premium',
      slug: '1-month-vpn-premium',
      description: 'Ultra fast secure VPN',
      productType: 'DIGITAL',
      price: 25000,
      compareAtPrice: 50000,
      stockMode: 'MANAGED',
      status: 'ACTIVE',
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };
    await productRepo.create(storeId, product);

    const sellerContext = {
      storeId,
      userId: 'user_owner_01',
      membershipId: 'mem_owner_01',
      role: 'STORE_OWNER',
    };

    await inventoryService.adjustStock(sellerContext, product.id, {
      type: 'INCREASE',
      quantity: 5,
      reason: 'Initial stock deposit',
    });

    // Seed Customer
    const customer: Customer = {
      id: customerId,
      storeId,
      name: 'Budi Pembeli',
      email: 'budi@example.com',
      phone: null,
      telegramId: null,
      whatsappNumber: null,
      totalOrders: 0,
      totalSpent: '0.00',
      lastOrderAt: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };
    await customerRepo.create(storeId, customer);

    // Boot API Server
    serverInstance = createApiServer({
      port: 0,
      host: '127.0.0.1',
      logger,
      dependencies: {
        storeRepo,
        customerRepo,
        catalogService,
        inventoryService,
        orderService,
        paymentService,
        fulfillmentService,
        logger,
      },
    });

    await serverInstance.start();
    const address = serverInstance.server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await serverInstance.stop();
  });

  it('completes customer payment journey with automatic fulfillment on webhook settlement', async () => {
    // 1. Create Order via HTTP
    const createOrderRes = await fetch(`${baseUrl}/api/v1/stores/${storeId}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: 'prod_vpn_prem', quantity: 1 }],
        customer: {
          name: 'Budi Pembeli',
          email: 'budi@example.com',
        },
      }),
    });

    expect(createOrderRes.status).toBe(201);
    const orderData = (await createOrderRes.json()) as {
      data: { id: string; status: string; grandTotal: string };
    };
    const orderId = orderData.data.id;
    expect(orderId).toBeDefined();
    expect(orderData.data.status).toBe('PENDING_PAYMENT');
    expect(orderData.data.grandTotal).toBe('25000.00');

    // 2. Initiate Payment via HTTP
    const createPaymentRes = await fetch(
      `${baseUrl}/api/v1/stores/${storeId}/orders/${orderId}/payments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
    );

    expect(createPaymentRes.status).toBe(201);
    const paymentData = (await createPaymentRes.json()) as {
      data: {
        paymentIntentId: string;
        attemptId: string;
        attemptNumber: number;
        status: string;
        amount: string;
        currency: string;
        provider: string;
        paymentUrl: string;
      };
    };

    expect(paymentData.data.paymentIntentId).toBeDefined();
    expect(paymentData.data.attemptId).toBeDefined();
    expect(paymentData.data.attemptNumber).toBe(1);
    expect(paymentData.data.status).toBe('PENDING');
    expect(paymentData.data.amount).toBe('25000.00');
    expect(paymentData.data.currency).toBe('IDR');
    expect(paymentData.data.provider).toBe('MOCK_PAYMENT');
    expect(paymentData.data.paymentUrl).toContain('mock-gateway.example.com');

    // 3. Send Webhook Settlement Callback via HTTP
    const webhookEventId = `evt_pay_sandbox_${Date.now()}`;
    const webhookRes = await fetch(`${baseUrl}/api/v1/webhooks/payments/MOCK_PAYMENT`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-event-id': webhookEventId,
        'x-signature': 'valid_signature',
      },
      body: JSON.stringify({
        eventId: webhookEventId,
        paymentIntentId: paymentData.data.paymentIntentId,
        providerReference: paymentData.data.providerReference,
        status: 'SUCCEEDED',
        amount: '25000.00',
        currency: 'IDR',
        storeId,
      }),
    });

    expect(webhookRes.status).toBe(200);
    const webhookData = (await webhookRes.json()) as {
      data: {
        received: boolean;
        eventId: string;
        processingStatus: string;
        isDuplicate: boolean;
      };
    };
    expect(webhookData.data.received).toBe(true);
    expect(webhookData.data.processingStatus).toBe('PROCESSED');
    expect(webhookData.data.isDuplicate).toBe(false);

    // 4. Verify Order Status via HTTP
    // Retrieve using customer seller/context
    const systemContext = {
      storeId,
      userId: 'user_owner_01',
      membershipId: 'mem_owner_01',
      role: 'STORE_OWNER',
    };
    const orderCaller = { type: 'SELLER' as const, context: systemContext };
    const orderAfterPayment = await orderService.getOrderById(orderCaller, orderId);
    expect(orderAfterPayment.status).toBe('FULFILLED');
    const automaticallyCreated = await fulfillmentService.listFulfillments(
      { type: 'SELLER', context: systemContext },
      { orderId },
    );
    expect(automaticallyCreated).toHaveLength(1);
    expect(automaticallyCreated[0]?.status).toBe('FULFILLED');

    // 5. Duplicate Webhook Replay is Idempotent
    const replayRes = await fetch(`${baseUrl}/api/v1/webhooks/payments/MOCK_PAYMENT`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-event-id': webhookEventId,
        'x-signature': 'valid_signature',
      },
      body: JSON.stringify({
        eventId: webhookEventId,
        paymentIntentId: paymentData.data.paymentIntentId,
        providerReference: paymentData.data.providerReference,
        status: 'SUCCEEDED',
        amount: '25000.00',
        currency: 'IDR',
        storeId,
      }),
    });

    expect(replayRes.status).toBe(200);
    const replayData = (await replayRes.json()) as {
      data: {
        isDuplicate: boolean;
      };
    };
    expect(replayData.data.isDuplicate).toBe(true);
  });

  it('rejects initiating payment if order is already cancelled', async () => {
    // 1. Create Order
    const createOrderRes = await fetch(`${baseUrl}/api/v1/stores/${storeId}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: 'prod_vpn_prem', quantity: 1 }],
        customer: {
          name: 'Budi Pembeli',
        },
      }),
    });
    const orderData = (await createOrderRes.json()) as { data: { id: string } };
    const orderId = orderData.data.id;

    // 2. Cancel Order
    const systemContext = {
      storeId,
      userId: 'user_owner_01',
      membershipId: 'mem_owner_01',
      role: 'STORE_OWNER',
    };
    await orderService.cancelOrder({ type: 'SELLER', context: systemContext }, orderId);

    // 3. Attempt Payment
    const paymentRes = await fetch(
      `${baseUrl}/api/v1/stores/${storeId}/orders/${orderId}/payments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
    );

    expect(paymentRes.status).toBe(422);
    const errData = (await paymentRes.json()) as { error: { message: string } };
    expect(errData.error.message).toMatch(/CANCELLED/i);
  });

  it('rejects webhook callback with invalid signature with 401 Unauthorized', async () => {
    // 1. Create Order
    const createOrderRes = await fetch(`${baseUrl}/api/v1/stores/${storeId}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: 'prod_vpn_prem', quantity: 1 }],
        customer: { name: 'Budi' },
      }),
    });
    const orderData = (await createOrderRes.json()) as { data: { id: string } };

    // 2. Create Payment Attempt
    const payRes = await fetch(
      `${baseUrl}/api/v1/stores/${storeId}/orders/${orderData.data.id}/payments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
    );
    const payData = (await payRes.json()) as {
      data: { paymentIntentId: string; providerReference: string };
    };

    // 3. Send Webhook with Forged / Invalid Signature
    const invalidWebhookRes = await fetch(`${baseUrl}/api/v1/webhooks/payments/MOCK_PAYMENT`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-event-id': 'evt_spoofed_01',
        'x-signature': 'invalid_forged_sig',
      },
      body: JSON.stringify({
        eventId: 'evt_spoofed_01',
        paymentIntentId: payData.data.paymentIntentId,
        providerReference: payData.data.providerReference,
        status: 'SUCCEEDED',
        amount: '25000.00',
        currency: 'IDR',
        storeId,
      }),
    });

    expect(invalidWebhookRes.status).toBe(401);
    const errData = (await invalidWebhookRes.json()) as {
      error: { code: string; message: string };
    };
    expect(errData.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects payment initiation when store ID does not match order tenant', async () => {
    const otherStoreId = 'store_pilot_other_99';
    storeRepo.setStore({
      id: otherStoreId,
      name: 'Other Store',
      slug: 'other-store',
      ownerUserId: 'user_other',
      templateVersionId: 'tmpl-01',
      status: 'ACTIVE',
      currency: 'IDR',
      settings: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Create order in storeId
    const createOrderRes = await fetch(`${baseUrl}/api/v1/stores/${storeId}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: 'prod_vpn_prem', quantity: 1 }],
        customer: { name: 'Budi' },
      }),
    });
    const orderData = (await createOrderRes.json()) as { data: { id: string } };

    // Try paying via otherStoreId
    const crossTenantRes = await fetch(
      `${baseUrl}/api/v1/stores/${otherStoreId}/orders/${orderData.data.id}/payments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
    );

    expect(crossTenantRes.status).toBe(404);
  });

  it('allows retrieving order digital fulfillment items after fulfillment', async () => {
    // 1. Create Order
    const createOrderRes = await fetch(`${baseUrl}/api/v1/stores/${storeId}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: 'prod_vpn_prem', quantity: 1 }],
        customer: { name: 'Budi' },
      }),
    });
    const orderData = (await createOrderRes.json()) as { data: { id: string } };
    const orderId = orderData.data.id;

    // 2. Pay Order
    const payRes = await fetch(`${baseUrl}/api/v1/stores/${storeId}/orders/${orderId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const payData = (await payRes.json()) as {
      data: { paymentIntentId: string; providerReference: string };
    };

    // 3. Webhook Settle
    const webhookEventId = `evt_fulfill_test_${Date.now()}`;
    await fetch(`${baseUrl}/api/v1/webhooks/payments/MOCK_PAYMENT`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-event-id': webhookEventId,
        'x-signature': 'valid_signature',
      },
      body: JSON.stringify({
        eventId: webhookEventId,
        paymentIntentId: payData.data.paymentIntentId,
        providerReference: payData.data.providerReference,
        status: 'SUCCEEDED',
        amount: '25000.00',
        currency: 'IDR',
        storeId,
      }),
    });

    // 4. Webhook settlement above already auto-fulfilled the order.
    // Query the fulfilled items via API as Seller.
    // Create seller session token
    const sellerToken = 'token_seller_fulfill_test';
    const sessionRepo = {
      findByToken: async (t: string) =>
        t === sellerToken
          ? {
              id: 'sess_01',
              sessionType: 'SELLER' as const,
              userId: 'user_owner_01',
              storeId,
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
              revokedAt: null,
            }
          : null,
    };
    const memberRepo = {
      findByStoreAndUser: async (_s: string, _u: string) => ({
        id: 'mem_owner_01',
        storeId,
        userId: 'user_owner_01',
        role: 'STORE_OWNER',
        status: 'ACTIVE',
      }),
    };

    // Inject session lookup for this test
    (serverInstance.dependencies as unknown as { sessionRepo: unknown }).sessionRepo = sessionRepo;
    (serverInstance.dependencies as unknown as { storeMemberRepo: unknown }).storeMemberRepo =
      memberRepo;

    const fulfillRes = await fetch(
      `${baseUrl}/api/v1/stores/${storeId}/orders/${orderId}/fulfillment`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${sellerToken}`,
        },
      },
    );

    expect(fulfillRes.status).toBe(200);
    const fulfillData = (await fulfillRes.json()) as {
      data: Array<{ id: string; status: string }>;
    };
    expect(fulfillData.data.length).toBeGreaterThan(0);
    expect(fulfillData.data[0]?.status).toBe('FULFILLED');
  });
});

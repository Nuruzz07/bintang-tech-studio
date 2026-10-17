/**
 * Bintang Tech Studio — E2E Tipzy QRIS & Multi-Tenant Onboarding Integration Suite.
 *
 * Covers:
 * 1. Tipzy QRIS transaction creation & status check endpoints
 * 2. E2E Customer order payment via Tipzy Webhook with valid HMAC SHA-256 signature
 * 3. Automatic zero-click fulfillment & digital credential delivery upon payment settlement
 * 4. Tampered webhook signature rejection (401 Unauthorized, AC-PAY-02)
 * 5. Idempotent webhook replay protection (AC-PAY-01)
 * 6. Multi-tenant seller onboarding & store resolution/provisioning
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AddressInfo } from 'node:net';
import { createHmac } from 'node:crypto';
import { StructuredLogger } from '@bintang/observability';
import { Store, StoreRepository } from '@bintang/tenancy';
import { AuthorizationService, InMemoryEntitlementResolver } from '@bintang/authorization';
import {
  CatalogService,
  InMemoryProductRepository,
  InMemoryCategoryRepository,
} from '@bintang/commerce';
import { InventoryService, InMemoryInventoryRepository } from '@bintang/inventory';
import {
  OrderService,
  InMemoryOrderRepository,
  InMemoryCustomerRepository,
  InMemoryIdempotencyRepository,
} from '@bintang/orders';
import {
  PaymentService,
  InMemoryPaymentAccountRepository,
  InMemoryPaymentIntentRepository,
  InMemoryPaymentAttemptRepository,
  InMemoryPaymentEventRepository,
  InMemoryRefundRepository,
  InMemoryPaymentIdempotencyRepository,
  TipzyPaymentProviderAdapter,
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

  async updateOwner(id: string, newOwnerUserId: string): Promise<Store> {
    const existing = this.stores.get(id);
    if (!existing) throw new Error('Store not found');
    const updated: Store = {
      ...existing,
      ownerUserId: newOwnerUserId,
      updatedAt: new Date().toISOString(),
    };
    this.stores.set(id, updated);
    return updated;
  }
}

describe('E2E Tipzy QRIS & Multi-Tenant Onboarding Suite', () => {
  let serverInstance: ApiServerInstance;
  let baseUrl: string;

  let storeRepo: TestStoreRepository;
  let categoryRepo: InMemoryCategoryRepository;
  let productRepo: InMemoryProductRepository;
  let inventoryRepo: InMemoryInventoryRepository;
  let orderRepo: InMemoryOrderRepository;
  let customerRepo: InMemoryCustomerRepository;
  let idempotencyRepo: InMemoryIdempotencyRepository;

  let paymentAccountRepo: InMemoryPaymentAccountRepository;
  let paymentIntentRepo: InMemoryPaymentIntentRepository;
  let paymentAttemptRepo: InMemoryPaymentAttemptRepository;
  let paymentEventRepo: InMemoryPaymentEventRepository;
  let refundRepo: InMemoryRefundRepository;
  let paymentIdempotencyRepo: InMemoryPaymentIdempotencyRepository;

  let fulfillmentRepo: InMemoryFulfillmentRepository;
  let fulfillmentItemRepo: InMemoryFulfillmentItemRepository;
  let fulfillmentIdempotencyRepo: InMemoryFulfillmentIdempotencyRepository;

  let authService: AuthorizationService;
  let catalogService: CatalogService;
  let inventoryService: InventoryService;
  let orderService: OrderService;
  let paymentService: PaymentService;
  let fulfillmentService: FulfillmentService;
  let tipzyAdapter: TipzyPaymentProviderAdapter;
  let mockFulfillmentAdapter: MockFulfillmentProviderAdapter;
  let logger: StructuredLogger;

  const storeId = 'store_tipzy_tenant_01';
  const customerId = 'cust_tipzy_buyer_01';
  const tipzyCallbackSecret = 'secret_callback_tipzy_test_hmac_2026';

  beforeAll(async () => {
    logger = new StructuredLogger({ requestId: 'tipzy-e2e-test' });
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

    tipzyAdapter = new TipzyPaymentProviderAdapter({
      apiKey: 'tipzy_test_key_123',
      merchantCode: 'MERCHANT_BT_TEST',
      callbackSecret: tipzyCallbackSecret,
      // Keep E2E deterministic and prevent real charge requests to Tipzy.
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            success: true,
            result: {
              transaction_id: `tx_tipzy_mock_${Date.now()}`,
              payment_url: 'https://tipzy.example.test/checkout/mock',
              status: 'pending',
              amount: 45000,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    });

    paymentService = new PaymentService({
      accountRepository: paymentAccountRepo,
      intentRepository: paymentIntentRepo,
      attemptRepository: paymentAttemptRepo,
      eventRepository: paymentEventRepo,
      refundRepository: refundRepo,
      idempotencyRepository: paymentIdempotencyRepo,
      authorizationService: authService,
      orderService,
      adapters: [tipzyAdapter],
    });

    mockFulfillmentAdapter = new MockFulfillmentProviderAdapter('DIGITAL_AUTO');
    fulfillmentService = new FulfillmentService({
      fulfillmentRepository: fulfillmentRepo,
      fulfillmentItemRepository: fulfillmentItemRepo,
      idempotencyRepository: fulfillmentIdempotencyRepo,
      authorizationService: authService,
      orderService,
      inventoryService,
      providers: [mockFulfillmentAdapter],
    });

    // Seed Active Store
    const now = new Date().toISOString();
    storeRepo.setStore({
      id: storeId,
      name: 'Bintang Digital Official',
      slug: 'bintang-digital',
      ownerUserId: 'seller_nuruz_01',
      templateVersionId: null,
      status: 'ACTIVE',
      currency: 'IDR',
      settings: {},
      createdAt: now,
      updatedAt: now,
    });

    // Seed Payment Account for TIPZY
    await paymentAccountRepo.create(storeId, {
      id: 'acc_tipzy_01',
      storeId,
      provider: 'TIPZY',
      displayName: 'Tipzy QRIS Integration',
      credentialReference: 'tipzy_default_creds',
      status: 'ACTIVE',
      capabilities: ['QRIS', 'WEBHOOK'],
      configuration: {},
      createdAt: now,
      updatedAt: now,
    });

    // Seed Category & Product
    const category = {
      id: 'cat_dig_01',
      storeId,
      name: 'Subscription Digital',
      slug: 'subscription-digital',
      description: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };
    await categoryRepo.create(storeId, category);

    const product = {
      id: 'prod_spotify_3m',
      storeId,
      categoryId: category.id,
      name: 'Spotify Premium 3 Bulan',
      slug: 'spotify-premium-3-bulan',
      description: 'Official Spotify family key',
      productType: 'DIGITAL',
      price: 45000,
      compareAtPrice: 90000,
      stockMode: 'MANAGED',
      status: 'ACTIVE',
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };
    await productRepo.create(storeId, product);

    const sellerContext = {
      storeId,
      userId: 'seller_nuruz_01',
      membershipId: 'mem_seller_01',
      role: 'STORE_OWNER' as const,
    };

    await inventoryService.adjustStock(sellerContext, product.id, {
      type: 'INCREASE',
      quantity: 10,
      reason: 'Initial stock deposit for Tipzy E2E',
    });

    // Seed Customer
    await customerRepo.create(storeId, {
      id: customerId,
      storeId,
      name: 'Bintang Tech Customer',
      email: 'buyer@bintang.store',
      phone: '085797520135',
      telegramId: null,
      whatsappNumber: '085797520135',
      totalOrders: 0,
      totalSpent: '0.00',
      lastOrderAt: null,
      createdAt: now,
      updatedAt: now,
    });

    // Start Server
    serverInstance = createApiServer({
      port: 0,
      host: '127.0.0.1',
      demoEnabled: true,
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
    const addr = serverInstance.server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await serverInstance.stop();
  });

  it('1. POST /api/v1/tipzy/create-qris generates a QRIS transaction with reference code', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tipzy/create-qris`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 45000,
        customerName: 'Nuruzz Buyer',
        customerPhone: '085797520135',
        orderId: 'ORD-TEST-001',
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { providerReference: string; status: string; paymentUrl: string | null };
    };
    expect(body.success).toBe(true);
    expect(body.data.providerReference).toMatch(/^SIM-/);
    expect(body.data.status).toBe('PENDING');
    expect(body.data.paymentUrl).toBeNull();
  });

  it('2. E2E Checkout Flow: Customer Order -> Stock Reservation -> Tipzy Webhook -> PAID -> Auto-Fulfillment', async () => {
    const product = (await productRepo.findBySlug(storeId, 'spotify-premium-3-bulan'))!;

    // Step A: Create Order as Customer
    const customerCallerHeader = {
      'x-customer-id': customerId,
      'Content-Type': 'application/json',
    };

    const orderRes = await fetch(`${baseUrl}/api/v1/stores/${storeId}/orders`, {
      method: 'POST',
      headers: customerCallerHeader,
      body: JSON.stringify({
        items: [{ productId: product.id, quantity: 1 }],
        paymentMethod: 'QRIS',
        customer: {
          name: 'Bintang Tech Customer',
          email: 'buyer@bintang.store',
          phone: '085797520135',
        },
      }),
    });

    expect(orderRes.status).toBe(201);
    const orderBody = (await orderRes.json()) as {
      data: { id: string; status: string; grandTotal: string };
    };
    const orderId = orderBody.data.id;
    expect(orderBody.data.status).toBe('PENDING_PAYMENT');
    expect(orderBody.data.grandTotal).toBe('45000.00');

    // Step B: Initiate Payment Intent for Tipzy
    const paymentRes = await fetch(
      `${baseUrl}/api/v1/stores/${storeId}/orders/${orderId}/payments`,
      {
        method: 'POST',
        headers: customerCallerHeader,
        body: JSON.stringify({
          provider: 'TIPZY',
          amount: '45000.00',
          currency: 'IDR',
        }),
      },
    );

    expect(paymentRes.status).toBe(201);
    const paymentBody = (await paymentRes.json()) as {
      data: {
        paymentIntentId: string;
        paymentAttemptId: string;
        status: string;
        provider: string;
      };
    };
    expect(paymentBody.data.provider).toBe('TIPZY');
    expect(paymentBody.data.status).toBe('PENDING');

    const paymentIntentId = paymentBody.data.paymentIntentId;

    // Step C: Simulate Tipzy Payment Webhook Callback
    const webhookPayload = {
      event_id: `evt_tipzy_live_${Date.now()}`,
      event_type: 'payment.settled',
      transaction_id: `tx_tipzy_ref_${Date.now()}`,
      payment_intent_id: paymentIntentId,
      store_id: storeId,
      amount: '45000.00',
      currency: 'IDR',
      status: 'PAID',
    };

    const rawBody = JSON.stringify(webhookPayload);
    const validSignature = createHmac('sha256', tipzyCallbackSecret).update(rawBody).digest('hex');

    const webhookRes = await fetch(`${baseUrl}/api/v1/webhooks/payments/TIPZY`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tipzy-signature': validSignature,
        'x-event-id': webhookPayload.event_id,
      },
      body: rawBody,
    });

    expect(webhookRes.status).toBe(200);
    const webhookData = (await webhookRes.json()) as {
      data: { received: boolean; provider: string; processingStatus: string; isDuplicate: boolean };
    };
    expect(webhookData.data.received).toBe(true);
    expect(webhookData.data.provider).toBe('TIPZY');
    expect(webhookData.data.processingStatus).toBe('PROCESSED');
    expect(webhookData.data.isDuplicate).toBe(false);

    // Step D: Verify Order State Transition to PAID
    const customerToken = 'token_customer_e2e_tipzy';
    (serverInstance.dependencies as unknown as { sessionRepo: unknown }).sessionRepo = {
      findByToken: async (token: string) =>
        token === customerToken
          ? {
              id: 'sess_customer_01',
              sessionType: 'CUSTOMER' as const,
              userId: customerId,
              storeId,
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
              revokedAt: null,
            }
          : null,
    };

    const getOrderRes = await fetch(`${baseUrl}/api/v1/stores/${storeId}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    expect(getOrderRes.status).toBe(200);
    const updatedOrder = (await getOrderRes.json()) as { data: { id: string; status: string } };
    expect(updatedOrder.data.status).toBe('FULFILLED');

    // Step E: Verify Zero-Click Auto-Fulfillment Triggered
    // Seller queries fulfillment items for this order
    const sellerToken = 'token_seller_e2e_tipzy';
    (serverInstance.dependencies as unknown as { sessionRepo: unknown }).sessionRepo = {
      findByToken: async (t: string) =>
        t === sellerToken
          ? {
              id: 'sess_seller_01',
              sessionType: 'SELLER' as const,
              userId: 'seller_nuruz_01',
              storeId,
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
              revokedAt: null,
            }
          : null,
    };
    (serverInstance.dependencies as unknown as { storeMemberRepo: unknown }).storeMemberRepo = {
      findByStoreAndUser: async () => ({
        id: 'mem_seller_01',
        storeId,
        userId: 'seller_nuruz_01',
        role: 'STORE_OWNER',
        status: 'ACTIVE',
      }),
    };

    const fulfillRes = await fetch(
      `${baseUrl}/api/v1/stores/${storeId}/orders/${orderId}/fulfillment`,
      {
        headers: { Authorization: `Bearer ${sellerToken}` },
      },
    );

    expect(fulfillRes.status).toBe(200);
    const fulfillData = (await fulfillRes.json()) as {
      data: Array<{ id: string; status: string; orderId: string }>;
    };
    expect(fulfillData.data.length).toBeGreaterThan(0);
    expect(fulfillData.data[0]?.status).toBe('FULFILLED');
    expect(fulfillData.data[0]?.orderId).toBe(orderId);
  });

  it('3. Security Guard (AC-PAY-02): Forged HMAC signature is strictly rejected with 401 Unauthorized', async () => {
    const product = (await productRepo.findBySlug(storeId, 'spotify-premium-3-bulan'))!;

    const customerCallerHeader = {
      'x-customer-id': customerId,
      'Content-Type': 'application/json',
    };

    const orderRes = await fetch(`${baseUrl}/api/v1/stores/${storeId}/orders`, {
      method: 'POST',
      headers: customerCallerHeader,
      body: JSON.stringify({
        items: [{ productId: product.id, quantity: 1 }],
        paymentMethod: 'QRIS',
        customer: {
          name: 'Bintang Tech Customer',
          email: 'buyer@bintang.store',
          phone: '085797520135',
        },
      }),
    });

    const orderBody = (await orderRes.json()) as { data: { id: string } };
    const orderId = orderBody.data.id;

    const paymentRes = await fetch(
      `${baseUrl}/api/v1/stores/${storeId}/orders/${orderId}/payments`,
      {
        method: 'POST',
        headers: customerCallerHeader,
        body: JSON.stringify({
          provider: 'TIPZY',
          amount: '45000.00',
          currency: 'IDR',
        }),
      },
    );

    const paymentBody = (await paymentRes.json()) as { data: { paymentIntentId: string } };
    const realPaymentIntentId = paymentBody.data.paymentIntentId;

    const forgedPayload = {
      event_id: `evt_forged_${Date.now()}`,
      event_type: 'payment.settled',
      transaction_id: `tx_tampered_${Date.now()}`,
      payment_intent_id: realPaymentIntentId,
      store_id: storeId,
      amount: '45000.00',
      currency: 'IDR',
      status: 'PAID',
    };

    const rawBody = JSON.stringify(forgedPayload);
    const forgedSignature = 'invalid_sha256_deadbeef000011112222333344445555';

    const res = await fetch(`${baseUrl}/api/v1/webhooks/payments/TIPZY`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tipzy-signature': forgedSignature,
        'x-event-id': forgedPayload.event_id,
      },
      body: rawBody,
    });

    expect(res.status).toBe(401);
  });

  it('4. Replay Protection (AC-PAY-01): Replaying identical webhook is idempotent without duplicate execution', async () => {
    const product = (await productRepo.findBySlug(storeId, 'spotify-premium-3-bulan'))!;

    // Create another order & payment intent
    const customerCallerHeader = {
      'x-customer-id': customerId,
      'Content-Type': 'application/json',
    };

    const orderRes = await fetch(`${baseUrl}/api/v1/stores/${storeId}/orders`, {
      method: 'POST',
      headers: customerCallerHeader,
      body: JSON.stringify({
        items: [{ productId: product.id, quantity: 1 }],
        paymentMethod: 'QRIS',
        customer: {
          name: 'Bintang Tech Customer',
          email: 'buyer@bintang.store',
          phone: '085797520135',
        },
      }),
    });

    const orderBody = (await orderRes.json()) as { data: { id: string } };
    const orderId = orderBody.data.id;

    const paymentRes = await fetch(
      `${baseUrl}/api/v1/stores/${storeId}/orders/${orderId}/payments`,
      {
        method: 'POST',
        headers: customerCallerHeader,
        body: JSON.stringify({
          provider: 'TIPZY',
          amount: '45000.00',
          currency: 'IDR',
        }),
      },
    );

    const paymentBody = (await paymentRes.json()) as { data: { paymentIntentId: string } };
    const paymentIntentId = paymentBody.data.paymentIntentId;

    const replayPayload = {
      event_id: `evt_replay_test_${Date.now()}`,
      event_type: 'payment.settled',
      transaction_id: `tx_replay_${Date.now()}`,
      payment_intent_id: paymentIntentId,
      store_id: storeId,
      amount: '45000.00',
      currency: 'IDR',
      status: 'PAID',
    };

    const rawBody = JSON.stringify(replayPayload);
    const validSignature = createHmac('sha256', tipzyCallbackSecret).update(rawBody).digest('hex');

    // First Webhook Delivery
    const firstDelivery = await fetch(`${baseUrl}/api/v1/webhooks/payments/TIPZY`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tipzy-signature': validSignature,
        'x-event-id': replayPayload.event_id,
      },
      body: rawBody,
    });
    expect(firstDelivery.status).toBe(200);
    const firstBody = (await firstDelivery.json()) as { data: { isDuplicate: boolean } };
    expect(firstBody.data.isDuplicate).toBe(false);

    // Second Webhook Delivery (Identical Replay)
    const secondDelivery = await fetch(`${baseUrl}/api/v1/webhooks/payments/TIPZY`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tipzy-signature': validSignature,
        'x-event-id': replayPayload.event_id,
      },
      body: rawBody,
    });
    expect(secondDelivery.status).toBe(200);
    const secondBody = (await secondDelivery.json()) as { data: { isDuplicate: boolean } };
    expect(secondBody.data.isDuplicate).toBe(true);
  });

  it('5. Multi-Tenant Onboarding: provisions a tenant store after successful Supabase OTP verification', async () => {
    const authResponse = {
      access_token: 'test_access_token',
      refresh_token: 'test_refresh_token',
      user: {
        id: 'usr_new_onboarded_seller_77',
        email: 'seller@example.test',
        user_metadata: {
          full_name: 'Nuruzz Seller',
          store_name: 'Toko Digital Nuruzz',
        },
      },
    };
    const originalFetch = globalThis.fetch;
    const originalAnonKey = process.env['SUPABASE_STAGING_ANON_KEY'];
    process.env['SUPABASE_STAGING_ANON_KEY'] = 'test_anon_key';
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) !== 'https://vaaixneyotrilqfkulqw.supabase.co/auth/v1/verify') {
        return originalFetch(input, init);
      }
      return new Response(JSON.stringify(authResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const response = await fetch(`${baseUrl}/api/v1/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'seller@example.test',
          token: '123456',
          type: 'signup',
        }),
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        data: { store: { id: string; name: string; slug: string; ownerUserId?: string } };
      };
      expect(body.data.store.name).toBe('Toko Digital Nuruzz');
      expect(body.data.store.slug).toBe('toko-digital-nuruzz-usr_ne');

      const storesAfter = await storeRepo.findByOwnerUserId('usr_new_onboarded_seller_77');
      expect(storesAfter).toHaveLength(1);
      expect(body.data.store.id).toBe(storesAfter[0]?.id);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalAnonKey === undefined) delete process.env['SUPABASE_STAGING_ANON_KEY'];
      else process.env['SUPABASE_STAGING_ANON_KEY'] = originalAnonKey;
    }
  });
});

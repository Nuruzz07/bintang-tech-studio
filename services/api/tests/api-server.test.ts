/**
 * Bintang Tech Studio - HTTP API Gateway Integration Suite.
 *
 * SCOPE & BOUNDARIES (READ BEFORE INTERPRETING RESULTS):
 * 1. Scope: Validates real HTTP transport, serialization, routing, input validation,
 *    and cross-tenant isolation on services/api using node:http.
 * 2. Transport: Starts a real local HTTP server listening on an ephemeral TCP port
 *    and sends actual requests over the network via native fetch().
 * 3. Persistence: Uses in-memory repository adapters injected via Dependency Injection.
 *    This test proves HTTP contract correctness and domain orchestration, but is NOT
 *    proof of live PostgreSQL / Supabase network integration.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AddressInfo } from 'node:net';
import { StructuredLogger } from '@bintang/observability';
import {
  Store,
  StoreMember,
  StoreRepository,
  createAuthenticatedStoreContext,
} from '@bintang/tenancy';
import { AppSession, SupabaseDatabase } from '@bintang/database';
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
import { createApiServer, ApiServerInstance } from '../src/index.js';

class TestStoreRepository implements StoreRepository {
  private readonly stores = new Map<string, Store>();

  setStore(store: Store): void {
    this.stores.set(store.id, store);
  }

  async findById(id: string): Promise<Store | null> {
    return this.stores.get(id) ?? null;
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

describe('HTTP API Gateway Integration Suite (Catalog & Orders)', () => {
  let serverInstance: ApiServerInstance;
  let baseUrl: string;

  // In-memory Repositories
  let storeRepo: TestStoreRepository;
  let categoryRepo: InMemoryCategoryRepository;
  let productRepo: InMemoryProductRepository;
  let inventoryRepo: InMemoryInventoryRepository;
  let orderRepo: InMemoryOrderRepository;
  let customerRepo: InMemoryCustomerRepository;
  let idempotencyRepo: InMemoryIdempotencyRepository;

  // Services
  let authService: AuthorizationService;
  let catalogService: CatalogService;
  let inventoryService: InventoryService;
  let orderService: OrderService;
  let logger: StructuredLogger;

  // Shared Identifiers
  const storeAId = 'store_pilot_alpha_01';
  const storeBId = 'store_pilot_beta_99';
  const suspendedStoreId = 'store_suspended_00';

  const categoryAId = 'cat_software_01';
  const productA1Id = 'prod_license_office';
  const productA2Id = 'prod_unlimited_course';
  const productA3DraftId = 'prod_draft_hidden';
  const productA4LimitedId = 'prod_limited_stock_01';
  const productBId = 'prod_beta_item';

  const customerAId = 'cust_alpha_buyer_01';
  const customerBId = 'cust_intruder_99';

  const tokenAlice = 'token_pilot_alice';
  const tokenBob = 'token_intruder_bob';
  const tokenSellerA = 'token_seller_alpha';
  const tokenSellerB = 'token_seller_beta';
  const tokenSellerInactive = 'token_seller_inactive';
  const tokenExpired = 'token_expired_session';

  beforeAll(async () => {
    logger = new StructuredLogger({ requestId: 'test-api-run' });

    // 1. Instantiate Repositories
    storeRepo = new TestStoreRepository();
    categoryRepo = new InMemoryCategoryRepository();
    productRepo = new InMemoryProductRepository();
    inventoryRepo = new InMemoryInventoryRepository();
    orderRepo = new InMemoryOrderRepository();
    customerRepo = new InMemoryCustomerRepository();
    idempotencyRepo = new InMemoryIdempotencyRepository();

    // 2. Instantiate Services
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

    // 3. Seed Fixtures
    // Stores
    const storeA: Store = {
      id: storeAId,
      ownerUserId: 'user_owner_alpha',
      name: 'Bintang Studio Store',
      slug: 'bintang-studio',
      status: 'ACTIVE',
      currency: 'IDR',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const storeB: Store = {
      id: storeBId,
      ownerUserId: 'user_owner_beta',
      name: 'Beta Store',
      slug: 'beta-store',
      status: 'ACTIVE',
      currency: 'IDR',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const suspendedStore: Store = {
      id: suspendedStoreId,
      ownerUserId: 'user_owner_suspended',
      name: 'Suspended Store',
      slug: 'suspended-store',
      status: 'SUSPENDED',
      currency: 'IDR',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storeRepo.setStore(storeA);
    storeRepo.setStore(storeB);
    storeRepo.setStore(suspendedStore);

    // Categories
    const categoryA: Category = {
      id: categoryAId,
      storeId: storeAId,
      name: 'Digital Licenses',
      slug: 'digital-licenses',
      description: 'Software activation keys',
      sortOrder: 1,
      status: 'ACTIVE',
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await categoryRepo.create(storeAId, categoryA);

    // Products in Store A
    const productA1: Product = {
      id: productA1Id,
      storeId: storeAId,
      categoryId: categoryAId,
      name: 'Office Pro License',
      slug: 'office-pro-license',
      description: 'Genuine activation key',
      productType: 'DIGITAL',
      price: '75000.00',
      compareAtPrice: '99000.00',
      stockMode: 'TRACKED',
      status: 'ACTIVE',
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await productRepo.create(storeAId, productA1);

    // Initial stock for product A1: 5 units on hand
    await inventoryRepo.create(storeAId, {
      id: 'inv_item_a1',
      storeId: storeAId,
      productId: productA1Id,
      quantityOnHand: 5,
      quantityReserved: 0,
      updatedAt: new Date().toISOString(),
    });

    const productA2: Product = {
      id: productA2Id,
      storeId: storeAId,
      categoryId: categoryAId,
      name: 'Node.js Masterclass',
      slug: 'nodejs-masterclass',
      description: 'Instant video access',
      productType: 'DIGITAL',
      price: '150000.00',
      compareAtPrice: null,
      stockMode: 'UNLIMITED',
      status: 'ACTIVE',
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await productRepo.create(storeAId, productA2);

    const productA3Draft: Product = {
      id: productA3DraftId,
      storeId: storeAId,
      categoryId: categoryAId,
      name: 'Unpublished Draft',
      slug: 'unpublished-draft',
      description: 'Hidden item',
      productType: 'DIGITAL',
      price: '10000.00',
      compareAtPrice: null,
      stockMode: 'UNLIMITED',
      status: 'DRAFT',
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await productRepo.create(storeAId, productA3Draft);

    // Product with single remaining stock for race condition testing
    const productA4Limited: Product = {
      id: productA4LimitedId,
      storeId: storeAId,
      categoryId: categoryAId,
      name: 'Flash Sale Item',
      slug: 'flash-sale-item',
      description: 'Single stock remaining',
      productType: 'DIGITAL',
      price: '50000.00',
      compareAtPrice: null,
      stockMode: 'TRACKED',
      status: 'ACTIVE',
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await productRepo.create(storeAId, productA4Limited);
    await inventoryService.initializeInventory(
      createAuthenticatedStoreContext({
        storeId: storeAId,
        userId: 'system:init',
        membershipId: 'mem_init',
        role: 'STORE_ADMIN',
      }),
      productA4LimitedId,
      1,
    );

    // Product in Store B
    const productB: Product = {
      id: productBId,
      storeId: storeBId,
      categoryId: null,
      name: 'Foreign Store Product',
      slug: 'foreign-product',
      description: 'Belongs to store B',
      productType: 'DIGITAL',
      price: '25000.00',
      compareAtPrice: null,
      stockMode: 'UNLIMITED',
      status: 'ACTIVE',
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await productRepo.create(storeBId, productB);

    // Customers in Store A
    const customerA: Customer = {
      id: customerAId,
      storeId: storeAId,
      name: 'John Pilot',
      email: 'john@pilot.com',
      phone: '08123456789',
      telegramId: null,
      whatsappNumber: null,
      totalOrders: 0,
      totalSpent: '0.00',
      lastOrderAt: null,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await customerRepo.create(storeAId, customerA);

    const customerB: Customer = {
      id: customerBId,
      storeId: storeAId,
      name: 'Intruder Buyer',
      email: 'intruder@pilot.com',
      phone: '08999999999',
      telegramId: null,
      whatsappNumber: null,
      totalOrders: 0,
      totalSpent: '0.00',
      lastOrderAt: null,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await customerRepo.create(storeAId, customerB);

    // Sessions and Store Members for Authentication/Authorization Testing
    const now = new Date();
    const future = new Date(now.getTime() + 86400 * 1000).toISOString();
    const past = new Date(now.getTime() - 86400 * 1000).toISOString();

    const testSessions = new Map<string, AppSession>([
      [
        tokenAlice,
        {
          id: 'sess_alice',
          sessionType: 'CUSTOMER',
          tokenHash: 'hash_alice',
          sessionToken: tokenAlice,
          userId: customerAId,
          storeId: storeAId,
          activeMembershipId: null,
          role: 'CUSTOMER',
          metadata: {},
          expiresAt: future,
          createdAt: now.toISOString(),
          revokedAt: null,
        },
      ],
      [
        tokenBob,
        {
          id: 'sess_bob',
          sessionType: 'CUSTOMER',
          tokenHash: 'hash_bob',
          sessionToken: tokenBob,
          userId: customerBId,
          storeId: storeAId,
          activeMembershipId: null,
          role: 'CUSTOMER',
          metadata: {},
          expiresAt: future,
          createdAt: now.toISOString(),
          revokedAt: null,
        },
      ],
      [
        tokenSellerA,
        {
          id: 'sess_seller_a',
          sessionType: 'SELLER',
          tokenHash: 'hash_seller_a',
          sessionToken: tokenSellerA,
          userId: 'user_seller_a',
          storeId: storeAId,
          activeMembershipId: 'mem_seller_a',
          role: 'STORE_ADMIN',
          metadata: {},
          expiresAt: future,
          createdAt: now.toISOString(),
          revokedAt: null,
        },
      ],
      [
        tokenSellerB,
        {
          id: 'sess_seller_b',
          sessionType: 'SELLER',
          tokenHash: 'hash_seller_b',
          sessionToken: tokenSellerB,
          userId: 'user_seller_b',
          storeId: storeBId,
          activeMembershipId: 'mem_seller_b',
          role: 'STORE_ADMIN',
          metadata: {},
          expiresAt: future,
          createdAt: now.toISOString(),
          revokedAt: null,
        },
      ],
      [
        tokenSellerInactive,
        {
          id: 'sess_seller_inactive',
          sessionType: 'SELLER',
          tokenHash: 'hash_seller_inactive',
          sessionToken: tokenSellerInactive,
          userId: 'user_seller_inactive',
          storeId: storeAId,
          activeMembershipId: 'mem_seller_inactive',
          role: 'STORE_STAFF',
          metadata: {},
          expiresAt: future,
          createdAt: now.toISOString(),
          revokedAt: null,
        },
      ],
      [
        tokenExpired,
        {
          id: 'sess_expired',
          sessionType: 'CUSTOMER',
          tokenHash: 'hash_expired',
          sessionToken: tokenExpired,
          userId: customerAId,
          storeId: storeAId,
          activeMembershipId: null,
          role: 'CUSTOMER',
          metadata: {},
          expiresAt: past,
          createdAt: past,
          revokedAt: null,
        },
      ],
    ]);

    const testMembers = new Map<string, StoreMember>([
      [
        `${storeAId}:user_seller_a`,
        {
          id: 'mem_seller_a',
          storeId: storeAId,
          userId: 'user_seller_a',
          role: 'STORE_ADMIN',
          status: 'ACTIVE',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ],
      [
        `${storeBId}:user_seller_b`,
        {
          id: 'mem_seller_b',
          storeId: storeBId,
          userId: 'user_seller_b',
          role: 'STORE_ADMIN',
          status: 'ACTIVE',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ],
      [
        `${storeAId}:user_seller_inactive`,
        {
          id: 'mem_seller_inactive',
          storeId: storeAId,
          userId: 'user_seller_inactive',
          role: 'STORE_STAFF',
          status: 'SUSPENDED',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ],
    ]);

    // Mock Database for Dependency Injection
    const mockDb = {
      stores: storeRepo,
      customers: customerRepo,
      products: productRepo,
      categories: categoryRepo,
      inventory: inventoryRepo,
      orders: orderRepo,
      sessions: {
        findByToken: async (tok: string) => testSessions.get(tok) ?? null,
      },
      storeMembers: {
        findByStoreAndUser: async (sId: string, uId: string) =>
          testMembers.get(`${sId}:${uId}`) ?? null,
      },
      async checkHealth() {
        return {
          status: 'pass' as const,
          latencyMs: 8,
          timestamp: new Date().toISOString(),
        };
      },
    } as unknown as SupabaseDatabase;

    // 4. Start HTTP Server on ephemeral port (0)
    serverInstance = createApiServer({
      port: 0,
      host: '127.0.0.1',
      logger,
      dependencies: {
        database: mockDb,
        sessionRepo: {
          findByToken: async (tok: string) => testSessions.get(tok) ?? null,
        },
        storeMemberRepo: {
          findByStoreAndUser: async (sId: string, uId: string) =>
            testMembers.get(`${sId}:${uId}`) ?? null,
        },
        storeRepo,
        customerRepo,
        catalogService,
        inventoryService,
        orderService,
        logger,
      },
    });

    await serverInstance.start();
    const addr = serverInstance.server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    if (serverInstance) {
      await serverInstance.stop();
    }
  });

  // =========================================================================
  // 1. HEALTH ENDPOINT
  // =========================================================================
  describe('GET /api/v1/health', () => {
    it('returns 200 OK with operational health status and requestId', async () => {
      const res = await fetch(`${baseUrl}/api/v1/health`, {
        headers: { 'X-Request-Id': 'req-health-test-01' },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');
      expect(res.headers.get('x-request-id')).toBe('req-health-test-01');

      const body = await res.json();
      expect(body.data.status).toBe('pass');
      expect(body.data.version).toBe('0.1.0');
      expect(body.data.databaseStatus).toBe('pass');
      expect(typeof body.data.latencyMs).toBe('number');
    });
  });

  // =========================================================================
  // 2. CATALOG ENDPOINTS
  // =========================================================================
  describe('Catalog Endpoints', () => {
    it('GET /api/v1/stores/:storeId/products lists active products for valid store', async () => {
      const res = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/products`);

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBe(3); // productA1, productA2, productA4Limited (productA3 is DRAFT)

      const p1 = body.data.find((p: { readonly id: string }) => p.id === productA1Id);
      expect(p1).toBeDefined();
      expect(p1.name).toBe('Office Pro License');
      expect(p1.price).toBe('75000.00');
      expect(p1.stockMode).toBe('TRACKED');
      expect(p1.availableQuantity).toBe(5);
      expect(p1.isAvailable).toBe(true);

      const p2 = body.data.find((p: { readonly id: string }) => p.id === productA2Id);
      expect(p2).toBeDefined();
      expect(p2.stockMode).toBe('UNLIMITED');
      expect(p2.availableQuantity).toBeNull();
      expect(p2.isAvailable).toBe(true);

      // Draft product is strictly excluded from public listing
      const pDraft = body.data.find((p: { readonly id: string }) => p.id === productA3DraftId);
      expect(pDraft).toBeUndefined();
    });

    it('GET /api/v1/stores/:storeId/products returns 404 for non-existent store', async () => {
      const res = await fetch(`${baseUrl}/api/v1/stores/store_ghost_404/products`);

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('GET /api/v1/stores/:storeId/products returns 404 for suspended store', async () => {
      const res = await fetch(`${baseUrl}/api/v1/stores/${suspendedStoreId}/products`);

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('GET /api/v1/stores/:storeId/products/:productId returns product detail with stock', async () => {
      const res = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/products/${productA1Id}`);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe(productA1Id);
      expect(body.data.name).toBe('Office Pro License');
      expect(body.data.price).toBe('75000.00');
      expect(body.data.availableQuantity).toBe(5);
      expect(body.data.isAvailable).toBe(true);
    });

    it('GET /api/v1/stores/:storeId/products/:productId returns 404 for draft product', async () => {
      const res = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/products/${productA3DraftId}`);

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('GET /api/v1/stores/:storeId/products/:productId enforces cross-tenant isolation (404 on store mismatch)', async () => {
      // Product B belongs to Store B, querying it through Store A URL must return 404
      const res = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/products/${productBId}`);

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  // =========================================================================
  // 3. ORDER CREATION (CHECKOUT) ENDPOINTS
  // =========================================================================
  describe('POST /api/v1/stores/:storeId/orders', () => {
    let createdOrderId: string;

    it('creates an authoritative order, calculates server totals, and reserves stock', async () => {
      const payload = {
        customer: {
          id: customerAId,
          name: 'John Pilot',
          email: 'john@pilot.com',
        },
        items: [
          { productId: productA1Id, quantity: 2 }, // 75,000 * 2 = 150,000
          { productId: productA2Id, quantity: 1 }, // 150,000 * 1 = 150,000
        ],
        notes: 'Delivery via email',
      };

      const res = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAlice}`,
          'Idempotency-Key': 'idem_http_checkout_01',
        },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(201);
      const body = await res.json();

      expect(body.data.id).toBeDefined();
      createdOrderId = body.data.id;

      expect(body.data.orderNumber).toBeDefined();
      expect(body.data.status).toBe('PENDING_PAYMENT');
      expect(body.data.subtotal).toBe('300000.00');
      expect(body.data.grandTotal).toBe('300000.00');
      expect(body.data.currency).toBe('IDR');
      expect(body.data.items.length).toBe(2);

      // Verify inventory reservation in store: product A1 had 5, reserved 2, available is now 3
      const prodRes = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/products/${productA1Id}`);
      const prodBody = await prodRes.json();
      expect(prodBody.data.availableQuantity).toBe(3);
    });

    it('allows guest checkout without an explicit customer ID', async () => {
      const payload = {
        customer: {
          name: 'Guest Shopper',
          email: 'guest@pilot.com',
        },
        items: [{ productId: productA2Id, quantity: 1 }],
      };

      const res = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.id).toBeDefined();
      expect(body.data.customerId).toBeDefined();
      expect(body.data.customerId).not.toBe(customerAId);
    });

    it('rejects unauthenticated checkout attempting to spoof explicit customer id with 400 Bad Request', async () => {
      const payload = {
        customer: {
          id: customerAId, // Attempting to bind order to customer A without authentication
          name: 'Anonymous Impersonator',
        },
        items: [{ productId: productA2Id, quantity: 1 }],
      };

      const res = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('BAD_REQUEST');
      expect(body.error.message).toContain('Unauthenticated guest checkout cannot specify an explicit customer id');
    });

    it('rejects authenticated checkout when explicit customer id does not match session with 403 Forbidden', async () => {
      const payload = {
        customer: {
          id: customerAId, // Bob attempting to use Alice's customer ID
          name: 'Bob as Alice',
        },
        items: [{ productId: productA2Id, quantity: 1 }],
      };

      const res = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenBob}`,
        },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('Explicit customer id does not match authenticated customer session');
    });

    it('guarantees idempotency replay when repeating identical checkout', async () => {
      const payload = {
        customer: {
          id: customerAId,
          name: 'John Pilot',
          email: 'john@pilot.com',
        },
        items: [
          { productId: productA1Id, quantity: 2 },
          { productId: productA2Id, quantity: 1 },
        ],
      };

      // Resending with the EXACT same idempotency key and session
      const res = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAlice}`,
          'Idempotency-Key': 'idem_http_checkout_01',
        },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.id).toBe(createdOrderId); // Identical order returned

      // Stock was NOT decremented a second time
      const prodRes = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/products/${productA1Id}`);
      const prodBody = await prodRes.json();
      expect(prodBody.data.availableQuantity).toBe(3);
    });

    it('rejects identical idempotency key with different request payload with 409 Conflict', async () => {
      const conflictingPayload = {
        customer: {
          id: customerAId,
          name: 'John Pilot',
          email: 'john@pilot.com',
        },
        items: [
          { productId: productA1Id, quantity: 1 }, // Changed quantity from 2 to 1
        ],
      };

      const res = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAlice}`,
          'Idempotency-Key': 'idem_http_checkout_01',
        },
        body: JSON.stringify(conflictingPayload),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe('CONFLICT');
      expect(body.error.message).toContain('different request payload');
    });

    it('handles race condition on last remaining stock with concurrent checkouts', async () => {
      // productA4LimitedId has exactly 1 available quantity
      const payload1 = {
        customer: { name: 'Racer One' },
        items: [{ productId: productA4LimitedId, quantity: 1 }],
      };
      const payload2 = {
        customer: { name: 'Racer Two' },
        items: [{ productId: productA4LimitedId, quantity: 1 }],
      };

      const [res1, res2] = await Promise.all([
        fetch(`${baseUrl}/api/v1/stores/${storeAId}/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload1),
        }),
        fetch(`${baseUrl}/api/v1/stores/${storeAId}/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload2),
        }),
      ]);

      const statusCodes = [res1.status, res2.status].sort();
      expect(statusCodes).toEqual([201, 422]);

      // Exactly 1 order was created, and stock is now 0
      const prodRes = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/products/${productA4LimitedId}`);
      const prodBody = await prodRes.json();
      expect(prodBody.data.availableQuantity).toBe(0);
      expect(prodBody.data.isAvailable).toBe(false);
    });

    it('rejects checkout with 422 Unprocessable Entity when inventory is insufficient', async () => {
      const payload = {
        customer: {
          name: 'John Pilot',
        },
        items: [
          { productId: productA1Id, quantity: 10 }, // Only 3 available
        ],
      };

      const res = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('rejects checkout with 400 Bad Request when items array is empty', async () => {
      const payload = {
        customer: { name: 'John Pilot' },
        items: [],
      };

      const res = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('BAD_REQUEST');
    });

    it('rejects checkout with 400 Bad Request when quantity is zero or negative', async () => {
      const payload = {
        customer: { name: 'John Pilot' },
        items: [{ productId: productA1Id, quantity: 0 }],
      };

      const res = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('BAD_REQUEST');
    });
  });

  // =========================================================================
  // 4. ORDER DETAIL & AUTHORIZATION ENDPOINTS
  // =========================================================================
  describe('GET /api/v1/stores/:storeId/orders/:orderId', () => {
    let testOrderId: string;

    beforeAll(async () => {
      // Create a test order for customer A via authenticated customer session
      const createRes = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAlice}`,
        },
        body: JSON.stringify({
          customer: { id: customerAId, name: 'John Pilot' },
          items: [{ productId: productA2Id, quantity: 1 }],
        }),
      });
      const body = await createRes.json();
      testOrderId = body.data.id;
    });

    it('returns sanitized order details when requester is the owning customer (Bearer token)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/orders/${testOrderId}`, {
        headers: {
          Authorization: `Bearer ${tokenAlice}`,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe(testOrderId);
      expect(body.data.status).toBe('PENDING_PAYMENT');
      expect(body.data.grandTotal).toBe('150000.00');
      expect(body.data.items[0].productName).toBe('Node.js Masterclass');
    });

    it('allows seller with active store membership to view order details', async () => {
      const res = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/orders/${testOrderId}`, {
        headers: {
          Authorization: `Bearer ${tokenSellerA}`,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe(testOrderId);
      expect(body.data.status).toBe('PENDING_PAYMENT');
    });

    it('rejects with 401 Unauthorized when requester passes ONLY X-Customer-Id header without Bearer token', async () => {
      const res = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/orders/${testOrderId}`, {
        headers: {
          'X-Customer-Id': customerAId,
        },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toContain('X-Customer-Id header is not a valid authentication proof');
    });

    it('returns 401 Unauthorized when no authentication is provided', async () => {
      const res = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/orders/${testOrderId}`);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 Unauthorized when Bearer token has expired', async () => {
      const res = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/orders/${testOrderId}`, {
        headers: {
          Authorization: `Bearer ${tokenExpired}`,
        },
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toContain('expired');
    });

    it('returns 403 Forbidden when a different customer tries to access the order', async () => {
      const res = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/orders/${testOrderId}`, {
        headers: {
          Authorization: `Bearer ${tokenBob}`, // Intruder customer token
        },
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('returns 403 Forbidden when Customer B attempts to spoof X-Customer-Id matching Alice', async () => {
      const res = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/orders/${testOrderId}`, {
        headers: {
          Authorization: `Bearer ${tokenBob}`, // Bob's valid token
          'X-Customer-Id': customerAId, // Spoofing Alice's customer ID
        },
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('does not match authenticated customer session');
    });

    it('returns 403 Forbidden when Seller of Store B attempts to access Store A order', async () => {
      const res = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/orders/${testOrderId}`, {
        headers: {
          Authorization: `Bearer ${tokenSellerB}`, // Store B seller token
        },
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('belongs to a different store');
    });

    it('returns 403 Forbidden when seller membership is inactive / suspended', async () => {
      const res = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/orders/${testOrderId}`, {
        headers: {
          Authorization: `Bearer ${tokenSellerInactive}`,
        },
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('not an active member');
    });

    it('returns 404 Not Found when seller of store B attempts to access store A order via store B URL', async () => {
      const res = await fetch(`${baseUrl}/api/v1/stores/${storeBId}/orders/${testOrderId}`, {
        headers: {
          Authorization: `Bearer ${tokenSellerB}`,
        },
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns 403 Forbidden when customer of store A calls store B order URL', async () => {
      const res = await fetch(`${baseUrl}/api/v1/stores/${storeBId}/orders/${testOrderId}`, {
        headers: {
          Authorization: `Bearer ${tokenAlice}`,
        },
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('belongs to a different store');
    });
  });

  // =========================================================================
  // 5. CORS PREFLIGHT
  // =========================================================================
  describe('CORS Options Preflight', () => {
    it('handles OPTIONS preflight with 204 No Content and CORS headers', async () => {
      const res = await fetch(`${baseUrl}/api/v1/stores/${storeAId}/orders`, {
        method: 'OPTIONS',
      });

      expect(res.status).toBe(204);
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
      expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    });
  });
});

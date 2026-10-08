/**
 * Bintang Tech Studio — Customer Store Test Harness.
 * Baseline: Milestone M10 Customer Store Migration.
 */

import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import { AuthorizationService, InMemoryEntitlementResolver } from '@bintang/authorization';
import {
  CatalogService,
  InMemoryCategoryRepository,
  InMemoryProductRepository,
} from '@bintang/commerce';
import {
  InventoryService,
  InMemoryInventoryRepository,
  InMemoryInventoryItemRepository,
} from '@bintang/inventory';
import {
  OrderService,
  InMemoryOrderRepository,
  InMemoryCustomerRepository,
  InMemoryIdempotencyRepository as InMemoryOrderIdempotencyRepository,
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

import {
  StoreContextResolver,
  CustomerSessionManager,
  CustomerStoreService,
  seedTemplate01Catalog,
  ResolvedStoreContext,
  CustomerSession,
} from '../src/index.js';

export interface CustomerStoreTestHarness {
  readonly storeId: string;
  readonly otherStoreId: string;
  readonly resolvedStore: ResolvedStoreContext;
  readonly otherResolvedStore: ResolvedStoreContext;
  readonly sellerContext: ReturnType<typeof createAuthenticatedStoreContext>;
  readonly customerSessionA: CustomerSession;
  readonly customerSessionB: CustomerSession;
  readonly customerSessionOtherStore: CustomerSession;
  readonly catalogService: CatalogService;
  readonly inventoryService: InventoryService;
  readonly orderService: OrderService;
  readonly paymentService: PaymentService;
  readonly fulfillmentService: FulfillmentService;
  readonly contextResolver: StoreContextResolver;
  readonly sessionManager: CustomerSessionManager;
  readonly customerStoreService: CustomerStoreService;
}

export async function createCustomerStoreTestHarness(): Promise<CustomerStoreTestHarness> {
  const storeId = '00000000-0000-0000-0000-000000000001';
  const otherStoreId = '00000000-0000-0000-0000-000000000002';

  const sellerContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_merchant_owner',
    membershipId: 'mem_owner_1',
    role: 'STORE_OWNER',
  });

  const now = new Date().toISOString();

  // 1. Authorization
  const authService = new AuthorizationService(new InMemoryEntitlementResolver());

  // 2. Commerce / Catalog (M05)
  const categoryRepo = new InMemoryCategoryRepository();
  const productRepo = new InMemoryProductRepository();
  const catalogService = new CatalogService({
    categoryRepository: categoryRepo,
    productRepository: productRepo,
    authorizationService: authService,
  });

  // 3. Inventory (M06)
  const inventoryRepo = new InMemoryInventoryRepository();
  const inventoryItemRepo = new InMemoryInventoryItemRepository();
  const inventoryService = new InventoryService({
    inventoryRepository: inventoryRepo,
    inventoryItemRepository: inventoryItemRepo,
    productRepository: productRepo,
    authorizationService: authService,
  });

  // 4. Orders (M07)
  const orderRepo = new InMemoryOrderRepository();
  const customerRepo = new InMemoryCustomerRepository();
  const orderIdempotencyRepo = new InMemoryOrderIdempotencyRepository();
  const orderService = new OrderService({
    orderRepository: orderRepo,
    customerRepository: customerRepo,
    productRepository: productRepo,
    inventoryService,
    authorizationService: authService,
    idempotencyRepository: orderIdempotencyRepo,
  });

  // Register initial customers
  const custA: Customer = {
    id: 'cust_alice_101',
    storeId,
    name: 'Alice Customer',
    email: 'alice@example.com',
    phone: '08123456789',
    telegramId: null,
    whatsappNumber: '08123456789',
    totalOrders: 0,
    totalSpent: '0.00',
    lastOrderAt: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };

  const custB: Customer = {
    id: 'cust_bob_102',
    storeId,
    name: 'Bob Customer',
    email: 'bob@example.com',
    phone: '08198765432',
    telegramId: null,
    whatsappNumber: '08198765432',
    totalOrders: 0,
    totalSpent: '0.00',
    lastOrderAt: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };

  const custOther: Customer = {
    id: 'cust_other_201',
    storeId: otherStoreId,
    name: 'Other Tenant Customer',
    email: 'other@example.com',
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

  await customerRepo.create(custA.storeId, custA);
  await customerRepo.create(custB.storeId, custB);
  await customerRepo.create(custOther.storeId, custOther);

  // 5. Payments (M08)
  const paymentAccountRepo = new InMemoryPaymentAccountRepository();
  const paymentIntentRepo = new InMemoryPaymentIntentRepository();
  const paymentAttemptRepo = new InMemoryPaymentAttemptRepository();
  const paymentEventRepo = new InMemoryPaymentEventRepository();
  const refundRepo = new InMemoryRefundRepository();
  const paymentIdempotencyRepo = new InMemoryPaymentIdempotencyRepository();
  const mockPaymentAdapter = new MockPaymentProviderAdapter('MOCK_PAYMENT');

  const paymentService = new PaymentService({
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

  // Setup default active payment account
  await paymentAccountRepo.create(storeId, {
    id: `acc_${storeId}`,
    storeId,
    provider: 'MOCK_PAYMENT',
    displayName: 'QRIS Bintang Store',
    status: 'ACTIVE',
    currency: 'IDR',
    credentialReference: 'vault://secrets/qris_merchant_test',
    capabilities: ['createPayment', 'verifyPayment', 'webhook', 'refund'],
    configuration: { merchantId: 'MERCHANT_BINTANG_01' },
    createdAt: now,
    updatedAt: now,
  });

  // 6. Fulfillment (M09)
  const fulfillmentRepo = new InMemoryFulfillmentRepository();
  const fulfillmentItemRepo = new InMemoryFulfillmentItemRepository(fulfillmentRepo);
  const fulfillmentIdempotencyRepo = new InMemoryFulfillmentIdempotencyRepository();
  const mockFulfillmentAdapter = new MockFulfillmentProviderAdapter('MOCK_DIGITAL');

  const fulfillmentService = new FulfillmentService({
    fulfillmentRepository: fulfillmentRepo,
    fulfillmentItemRepository: fulfillmentItemRepo,
    idempotencyRepository: fulfillmentIdempotencyRepo,
    authorizationService: authService,
    orderService,
    inventoryService,
    providers: [mockFulfillmentAdapter],
  });

  // 7. Store Context & Session Resolvers
  const contextResolver = new StoreContextResolver(
    [
      {
        storeId,
        storeName: 'Bintang Store',
        tenantSlug: 'bintang-store',
        domain: 'bintanggstore.web.id',
        currency: 'IDR',
      },
      {
        storeId: otherStoreId,
        storeName: 'Other Store',
        tenantSlug: 'other-store',
        domain: 'otherstore.id',
        currency: 'IDR',
      },
    ],
    storeId,
  );

  const sessionManager = new CustomerSessionManager();

  const customerSessionA = sessionManager.createSession({
    storeId,
    customerId: custA.id,
    customerName: custA.name,
    customerEmail: custA.email ?? undefined,
    customerPhone: custA.phone ?? undefined,
  });

  const customerSessionB = sessionManager.createSession({
    storeId,
    customerId: custB.id,
    customerName: custB.name,
    customerEmail: custB.email ?? undefined,
    customerPhone: custB.phone ?? undefined,
  });

  const customerSessionOtherStore = sessionManager.createSession({
    storeId: otherStoreId,
    customerId: custOther.id,
    customerName: custOther.name,
    customerEmail: custOther.email ?? undefined,
  });

  const resolvedStore = contextResolver.resolveStore({ domain: 'bintanggstore.web.id' });
  const otherResolvedStore = contextResolver.resolveStore({ domain: 'otherstore.id' });

  // 8. Seed Template 01 Catalog into storeId
  const storeCtx = contextResolver.toStoreContext(resolvedStore);
  await seedTemplate01Catalog(storeCtx, catalogService, inventoryService);

  // 9. Customer Store Application Service
  const customerStoreService = new CustomerStoreService({
    storeContextResolver: contextResolver,
    customerSessionManager: sessionManager,
    catalogService,
    orderService,
    paymentService,
    fulfillmentService,
    inventoryService,
  });

  return {
    storeId,
    otherStoreId,
    resolvedStore,
    otherResolvedStore,
    sellerContext,
    customerSessionA,
    customerSessionB,
    customerSessionOtherStore,
    catalogService,
    inventoryService,
    orderService,
    paymentService,
    fulfillmentService,
    contextResolver,
    sessionManager,
    customerStoreService,
  };
}

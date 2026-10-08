/**
 * Bintang Tech Studio — Telegram Engine Test Harness.
 * Baseline: Milestone M11 Telegram Engine.
 */

import { StoreMember } from '@bintang/tenancy';
import { AuthorizationService, InMemoryEntitlementResolver } from '@bintang/authorization';
import {
  CatalogService,
  InMemoryCategoryRepository,
  InMemoryProductRepository,
  Product,
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
  InMemoryIdempotencyRepository,
  Order,
  Customer,
} from '@bintang/orders';
import {
  FulfillmentService,
  InMemoryFulfillmentRepository,
  InMemoryFulfillmentItemRepository,
  InMemoryFulfillmentIdempotencyRepository,
  MockFulfillmentProviderAdapter,
  PublicFulfillment,
} from '@bintang/fulfillment';

import {
  MockTelegramAdapter,
  InMemoryTelegramUpdateRepository,
  InMemoryTelegramBotRepository,
  TelegramStoreResolver,
  TelegramCustomerIdentityManager,
  TelegramContextClassifier,
  TelegramMiniAppHelper,
  TelegramOutboundService,
  TelegramCommandRouter,
  TelegramCallbackRouter,
  TelegramEngineService,
  TelegramBotBinding,
} from '../src/index.js';

export interface TelegramTestHarness {
  readonly engineService: TelegramEngineService;
  readonly adapter: MockTelegramAdapter;
  readonly botRepo: InMemoryTelegramBotRepository;
  readonly updateRepo: InMemoryTelegramUpdateRepository;
  readonly storeResolver: TelegramStoreResolver;
  readonly customerIdentityManager: TelegramCustomerIdentityManager;
  readonly contextClassifier: TelegramContextClassifier;
  readonly commandRouter: TelegramCommandRouter;
  readonly callbackRouter: TelegramCallbackRouter;
  readonly outbound: TelegramOutboundService;
  readonly miniAppHelper: TelegramMiniAppHelper;
  // Domain services
  readonly catalogService: CatalogService;
  readonly orderService: OrderService;
  readonly fulfillmentService: FulfillmentService;
  readonly authService: AuthorizationService;
  readonly customerRepo: InMemoryCustomerRepository;
  readonly productRepo: InMemoryProductRepository;
  // Pre-configured entities
  readonly storeIdA: string;
  readonly storeIdB: string;
  readonly botIdA: string;
  readonly botIdB: string;
  readonly botIdDisabled: string;
  readonly productA1: Product;
  readonly productA2: Product;
  readonly productB1: Product;
  readonly customerAlice: Customer;
  readonly customerBob: Customer;
  readonly customerCharlie: Customer;
  readonly orderA1: Order;
  readonly orderA2: Order;
  readonly orderB1: Order;
  readonly fulfillmentA1: PublicFulfillment;
  readonly sellerAlice: StoreMember;
}

export async function createTelegramTestHarness(): Promise<TelegramTestHarness> {
  const storeIdA = 'str_bintang_01';
  const storeIdB = 'str_other_tenant_02';

  const botIdA = 'bot_bintang_101';
  const botIdB = 'bot_other_202';
  const botIdDisabled = 'bot_disabled_303';

  const now = new Date().toISOString();

  // 1. Authorization (M04)
  const authService = new AuthorizationService(new InMemoryEntitlementResolver());

  // 2. Commerce / Catalog (M05)
  const categoryRepo = new InMemoryCategoryRepository();
  const productRepo = new InMemoryProductRepository();
  const catalogService = new CatalogService({
    categoryRepository: categoryRepo,
    productRepository: productRepo,
    authorizationService: authService,
  });

  // Seed categories
  await categoryRepo.create(storeIdA, {
    id: 'cat_streaming_a',
    storeId: storeIdA,
    name: 'Streaming',
    slug: 'streaming',
    description: 'Akun premium streaming',
    sortOrder: 1,
    createdAt: now,
    updatedAt: now,
  });

  // Seed products
  const productA1: Product = {
    id: 'prod_spotify_a1',
    storeId: storeIdA,
    categoryId: 'cat_streaming_a',
    name: 'Spotify Premium 1 Bulan',
    slug: 'spotify-premium',
    description: 'Garansi resmi anti-hold',
    price: '19000.00',
    compareAtPrice: '55000.00',
    costPrice: '10000.00',
    sku: 'SPOT-1M',
    barcode: null,
    status: 'ACTIVE',
    sortOrder: 1,
    images: [],
    metadata: { duration: '1 Bulan' },
    createdAt: now,
    updatedAt: now,
  };

  const productA2: Product = {
    id: 'prod_netflix_a2',
    storeId: storeIdA,
    categoryId: 'cat_streaming_a',
    name: 'Netflix 4K UHD 1 Bulan',
    slug: 'netflix-4k',
    description: 'Profil privat 4K Ultra HD',
    price: '35000.00',
    compareAtPrice: '65000.00',
    costPrice: '20000.00',
    sku: 'NFLX-1M',
    barcode: null,
    status: 'ACTIVE',
    sortOrder: 2,
    images: [],
    metadata: { duration: '1 Bulan' },
    createdAt: now,
    updatedAt: now,
  };

  const productB1: Product = {
    id: 'prod_storeb_b1',
    storeId: storeIdB,
    categoryId: null,
    name: 'Store B Exclusive Product',
    slug: 'store-b-prod',
    description: 'Barang khusus toko B',
    price: '99000.00',
    compareAtPrice: null,
    costPrice: '50000.00',
    sku: 'B-PROD',
    barcode: null,
    status: 'ACTIVE',
    sortOrder: 1,
    images: [],
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };

  await productRepo.create(storeIdA, productA1);
  await productRepo.create(storeIdA, productA2);
  await productRepo.create(storeIdB, productB1);

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
  const orderIdempotencyRepo = new InMemoryIdempotencyRepository();
  const orderService = new OrderService({
    orderRepository: orderRepo,
    customerRepository: customerRepo,
    productRepository: productRepo,
    inventoryService,
    authorizationService: authService,
    idempotencyRepository: orderIdempotencyRepo,
  });

  // Seed Customers
  const customerAlice: Customer = {
    id: 'cust_alice_01',
    storeId: storeIdA,
    name: 'Alice Wonder',
    email: 'alice@example.com',
    phone: null,
    telegramId: 'tg_user_alice',
    whatsappNumber: null,
    totalOrders: 1,
    totalSpent: '19000.00',
    lastOrderAt: now,
    metadata: { telegramUsername: 'alice_wonder' },
    createdAt: now,
    updatedAt: now,
  };

  const customerBob: Customer = {
    id: 'cust_bob_02',
    storeId: storeIdA,
    name: 'Bob Builder',
    email: 'bob@example.com',
    phone: null,
    telegramId: 'tg_user_bob',
    whatsappNumber: null,
    totalOrders: 1,
    totalSpent: '35000.00',
    lastOrderAt: now,
    metadata: { telegramUsername: 'bob_builder' },
    createdAt: now,
    updatedAt: now,
  };

  const customerCharlie: Customer = {
    id: 'cust_charlie_03',
    storeId: storeIdB,
    name: 'Charlie Tenant B',
    email: 'charlie@example.com',
    phone: null,
    telegramId: 'tg_user_alice', // Same telegram ID, DIFFERENT store!
    whatsappNumber: null,
    totalOrders: 1,
    totalSpent: '99000.00',
    lastOrderAt: now,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };

  await customerRepo.create(storeIdA, customerAlice);
  await customerRepo.create(storeIdA, customerBob);
  await customerRepo.create(storeIdB, customerCharlie);

  // Seed Orders
  const orderA1: Order = {
    id: 'ord_alice_101',
    storeId: storeIdA,
    customerId: customerAlice.id,
    orderNumber: 'ORD-1001',
    status: 'PAID',
    subtotal: '19000.00',
    discountTotal: '0.00',
    grandTotal: '19000.00',
    currency: 'IDR',
    voucherId: null,
    fulfillmentStatus: 'FULFILLED',
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };

  const orderA2: Order = {
    id: 'ord_bob_102',
    storeId: storeIdA,
    customerId: customerBob.id,
    orderNumber: 'ORD-1002',
    status: 'PENDING_PAYMENT',
    subtotal: '35000.00',
    discountTotal: '0.00',
    grandTotal: '35000.00',
    currency: 'IDR',
    voucherId: null,
    fulfillmentStatus: 'UNFULFILLED',
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };

  const orderB1: Order = {
    id: 'ord_charlie_201',
    storeId: storeIdB,
    customerId: customerCharlie.id,
    orderNumber: 'ORD-2001',
    status: 'PAID',
    subtotal: '99000.00',
    discountTotal: '0.00',
    grandTotal: '99000.00',
    currency: 'IDR',
    voucherId: null,
    fulfillmentStatus: 'FULFILLED',
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };

  await orderRepo.create(storeIdA, orderA1, []);
  await orderRepo.create(storeIdA, orderA2, []);
  await orderRepo.create(storeIdB, orderB1, []);

  // 5. Fulfillment (M09)
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

  const fulfillmentA1: PublicFulfillment = {
    id: 'ful_101',
    orderId: orderA1.id,
    status: 'FULFILLED',
    strategy: 'DIGITAL_AUTO',
    trackingInfo: 'Dikirim instan ke akun Telegram',
    items: [
      {
        id: 'ful_item_1',
        orderItemId: 'item_1',
        itemType: 'DIGITAL_CREDENTIAL',
        status: 'DELIVERED',
        payloadReference: 'ref_token_xyz98214',
      },
    ],
  };

  await fulfillmentRepo.create(
    storeIdA,
    {
      id: fulfillmentA1.id,
      storeId: storeIdA,
      orderId: orderA1.id,
      status: 'FULFILLED',
      strategy: 'DIGITAL_AUTO',
      trackingInfo: fulfillmentA1.trackingInfo,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    },
    [
      {
        id: 'ful_item_1',
        storeId: storeIdA,
        fulfillmentId: fulfillmentA1.id,
        orderItemId: 'item_1',
        itemType: 'DIGITAL_CREDENTIAL',
        inventoryItemId: 'inv_item_1',
        status: 'DELIVERED',
        payloadReference: 'ref_token_xyz98214',
        failureReason: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
  );

  // 6. Telegram Engine (M11) Components
  const adapter = new MockTelegramAdapter();
  const botRepo = new InMemoryTelegramBotRepository();
  const updateRepo = new InMemoryTelegramUpdateRepository();

  // Seed Bot Bindings
  const botBindingA: TelegramBotBinding = {
    id: 'binding_bot_a',
    storeId: storeIdA,
    telegramBotId: botIdA,
    username: 'bintang_store_bot',
    displayName: 'Bintang Store',
    status: 'ACTIVE',
    credentialReference: 'vault://secrets/bot_a_token',
    miniAppUrl: 'https://bintanggstore.web.id',
    createdAt: now,
    updatedAt: now,
  };

  const botBindingB: TelegramBotBinding = {
    id: 'binding_bot_b',
    storeId: storeIdB,
    telegramBotId: botIdB,
    username: 'other_store_bot',
    displayName: 'Other Tenant Store',
    status: 'ACTIVE',
    credentialReference: 'vault://secrets/bot_b_token',
    miniAppUrl: 'https://otherstore.id',
    createdAt: now,
    updatedAt: now,
  };

  const botBindingDisabled: TelegramBotBinding = {
    id: 'binding_bot_disabled',
    storeId: storeIdA,
    telegramBotId: botIdDisabled,
    username: 'disabled_bot',
    displayName: 'Disabled Bot',
    status: 'DISABLED',
    credentialReference: 'vault://secrets/bot_disabled_token',
    createdAt: now,
    updatedAt: now,
  };

  await botRepo.create(botBindingA);
  await botRepo.create(botBindingB);
  await botRepo.create(botBindingDisabled);

  // Resolvers & Managers
  const storeResolver = new TelegramStoreResolver(botRepo);
  const customerIdentityManager = new TelegramCustomerIdentityManager(customerRepo);
  const contextClassifier = new TelegramContextClassifier(customerIdentityManager);

  // Seed Seller
  const sellerAlice: StoreMember = {
    id: 'mem_seller_alice',
    storeId: storeIdA,
    userId: 'usr_seller_alice',
    role: 'STORE_OWNER',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  contextClassifier.registerSellerMapping({
    storeId: storeIdA,
    telegramUserId: 'tg_user_seller_alice',
    userId: sellerAlice.userId,
    member: sellerAlice,
    tenantSlug: 'bintang-store',
  });

  const miniAppHelper = new TelegramMiniAppHelper();
  const outbound = new TelegramOutboundService(miniAppHelper);

  const commandRouter = new TelegramCommandRouter({
    adapter,
    outbound,
    catalogService,
    orderService,
    fulfillmentService,
    authorizationService: authService,
  });

  const callbackRouter = new TelegramCallbackRouter({
    adapter,
    outbound,
    catalogService,
    orderService,
    fulfillmentService,
  });

  const engineService = new TelegramEngineService({
    adapter,
    updateRepository: updateRepo,
    storeResolver,
    contextClassifier,
    commandRouter,
    callbackRouter,
    outbound,
  });

  return {
    engineService,
    adapter,
    botRepo,
    updateRepo,
    storeResolver,
    customerIdentityManager,
    contextClassifier,
    commandRouter,
    callbackRouter,
    outbound,
    miniAppHelper,
    catalogService,
    orderService,
    fulfillmentService,
    authService,
    customerRepo,
    productRepo,
    storeIdA,
    storeIdB,
    botIdA,
    botIdB,
    botIdDisabled,
    productA1,
    productA2,
    productB1,
    customerAlice,
    customerBob,
    customerCharlie,
    orderA1,
    orderA2,
    orderB1,
    fulfillmentA1,
    sellerAlice,
  };
}

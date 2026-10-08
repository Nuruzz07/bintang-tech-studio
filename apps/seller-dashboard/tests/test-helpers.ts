/**
 * Bintang Tech Studio — Seller Dashboard Test Harness.
 * Baseline: Milestone M12 Seller Dashboard Foundation.
 */

import {
  Store,
  StoreMember,
  InMemoryStoreRepository,
  InMemoryStoreMemberRepository,
} from '@bintang/tenancy';
import {
  AuthorizationService,
  InMemoryEntitlementResolver,
  STANDARD_ENTITLEMENT_KEYS,
} from '@bintang/authorization';
import {
  CatalogService,
  InMemoryCategoryRepository,
  InMemoryProductRepository,
  Product,
  Category,
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
  PaymentService,
  InMemoryPaymentAccountRepository,
  InMemoryPaymentIntentRepository,
  InMemoryPaymentAttemptRepository,
  InMemoryPaymentEventRepository,
  InMemoryRefundRepository,
  PaymentAccount,
} from '@bintang/payments';
import {
  FulfillmentService,
  InMemoryFulfillmentRepository,
  InMemoryFulfillmentItemRepository,
  InMemoryFulfillmentIdempotencyRepository,
} from '@bintang/fulfillment';
import { TelegramBotBinding, InMemoryTelegramBotRepository } from '@bintang/telegram';

import { SellerUser, SellerSession, Voucher } from '../src/types.js';
import { InMemoryVoucherRepository } from '../src/voucher-repository.js';
import { SellerSessionManager } from '../src/session-manager.js';
import { SellerDashboardService } from '../src/seller-dashboard-service.js';

export interface SellerDashboardTestHarness {
  readonly dashboardService: SellerDashboardService;
  readonly sessionManager: SellerSessionManager;
  readonly authService: AuthorizationService;
  readonly entitlementResolver: InMemoryEntitlementResolver;
  readonly catalogService: CatalogService;
  readonly inventoryService: InventoryService;
  readonly orderService: OrderService;
  readonly paymentService: PaymentService;
  readonly fulfillmentService: FulfillmentService;

  // Repositories
  readonly storeRepo: InMemoryStoreRepository;
  readonly memberRepo: InMemoryStoreMemberRepository;
  readonly productRepo: InMemoryProductRepository;
  readonly categoryRepo: InMemoryCategoryRepository;
  readonly inventoryRepo: InMemoryInventoryRepository;
  readonly inventoryItemRepo: InMemoryInventoryItemRepository;
  readonly orderRepo: InMemoryOrderRepository;
  readonly customerRepo: InMemoryCustomerRepository;
  readonly voucherRepo: InMemoryVoucherRepository;
  readonly paymentAccountRepo: InMemoryPaymentAccountRepository;
  readonly telegramBotRepo: InMemoryTelegramBotRepository;
  readonly fulfillmentRepo: InMemoryFulfillmentRepository;

  // Test Fixtures
  readonly storeA: Store;
  readonly storeB: Store;
  readonly storeC: Store; // Suspended
  readonly storeD: Store; // No telegram channels

  readonly userAlice: SellerUser; // Owner in Store A, Staff in Store B
  readonly userBob: SellerUser; // Admin in Store A
  readonly userDan: SellerUser; // Staff in Store A
  readonly userCharlie: SellerUser; // Owner in Store B, Customer in Store A
  readonly userEve: SellerUser; // No memberships
  readonly userInactive: SellerUser;

  readonly memberAliceA: StoreMember;
  readonly memberAliceB: StoreMember;
  readonly memberBobA: StoreMember;
  readonly memberDanA: StoreMember;
  readonly memberCharlieB: StoreMember;

  readonly categoryA1: Category;
  readonly categoryB1: Category;
  readonly productA1: Product;
  readonly productA2: Product;
  readonly productB1: Product;

  readonly customerA1: Customer;
  readonly customerA2: Customer;
  readonly customerB1: Customer;

  readonly orderA1: Order; // PENDING_PAYMENT
  readonly orderA2: Order; // PAID
  readonly orderA3: Order; // CANCELLED
  readonly orderB1: Order; // PAID

  readonly voucherA1: Voucher;
  readonly voucherB1: Voucher;

  readonly paymentAccountA: PaymentAccount;
  readonly botBindingA: TelegramBotBinding;

  // Helpers
  loginAs(user: SellerUser, preferredStoreId?: string): Promise<SellerSession>;
}

export async function createSellerDashboardTestHarness(): Promise<SellerDashboardTestHarness> {
  const now = new Date().toISOString();

  // 1. Tenancy Repositories
  const storeRepo = new InMemoryStoreRepository();
  const memberRepo = new InMemoryStoreMemberRepository();

  // 2. Authorization
  const entitlementResolver = new InMemoryEntitlementResolver();
  const authService = new AuthorizationService(entitlementResolver);

  // 3. Catalog (Commerce)
  const productRepo = new InMemoryProductRepository();
  const categoryRepo = new InMemoryCategoryRepository();
  const catalogService = new CatalogService({
    categoryRepository: categoryRepo,
    productRepository: productRepo,
    authorizationService: authService,
  });

  // 4. Inventory
  const inventoryRepo = new InMemoryInventoryRepository();
  const inventoryItemRepo = new InMemoryInventoryItemRepository();
  const inventoryService = new InventoryService({
    inventoryRepository: inventoryRepo,
    inventoryItemRepository: inventoryItemRepo,
    productRepository: productRepo,
    authorizationService: authService,
  });

  // 5. Orders
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

  // 6. Payments
  const paymentAccountRepo = new InMemoryPaymentAccountRepository();
  const paymentIntentRepo = new InMemoryPaymentIntentRepository();
  const paymentAttemptRepo = new InMemoryPaymentAttemptRepository();
  const paymentEventRepo = new InMemoryPaymentEventRepository();
  const refundRepo = new InMemoryRefundRepository();
  const paymentService = new PaymentService({
    accountRepository: paymentAccountRepo,
    intentRepository: paymentIntentRepo,
    attemptRepository: paymentAttemptRepo,
    eventRepository: paymentEventRepo,
    refundRepository: refundRepo,
    orderService,
    authorizationService: authService,
  });

  // 7. Fulfillment
  const fulfillmentRepo = new InMemoryFulfillmentRepository();
  const fulfillmentItemRepo = new InMemoryFulfillmentItemRepository();
  const fulfillmentIdempotencyRepo = new InMemoryFulfillmentIdempotencyRepository();
  const fulfillmentService = new FulfillmentService({
    fulfillmentRepository: fulfillmentRepo,
    fulfillmentItemRepository: fulfillmentItemRepo,
    orderService,
    authorizationService: authService,
    inventoryService,
    idempotencyRepository: fulfillmentIdempotencyRepo,
  });

  // 8. Channels (Telegram)
  const telegramBotRepo = new InMemoryTelegramBotRepository();

  // 9. Vouchers
  const voucherRepo = new InMemoryVoucherRepository();

  // 10. Session Manager
  const sessionManager = new SellerSessionManager(storeRepo, memberRepo);

  // 11. Central Seller Dashboard Service
  const dashboardService = new SellerDashboardService({
    sessionManager,
    authorizationService: authService,
    entitlementResolver,
    catalogService,
    categoryRepository: categoryRepo,
    productRepository: productRepo,
    inventoryService,
    inventoryRepository: inventoryRepo,
    inventoryItemRepository: inventoryItemRepo,
    orderService,
    orderRepository: orderRepo,
    customerRepository: customerRepo,
    voucherRepository: voucherRepo,
    paymentService,
    paymentAccountRepository: paymentAccountRepo,
    fulfillmentService,
    telegramBotRepository: telegramBotRepo,
    storeRepository: storeRepo,
    storeMemberRepository: memberRepo,
  });

  // ==========================================================================
  // SEED STORES
  // ==========================================================================
  const storeA = await storeRepo.create({
    ownerUserId: 'usr_alice',
    name: 'Toko Bintang Alpha',
    slug: 'bintang-alpha',
    templateVersionId: null,
    status: 'ACTIVE',
    currency: 'IDR',
    settings: {
      description: 'Official Store Alpha',
      contactEmail: 'store@alpha.com',
      contactPhone: '08123456789',
      logoUrl: 'https://cdn.bintang.tech/alpha.png',
    },
  });

  const storeB = await storeRepo.create({
    ownerUserId: 'usr_charlie',
    name: 'Toko Beta Pro',
    slug: 'beta-pro',
    templateVersionId: null,
    status: 'ACTIVE',
    currency: 'IDR',
    settings: {
      description: 'Pro Seller Store',
      contactEmail: 'store@beta.com',
    },
  });

  const storeC = await storeRepo.create({
    ownerUserId: 'usr_alice',
    name: 'Toko Charlie Suspended',
    slug: 'charlie-suspended',
    templateVersionId: null,
    status: 'SUSPENDED',
    currency: 'IDR',
    settings: {},
  });

  const storeD = await storeRepo.create({
    ownerUserId: 'usr_alice',
    name: 'Toko Delta Basic',
    slug: 'delta-basic',
    templateVersionId: null,
    status: 'ACTIVE',
    currency: 'IDR',
    settings: {},
  });

  // ==========================================================================
  // CONFIGURE ENTITLEMENTS
  // ==========================================================================
  // Store A: STARTER (products.max: 20, staff.max: 3, telegram: true, voucher: true)
  entitlementResolver.setStoreConfig(storeA.id, {
    planSlug: 'starter',
    baseEntitlements: {
      [STANDARD_ENTITLEMENT_KEYS.PRODUCTS_MAX]: 20,
      [STANDARD_ENTITLEMENT_KEYS.STAFF_MAX]: 3,
      [STANDARD_ENTITLEMENT_KEYS.CHANNELS_TELEGRAM]: true,
      [STANDARD_ENTITLEMENT_KEYS.FEATURES_VOUCHER]: true,
    },
  });

  // Store B: PRO (products.max: 100, staff.max: 10, telegram: true, voucher: true)
  entitlementResolver.setStoreConfig(storeB.id, {
    planSlug: 'pro',
    baseEntitlements: {
      [STANDARD_ENTITLEMENT_KEYS.PRODUCTS_MAX]: 100,
      [STANDARD_ENTITLEMENT_KEYS.STAFF_MAX]: 10,
      [STANDARD_ENTITLEMENT_KEYS.CHANNELS_TELEGRAM]: true,
      [STANDARD_ENTITLEMENT_KEYS.FEATURES_VOUCHER]: true,
    },
  });

  // Store D: BASIC (telegram: false, voucher: false)
  entitlementResolver.setStoreConfig(storeD.id, {
    planSlug: 'basic',
    baseEntitlements: {
      [STANDARD_ENTITLEMENT_KEYS.PRODUCTS_MAX]: 10,
      [STANDARD_ENTITLEMENT_KEYS.STAFF_MAX]: 2,
      [STANDARD_ENTITLEMENT_KEYS.CHANNELS_TELEGRAM]: false,
      [STANDARD_ENTITLEMENT_KEYS.FEATURES_VOUCHER]: false,
    },
  });

  // ==========================================================================
  // SEED USERS & MEMBERSHIPS
  // ==========================================================================
  const userAlice: SellerUser = {
    id: 'usr_alice',
    email: 'alice@bintang.com',
    name: 'Alice Owner',
    isActive: true,
  };

  const userBob: SellerUser = {
    id: 'usr_bob',
    email: 'bob@bintang.com',
    name: 'Bob Admin',
    isActive: true,
  };

  const userDan: SellerUser = {
    id: 'usr_dan',
    email: 'dan@bintang.com',
    name: 'Dan Staff',
    isActive: true,
  };

  const userCharlie: SellerUser = {
    id: 'usr_charlie',
    email: 'charlie@other.com',
    name: 'Charlie Owner B',
    isActive: true,
  };

  const userEve: SellerUser = {
    id: 'usr_eve',
    email: 'eve@stranger.com',
    name: 'Eve Stranger',
    isActive: true,
  };

  const userInactive: SellerUser = {
    id: 'usr_inactive',
    email: 'inactive@bintang.com',
    name: 'Inactive User',
    isActive: false,
  };

  // Alice is Owner in Store A, Staff in Store B, Owner in Store C, Owner in Store D
  const memberAliceA = await memberRepo.create({
    storeId: storeA.id,
    userId: userAlice.id,
    role: 'STORE_OWNER',
    status: 'ACTIVE',
  });

  const memberAliceB = await memberRepo.create({
    storeId: storeB.id,
    userId: userAlice.id,
    role: 'STORE_STAFF',
    status: 'ACTIVE',
  });

  await memberRepo.create({
    storeId: storeC.id,
    userId: userAlice.id,
    role: 'STORE_OWNER',
    status: 'ACTIVE',
  });

  await memberRepo.create({
    storeId: storeD.id,
    userId: userAlice.id,
    role: 'STORE_OWNER',
    status: 'ACTIVE',
  });

  // Bob is Admin in Store A
  const memberBobA = await memberRepo.create({
    storeId: storeA.id,
    userId: userBob.id,
    role: 'STORE_ADMIN',
    status: 'ACTIVE',
  });

  // Dan is Staff in Store A
  const memberDanA = await memberRepo.create({
    storeId: storeA.id,
    userId: userDan.id,
    role: 'STORE_STAFF',
    status: 'ACTIVE',
  });

  // Charlie is Owner in Store B
  const memberCharlieB = await memberRepo.create({
    storeId: storeB.id,
    userId: userCharlie.id,
    role: 'STORE_OWNER',
    status: 'ACTIVE',
  });

  // ==========================================================================
  // SEED CATEGORIES & PRODUCTS
  // ==========================================================================
  const categoryA1 = await categoryRepo.create(storeA.id, {
    id: 'cat_a1',
    storeId: storeA.id,
    name: 'Voucher Game',
    slug: 'voucher-game',
    description: 'Game credits and passes',
    sortOrder: 1,
    status: 'ACTIVE',
    metadata: {},
    createdAt: now,
    updatedAt: now,
  });

  const categoryB1 = await categoryRepo.create(storeB.id, {
    id: 'cat_b1',
    storeId: storeB.id,
    name: 'Software Tools',
    slug: 'software-tools',
    description: 'Developer tools',
    sortOrder: 1,
    status: 'ACTIVE',
    metadata: {},
    createdAt: now,
    updatedAt: now,
  });

  const productA1 = await productRepo.create(storeA.id, {
    id: 'prod_a1',
    storeId: storeA.id,
    categoryId: categoryA1.id,
    name: 'Mobile Legends 100 Diamonds',
    slug: 'ml-100-diamonds',
    description: 'Topup cepat langsung masuk',
    productType: 'DIGITAL_CREDENTIAL',
    price: '25000.00',
    compareAtPrice: '30000.00',
    stockMode: 'TRACKED',
    status: 'ACTIVE',
    metadata: {},
    createdAt: now,
    updatedAt: now,
  });

  const productA2 = await productRepo.create(storeA.id, {
    id: 'prod_a2',
    storeId: storeA.id,
    categoryId: categoryA1.id,
    name: 'Spotify Premium 1 Bulan',
    slug: 'spotify-1-month',
    description: 'Akun premium garansi 30 hari',
    productType: 'DIGITAL_CREDENTIAL',
    price: '35000.00',
    compareAtPrice: null,
    stockMode: 'TRACKED',
    status: 'ACTIVE',
    metadata: {},
    createdAt: now,
    updatedAt: now,
  });

  const productB1 = await productRepo.create(storeB.id, {
    id: 'prod_b1',
    storeId: storeB.id,
    categoryId: categoryB1.id,
    name: 'Bintang VPN 1 Year',
    slug: 'bintang-vpn-1y',
    description: 'High speed VPN account',
    productType: 'DIGITAL_CREDENTIAL',
    price: '150000.00',
    compareAtPrice: null,
    stockMode: 'TRACKED',
    status: 'ACTIVE',
    metadata: {},
    createdAt: now,
    updatedAt: now,
  });

  // ==========================================================================
  // SEED INVENTORY
  // ==========================================================================
  await inventoryRepo.create(storeA.id, {
    id: 'inv_a1',
    storeId: storeA.id,
    productId: productA1.id,
    stockMode: 'TRACKED',
    quantityOnHand: 10,
    quantityReserved: 1,
    lowStockThreshold: 5,
    version: 1,
    createdAt: now,
    updatedAt: now,
  });

  await inventoryRepo.create(storeA.id, {
    id: 'inv_a2',
    storeId: storeA.id,
    productId: productA2.id,
    stockMode: 'TRACKED',
    quantityOnHand: 3, // Low stock!
    quantityReserved: 0,
    lowStockThreshold: 5,
    version: 1,
    createdAt: now,
    updatedAt: now,
  });

  await inventoryRepo.create(storeB.id, {
    id: 'inv_b1',
    storeId: storeB.id,
    productId: productB1.id,
    stockMode: 'TRACKED',
    quantityOnHand: 50,
    quantityReserved: 2,
    lowStockThreshold: 10,
    version: 1,
    createdAt: now,
    updatedAt: now,
  });

  // Digital credential items for productA1 (secrets that MUST never be leaked)
  await inventoryItemRepo.create(storeA.id, {
    id: 'item_a1_1',
    storeId: storeA.id,
    productId: productA1.id,
    status: 'AVAILABLE',
    credentialPayload: { secretKey: 'ML-KEY-ALPHA-001', pin: '9988' },
    encryptedPayload: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  });

  await inventoryItemRepo.create(storeA.id, {
    id: 'item_a1_2',
    storeId: storeA.id,
    productId: productA1.id,
    status: 'AVAILABLE',
    credentialPayload: { secretKey: 'ML-KEY-ALPHA-002', pin: '9989' },
    encryptedPayload: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  });

  await inventoryItemRepo.create(storeA.id, {
    id: 'item_a1_3',
    storeId: storeA.id,
    productId: productA1.id,
    status: 'RESERVED',
    credentialPayload: { secretKey: 'ML-KEY-ALPHA-003', pin: '9990' },
    encryptedPayload: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  });

  await inventoryItemRepo.create(storeA.id, {
    id: 'item_a1_4',
    storeId: storeA.id,
    productId: productA1.id,
    status: 'ASSIGNED',
    credentialPayload: { secretKey: 'ML-KEY-ALPHA-004', pin: '9991' },
    encryptedPayload: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  });

  // ==========================================================================
  // SEED CUSTOMERS
  // ==========================================================================
  const customerA1 = await customerRepo.create(storeA.id, {
    id: 'cust_a1',
    storeId: storeA.id,
    name: 'Budi Santoso',
    email: 'budi@gmail.com',
    phone: '08129999111',
    telegramId: '12345678',
    whatsappNumber: null,
    totalOrders: 3,
    totalSpent: '125000.00',
    lastOrderAt: now,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  });

  const customerA2 = await customerRepo.create(storeA.id, {
    id: 'cust_a2',
    storeId: storeA.id,
    name: 'Dewi Lestari',
    email: 'dewi@gmail.com',
    phone: '08129999222',
    telegramId: '87654321',
    whatsappNumber: null,
    totalOrders: 1,
    totalSpent: '35000.00',
    lastOrderAt: now,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  });

  const customerB1 = await customerRepo.create(storeB.id, {
    id: 'cust_b1',
    storeId: storeB.id,
    name: 'Eko Pratama',
    email: 'eko@gmail.com',
    phone: '08129999333',
    telegramId: null,
    whatsappNumber: null,
    totalOrders: 2,
    totalSpent: '300000.00',
    lastOrderAt: now,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  });

  // ==========================================================================
  // SEED ORDERS
  // ==========================================================================
  const orderA1 = await orderRepo.create(
    storeA.id,
    {
      id: 'ord_a1',
      storeId: storeA.id,
      customerId: customerA1.id,
      orderNumber: 'ORD-A1-001',
      status: 'PENDING_PAYMENT',
      subtotal: '25000.00',
      discountTotal: '0.00',
      grandTotal: '25000.00',
      currency: 'IDR',
      voucherId: null,
      fulfillmentStatus: 'UNFULFILLED',
      metadata: {},
      createdAt: now,
      updatedAt: now,
    },
    [
      {
        id: 'ord_item_a1_1',
        orderId: 'ord_a1',
        storeId: storeA.id,
        productId: productA1.id,
        productName: productA1.name,
        quantity: 1,
        unitPrice: '25000.00',
        subtotal: '25000.00',
        metadata: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
  );

  const orderA2 = await orderRepo.create(
    storeA.id,
    {
      id: 'ord_a2',
      storeId: storeA.id,
      customerId: customerA2.id,
      orderNumber: 'ORD-A2-002',
      status: 'PAID',
      subtotal: '70000.00',
      discountTotal: '0.00',
      grandTotal: '70000.00',
      currency: 'IDR',
      voucherId: null,
      fulfillmentStatus: 'FULFILLED',
      metadata: {},
      createdAt: now,
      updatedAt: now,
    },
    [
      {
        id: 'ord_item_a2_1',
        orderId: 'ord_a2',
        storeId: storeA.id,
        productId: productA2.id,
        productName: productA2.name,
        quantity: 2,
        unitPrice: '35000.00',
        subtotal: '70000.00',
        metadata: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
  );

  const orderA3 = await orderRepo.create(
    storeA.id,
    {
      id: 'ord_a3',
      storeId: storeA.id,
      customerId: customerA1.id,
      orderNumber: 'ORD-A3-003',
      status: 'CANCELLED',
      subtotal: '25000.00',
      discountTotal: '0.00',
      grandTotal: '25000.00',
      currency: 'IDR',
      voucherId: null,
      fulfillmentStatus: 'UNFULFILLED',
      metadata: {},
      createdAt: now,
      updatedAt: now,
    },
    [
      {
        id: 'ord_item_a3_1',
        orderId: 'ord_a3',
        storeId: storeA.id,
        productId: productA1.id,
        productName: productA1.name,
        quantity: 1,
        unitPrice: '25000.00',
        subtotal: '25000.00',
        metadata: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
  );

  const orderB1 = await orderRepo.create(
    storeB.id,
    {
      id: 'ord_b1',
      storeId: storeB.id,
      customerId: customerB1.id,
      orderNumber: 'ORD-B1-001',
      status: 'PAID',
      subtotal: '150000.00',
      discountTotal: '0.00',
      grandTotal: '150000.00',
      currency: 'IDR',
      voucherId: null,
      fulfillmentStatus: 'FULFILLED',
      metadata: {},
      createdAt: now,
      updatedAt: now,
    },
    [
      {
        id: 'ord_item_b1_1',
        orderId: 'ord_b1',
        storeId: storeB.id,
        productId: productB1.id,
        productName: productB1.name,
        quantity: 1,
        unitPrice: '150000.00',
        subtotal: '150000.00',
        metadata: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
  );

  // ==========================================================================
  // SEED FULFILLMENTS
  // ==========================================================================
  await fulfillmentRepo.create(
    storeA.id,
    {
      id: 'ful_a2',
      storeId: storeA.id,
      orderId: orderA2.id,
      status: 'COMPLETED',
      strategy: 'DIGITAL_CREDENTIAL',
      providerKey: 'bintang_digital_engine',
      failureReason: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    },
    [
      {
        id: 'ful_item_a2_1',
        fulfillmentId: 'ful_a2',
        storeId: storeA.id,
        orderItemId: 'ord_item_a2_1',
        productId: productA2.id,
        inventoryItemId: null,
        status: 'DELIVERED',
        itemType: 'DIGITAL_CREDENTIAL',
        itemPayload: null,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
  );

  await fulfillmentRepo.create(
    storeB.id,
    {
      id: 'ful_b1',
      storeId: storeB.id,
      orderId: orderB1.id,
      status: 'COMPLETED',
      strategy: 'DIGITAL_CREDENTIAL',
      providerKey: 'bintang_digital_engine',
      failureReason: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    },
    [
      {
        id: 'ful_item_b1_1',
        fulfillmentId: 'ful_b1',
        storeId: storeB.id,
        orderItemId: 'ord_item_b1_1',
        productId: productB1.id,
        inventoryItemId: null,
        status: 'DELIVERED',
        itemType: 'DIGITAL_CREDENTIAL',
        itemPayload: null,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
  );

  // ==========================================================================
  // SEED VOUCHERS
  // ==========================================================================
  const voucherA1 = await voucherRepo.create(storeA.id, {
    id: 'vch_a1',
    storeId: storeA.id,
    code: 'DISKON10',
    discountType: 'PERCENTAGE',
    discountValue: '10.00',
    minimumPurchase: '20000.00',
    maximumDiscount: '10000.00',
    usageLimit: 100,
    usedCount: 5,
    status: 'ACTIVE',
    startsAt: now,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
  });

  const voucherB1 = await voucherRepo.create(storeB.id, {
    id: 'vch_b1',
    storeId: storeB.id,
    code: 'PROMO50',
    discountType: 'FIXED',
    discountValue: '50000.00',
    minimumPurchase: '100000.00',
    maximumDiscount: null,
    usageLimit: 50,
    usedCount: 2,
    status: 'ACTIVE',
    startsAt: now,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
  });

  // ==========================================================================
  // SEED PAYMENT ACCOUNT (STORE A)
  // ==========================================================================
  const paymentAccountA = await paymentAccountRepo.create(storeA.id, {
    id: 'pac_a1',
    storeId: storeA.id,
    provider: 'MANUAL_TRANSFER',
    displayName: 'Bank Mandiri Store Alpha',
    accountNumber: '1400012345678',
    accountHolderName: 'PT Bintang Alpha Store',
    qrCodeUrl: 'https://cdn.bintang.tech/qris-alpha.png',
    credentialsPayload: {
      secretApiKey: 'super_secret_pay_key_99999',
      webhookSecret: 'whsec_alpha_private_xyz',
    },
    status: 'ACTIVE',
    isDefault: true,
    metadata: {},
  });

  // ==========================================================================
  // SEED TELEGRAM BOT BINDING (STORE A)
  // ==========================================================================
  const botBindingA = await telegramBotRepo.create({
    id: 'tgb_a1',
    storeId: storeA.id,
    telegramBotId: 'bot_alpha_123',
    username: 'BintangAlphaStoreBot',
    displayName: 'Bintang Alpha Bot',
    status: 'ACTIVE',
    credentialReference: 'secret_cred_ref_never_leaked',
    miniAppUrl: 'https://alpha.store.bintang.tech',
    createdAt: now,
    updatedAt: now,
  });

  return {
    dashboardService,
    sessionManager,
    authService,
    entitlementResolver,
    catalogService,
    inventoryService,
    orderService,
    paymentService,
    fulfillmentService,

    storeRepo,
    memberRepo,
    productRepo,
    categoryRepo,
    inventoryRepo,
    inventoryItemRepo,
    orderRepo,
    customerRepo,
    voucherRepo,
    paymentAccountRepo,
    telegramBotRepo,
    fulfillmentRepo,

    storeA,
    storeB,
    storeC,
    storeD,

    userAlice,
    userBob,
    userDan,
    userCharlie,
    userEve,
    userInactive,

    memberAliceA,
    memberAliceB,
    memberBobA,
    memberDanA,
    memberCharlieB,

    categoryA1,
    categoryB1,
    productA1,
    productA2,
    productB1,

    customerA1,
    customerA2,
    customerB1,

    orderA1,
    orderA2,
    orderA3,
    orderB1,

    voucherA1,
    voucherB1,

    paymentAccountA,
    botBindingA,

    async loginAs(user: SellerUser, preferredStoreId?: string): Promise<SellerSession> {
      return sessionManager.createSession(user, preferredStoreId);
    },
  };
}

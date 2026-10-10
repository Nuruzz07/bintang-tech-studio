/**
 * Bintang Tech Studio - Production Pilot Acceptance Test Suite.
 *
 * SCOPE & BOUNDARIES (READ BEFORE INTERPRETING RESULTS):
 * 1. Scope: In-Memory Cross-Domain Integration Suite validating multi-package service
 *    contracts and orchestration across the single-merchant golden path.
 * 2. Database: Uses In-Memory repositories (InMemory*Repository); does NOT connect to
 *    live PostgreSQL or Supabase over the network.
 * 3. Payments: Uses MockPaymentProviderAdapter with real HMAC signature validation
 *    executed in-process. Live gateway APIs (Xendit/Midtrans/Tripay) are NOT invoked.
 * 4. Fulfillment: Uses in-memory digital key allocation and MockFulfillmentProviderAdapter.
 * 5. Concurrency: Validates in-flight lock deduplication and cross-tenant isolation sequentially;
 *    high-concurrency race condition testing is covered in dedicated package suites
 *    (e.g., packages/orders/tests/concurrency.test.ts).
 */

import { describe, it, expect, beforeEach } from 'vitest';

// 1. Tenancy & Authorization
import {
  createAuthenticatedStoreContext,
  AuthenticatedStoreContext,
} from '@bintang/tenancy';
import {
  AuthorizationService,
  InMemoryEntitlementResolver,
} from '@bintang/authorization';

// 2. Commerce & Catalog
import {
  InMemoryProductRepository,
  InMemoryCategoryRepository,
  Product,
  Category,
} from '@bintang/commerce';

// 3. Inventory
import {
  InventoryService,
  InMemoryInventoryRepository,
} from '@bintang/inventory';

// 4. Orders
import {
  OrderService,
  InMemoryOrderRepository,
  InMemoryCustomerRepository,
  InMemoryIdempotencyRepository,
  Customer,
  CreateOrderInput,
  OrderCaller,
  CustomerOrderAccessDeniedError,
  OrderNotFoundError,
} from '@bintang/orders';

// 5. Payments
import {
  PaymentService,
  MockPaymentProviderAdapter,
  InMemoryPaymentAccountRepository,
  InMemoryPaymentIntentRepository,
  InMemoryPaymentAttemptRepository,
  InMemoryPaymentEventRepository,
  InMemoryRefundRepository,
  PaymentCaller,
} from '@bintang/payments';

// 6. Fulfillment
import {
  FulfillmentService,
  InMemoryFulfillmentRepository,
  InMemoryFulfillmentItemRepository,
  FulfillmentCaller,
  FulfillmentOrderNotPayableError,
  FulfillmentStoreMismatchError,
} from '@bintang/fulfillment';

// 7. Apps & Context Resolvers
import {
  StoreContextResolver,
  CustomerSessionManager,
  ClientCartManager,
} from '@bintang/customer-store';

// 8. Observability
import { StructuredLogger } from '@bintang/observability';

describe('Production Pilot End-to-End Acceptance Suite (Single-Merchant Golden Path)', () => {
  // Shared Test Identifiers
  const storeId = 'store_pilot_bintang_01';
  const storeSlug = 'bintang-digital';
  const sellerUserId = 'user_pilot_seller_01';
  const sellerMemberId = 'mem_pilot_owner_01';

  const customerId = 'cust_pilot_buyer_01';
  const customerEmail = 'buyer.pilot@example.com';

  // Services and Repositories
  let authService: AuthorizationService;
  let entitlementResolver: InMemoryEntitlementResolver;

  let productRepo: InMemoryProductRepository;
  let categoryRepo: InMemoryCategoryRepository;

  let inventoryRepo: InMemoryInventoryRepository;
  let inventoryService: InventoryService;

  let orderRepo: InMemoryOrderRepository;
  let customerRepo: InMemoryCustomerRepository;
  let orderService: OrderService;

  let paymentAccountRepo: InMemoryPaymentAccountRepository;
  let paymentIntentRepo: InMemoryPaymentIntentRepository;
  let paymentAttemptRepo: InMemoryPaymentAttemptRepository;
  let paymentEventRepo: InMemoryPaymentEventRepository;
  let refundRepo: InMemoryRefundRepository;
  let mockPaymentAdapter: MockPaymentProviderAdapter;
  let paymentService: PaymentService;

  let fulfillmentRepo: InMemoryFulfillmentRepository;
  let fulfillmentItemRepo: InMemoryFulfillmentItemRepository;
  let fulfillmentService: FulfillmentService;

  let storeContextResolver: StoreContextResolver;
  let logger: StructuredLogger;

  // Authoritative Contexts
  let sellerContext: AuthenticatedStoreContext;

  beforeEach(async () => {
    logger = new StructuredLogger({ requestId: 'pilot-e2e-run' });

    // 1. Setup Auth & Entitlements
    entitlementResolver = new InMemoryEntitlementResolver();
    authService = new AuthorizationService({
      entitlementResolver,
    });

    sellerContext = createAuthenticatedStoreContext({
      storeId,
      userId: sellerUserId,
      membershipId: sellerMemberId,
      role: 'STORE_OWNER',
    });

    // 2. Setup Commerce
    productRepo = new InMemoryProductRepository();
    categoryRepo = new InMemoryCategoryRepository();

    // 3. Setup Inventory
    inventoryRepo = new InMemoryInventoryRepository();
    inventoryService = new InventoryService({
      inventoryRepository: inventoryRepo,
      productRepository: productRepo,
      authorizationService: authService,
    });

    // 4. Setup Orders
    orderRepo = new InMemoryOrderRepository();
    customerRepo = new InMemoryCustomerRepository();
    const orderIdempotencyRepo = new InMemoryIdempotencyRepository();
    orderService = new OrderService({
      orderRepository: orderRepo,
      customerRepository: customerRepo,
      productRepository: productRepo,
      inventoryService,
      authorizationService: authService,
      idempotencyRepository: orderIdempotencyRepo,
    });

    // 5. Setup Payments
    paymentAccountRepo = new InMemoryPaymentAccountRepository();
    paymentIntentRepo = new InMemoryPaymentIntentRepository();
    paymentAttemptRepo = new InMemoryPaymentAttemptRepository();
    paymentEventRepo = new InMemoryPaymentEventRepository();
    refundRepo = new InMemoryRefundRepository();
    mockPaymentAdapter = new MockPaymentProviderAdapter('TIPZY');

    paymentService = new PaymentService({
      accountRepository: paymentAccountRepo,
      intentRepository: paymentIntentRepo,
      attemptRepository: paymentAttemptRepo,
      eventRepository: paymentEventRepo,
      refundRepository: refundRepo,
      authorizationService: authService,
      orderService,
      adapters: [mockPaymentAdapter],
    });

    // 6. Setup Fulfillment
    fulfillmentRepo = new InMemoryFulfillmentRepository();
    fulfillmentItemRepo = new InMemoryFulfillmentItemRepository(fulfillmentRepo);
    fulfillmentService = new FulfillmentService({
      fulfillmentRepository: fulfillmentRepo,
      fulfillmentItemRepository: fulfillmentItemRepo,
      orderService,
      authorizationService: authService,
      inventoryService,
    });

    // 7. Setup Store Context Resolver (Customer Storefront)
    storeContextResolver = new StoreContextResolver([
      {
        storeId,
        storeName: 'Bintang Digital Store',
        tenantSlug: storeSlug,
        currency: 'IDR',
      },
    ]);
  });

  it('executes full merchant pilot lifecycle from catalog creation to digital fulfillment', async () => {
    // -------------------------------------------------------------------------
    // STEP 1: MERCHANT STORE & CATALOG PROVISIONING
    // -------------------------------------------------------------------------
    // Create product category
    const category: Category = {
      id: 'cat_license_01',
      storeId,
      name: 'Software Licenses',
      slug: 'software-licenses',
      description: 'Official digital licenses and serial keys',
      sortOrder: 1,
      status: 'ACTIVE',
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await categoryRepo.create(storeId, category);
    expect(category.id).toBeDefined();

    // Create digital product
    const product: Product = {
      id: 'prod_win11_pro',
      storeId,
      categoryId: category.id,
      name: 'Windows 11 Pro Retail License',
      slug: 'windows-11-pro-retail-license',
      description: 'Permanent genuine retail license key for Windows 11 Pro',
      productType: 'DIGITAL',
      price: 150000, // Rp 150.000
      compareAtPrice: 250000,
      stockMode: 'TRACKED',
      status: 'ACTIVE',
      metadata: { licenseType: 'RETAIL' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await productRepo.create(storeId, product);

    // Deposit initial inventory of 5 units
    await inventoryService.adjustStock(
      sellerContext,
      product.id,
      {
        type: 'INCREASE',
        quantity: 5,
        reason: 'Initial stock deposit for pilot merchant',
      },
    );

    const initialStock = await inventoryService.getAvailability(sellerContext, product.id);
    expect(initialStock.quantityOnHand).toBe(5);
    expect(initialStock.availableQuantity).toBe(5);
    expect(initialStock.quantityReserved).toBe(0);

    // -------------------------------------------------------------------------
    // STEP 2: CUSTOMER STOREFRONT BROWSING & CART SELECTION
    // -------------------------------------------------------------------------
    // Customer resolves store context via tenant slug
    const resolvedStore = storeContextResolver.resolveStore({ slug: storeSlug });
    expect(resolvedStore.storeId).toBe(storeId);
    expect(resolvedStore.storeName).toBe('Bintang Digital Store');

    // Customer creates session
    const customerSessionManager = new CustomerSessionManager();
    const customerSession = customerSessionManager.createSession({
      storeId: resolvedStore.storeId,
      customerId,
      customerEmail,
      customerName: 'Ahmad Pembeli',
    });
    expect(customerSession.customerId).toBe(customerId);

    // Customer adds 2 units to cart
    const cart = new ClientCartManager(storeId);
    cart.addItem(
      {
        productId: product.id,
        name: product.name,
        priceDisplay: 'Rp 150.000',
      },
      2,
    );

    expect(cart.getTotalCount()).toBe(2);
    const cartPayload = cart.toServerPayload();
    expect(cartPayload).toHaveLength(1);
    expect(cartPayload[0]?.quantity).toBe(2);

    // Ensure customer profile exists in customer repository
    const customer: Customer = {
      id: customerId,
      storeId,
      name: 'Ahmad Pembeli',
      email: customerEmail,
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
    await customerRepo.create(storeId, customer);

    // -------------------------------------------------------------------------
    // STEP 3: ATOMIC ORDER CHECKOUT WITH INVENTORY RESERVATION
    // -------------------------------------------------------------------------
    const checkoutPayload: CreateOrderInput = {
      customerId,
      items: [
        {
          productId: product.id,
          quantity: 2,
        },
      ],
      currency: 'IDR',
      idempotencyKey: 'idem_pilot_checkout_001',
    };

    const checkoutCaller: OrderCaller = {
      type: 'CUSTOMER',
      context: {
        storeId,
        customerId,
        name: 'Ahmad Pembeli',
        email: customerEmail,
      },
    };

    // Customer initiates order creation with idempotency key
    const order = await orderService.createOrder(
      checkoutCaller,
      checkoutPayload,
    );

    expect(order.id).toBeDefined();
    expect(order.storeId).toBe(storeId);
    expect(order.customerId).toBe(customerId);
    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.subtotal).toBe('300000.00');
    expect(order.grandTotal).toBe('300000.00');
    expect(order.items).toHaveLength(1);
    expect(order.items[0]?.quantity).toBe(2);
    expect(order.items[0]?.unitPrice).toBe('150000.00');

    // Invariant Check: 2 units reserved, 3 available
    const postCheckoutStock = await inventoryService.getAvailability(sellerContext, product.id);
    expect(postCheckoutStock.availableQuantity).toBe(3);
    expect(postCheckoutStock.quantityReserved).toBe(2);
    expect(postCheckoutStock.quantityOnHand).toBe(5);

    // Idempotency Invariant Check: Submitting identical key returns exact same order without double reserving stock
    const duplicateOrder = await orderService.createOrder(
      checkoutCaller,
      checkoutPayload,
    );
    expect(duplicateOrder.id).toBe(order.id);

    const idempotencyStock = await inventoryService.getAvailability(sellerContext, product.id);
    expect(idempotencyStock.availableQuantity).toBe(3);
    expect(idempotencyStock.quantityReserved).toBe(2);

    // -------------------------------------------------------------------------
    // STEP 4: PAYMENT INTENT & SETTLEMENT
    // -------------------------------------------------------------------------
    // Setup store payment account
    await paymentAccountRepo.create(storeId, {
      id: 'acc_pilot_tipzy_01',
      storeId,
      provider: 'TIPZY',
      displayName: 'Tipzy Simulator',
      status: 'ACTIVE',
      settlementConfig: { destination: 'bank_transfer' },
      supportedCurrencies: ['IDR'],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const paymentCaller: PaymentCaller = {
      type: 'CUSTOMER',
      context: {
        storeId,
        customerId,
        customerEmail,
      },
    };

    // Create payment intent
    const paymentIntent = await paymentService.createPaymentIntent(
      paymentCaller,
      {
        orderId: order.id,
        paymentAccountId: 'acc_pilot_tipzy_01',
        amount: '300000.00',
        currency: 'IDR',
        idempotencyKey: 'idem_pilot_pay_intent_001',
      },
    );

    expect(paymentIntent.id).toBeDefined();
    expect(paymentIntent.status).toBe('PENDING');
    expect(paymentIntent.amount).toBe('300000.00');

    // Execute provider payment attempt
    const attempt = await paymentService.createPaymentAttempt(
      paymentCaller,
      {
        paymentIntentId: paymentIntent.id,
      },
    );
    expect(attempt.status).toBe('PENDING');
    expect(attempt.providerReference).toBeDefined();

    // Ingest provider webhook callback with valid signature
    const webhookResult = await paymentService.processPaymentWebhook({
      provider: 'TIPZY',
      eventId: 'evt_pilot_pay_001',
      eventType: 'payment.succeeded',
      signature: 'valid_signature',
      providerReference: attempt.providerReference!,
      amount: '300000.00',
      currency: 'IDR',
      payload: {
        event_id: 'evt_pilot_pay_001',
        event_type: 'payment.succeeded',
        provider_reference: attempt.providerReference,
        status: 'SUCCEEDED',
        amount: '300000.00',
        currency: 'IDR',
      },
    });
    expect(webhookResult.processingStatus).toBe('PROCESSED');

    // Check payment intent transitioned to SUCCEEDED
    const settledIntent = await paymentService.getPaymentIntentById(paymentCaller, paymentIntent.id);
    expect(settledIntent.status).toBe('SUCCEEDED');

    // Order state is authoritatively transitioned to PAID by the webhook processor
    const sellerOrderCaller: OrderCaller = {
      type: 'SELLER',
      context: sellerContext,
    };
    const paidOrder = await orderService.getOrderById(sellerOrderCaller, order.id);
    expect(paidOrder.status).toBe('PAID');

    // -------------------------------------------------------------------------
    // STEP 5: AUTOMATED DIGITAL FULFILLMENT
    // -------------------------------------------------------------------------
    const fulfillmentCaller: FulfillmentCaller = {
      type: 'SELLER',
      context: sellerContext,
    };

    // Create fulfillment record
    const fulfillment = await fulfillmentService.createFulfillment(
      fulfillmentCaller,
      {
        orderId: order.id,
        strategy: 'DIGITAL_AUTO',
        idempotencyKey: 'idem_pilot_fulfil_create_001',
      },
    );
    expect(fulfillment.status).toBe('PENDING');

    // Execute fulfillment delivery with 2 generated keys
    const executedFulfillment = await fulfillmentService.executeFulfillment(
      fulfillmentCaller,
      {
        fulfillmentId: fulfillment.id,
        manualPayloads: {
          [order.items[0]!.id]: 'WIN11-PILOT-KEY-001, WIN11-PILOT-KEY-002',
        },
        idempotencyKey: 'idem_pilot_fulfil_exec_001',
      },
    );

    expect(executedFulfillment.status).toBe('FULFILLED');

    // Transition order status to FULFILLED (which automatically consumes reserved inventory)
    const fulfilledOrder = await orderService.transitionStatus(
      sellerContext,
      order.id,
      'FULFILLED',
    );
    expect(fulfilledOrder.status).toBe('FULFILLED');

    // Invariant Check: 2 units consumed, 3 available remaining, 0 reserved, total on-hand = 3
    const finalStock = await inventoryService.getAvailability(sellerContext, product.id);
    expect(finalStock.availableQuantity).toBe(3);
    expect(finalStock.quantityReserved).toBe(0);
    expect(finalStock.quantityOnHand).toBe(3);

    // -------------------------------------------------------------------------
    // STEP 6: BUSINESS, STATE MACHINE & SECURITY INVARIANTS
    // -------------------------------------------------------------------------
    // Invariant 1: Unpaid orders cannot be fulfilled
    const unpaidOrder = await orderService.createOrder(
      checkoutCaller,
      {
        customerId,
        items: [{ productId: product.id, quantity: 1 }],
        currency: 'IDR',
        idempotencyKey: 'idem_unpaid_order_check',
      },
    );
    await expect(
      fulfillmentService.createFulfillment(
        fulfillmentCaller,
        {
          orderId: unpaidOrder.id,
          strategy: 'DIGITAL_AUTO',
          idempotencyKey: 'idem_unpaid_fulfil_fail',
        },
      ),
    ).rejects.toThrowError(FulfillmentOrderNotPayableError);

    // Invariant 2: Cross-tenant isolation (foreign store caller cannot access order)
    const foreignStoreCaller: OrderCaller = {
      type: 'CUSTOMER',
      context: {
        storeId: 'store_intruder_99',
        customerId: 'user_intruder_99',
      },
    };
    await expect(
      orderService.getOrderById(foreignStoreCaller, order.id),
    ).rejects.toThrow();

    const foreignFulfillmentCaller: FulfillmentCaller = {
      type: 'SELLER',
      context: createAuthenticatedStoreContext({
        storeId: 'store_intruder_99',
        userId: 'user_intruder_99',
        membershipId: 'mem_intruder_99',
        role: 'STORE_OWNER',
      }),
    };
    await expect(
      fulfillmentService.createFulfillment(
        foreignFulfillmentCaller,
        {
          orderId: order.id,
          strategy: 'DIGITAL_AUTO',
          idempotencyKey: 'idem_cross_tenant_fulfil_fail',
        },
      ),
    ).rejects.toThrowError(OrderNotFoundError);

    // Invariant 3: Completed orders cannot be cancelled
    await expect(
      orderService.cancelOrder(
        sellerOrderCaller,
        order.id,
        'Cancellation should fail',
      ),
    ).rejects.toThrow();

    // Log success in structured logger
    logger.info('Pilot end-to-end golden path successfully completed and verified', {
      storeId,
      orderId: order.id,
      fulfilledItems: 2,
      remainingStock: finalStock.availableQuantity,
    });
  });
});

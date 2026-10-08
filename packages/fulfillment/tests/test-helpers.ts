import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import { AuthorizationService, InMemoryEntitlementResolver } from '@bintang/authorization';
import {
  OrderService,
  InMemoryOrderRepository,
  InMemoryCustomerRepository,
  Customer,
} from '@bintang/orders';
import { InMemoryProductRepository, Product } from '@bintang/commerce';
import {
  InventoryService,
  InMemoryInventoryRepository,
  InMemoryInventoryItemRepository,
} from '@bintang/inventory';
import {
  FulfillmentService,
  InMemoryFulfillmentRepository,
  InMemoryFulfillmentItemRepository,
  InMemoryFulfillmentIdempotencyRepository,
  MockFulfillmentProviderAdapter,
} from '../src/index.js';

export interface TestHarness {
  storeId: string;
  sellerContext: ReturnType<typeof createAuthenticatedStoreContext>;
  customerA: Customer;
  customerB: Customer;
  orderRepo: InMemoryOrderRepository;
  customerRepo: InMemoryCustomerRepository;
  productRepo: InMemoryProductRepository;
  inventoryRepo: InMemoryInventoryRepository;
  inventoryItemRepo: InMemoryInventoryItemRepository;
  authService: AuthorizationService;
  inventoryService: InventoryService;
  orderService: OrderService;
  fulfillmentRepo: InMemoryFulfillmentRepository;
  fulfillmentItemRepo: InMemoryFulfillmentItemRepository;
  idempotencyRepo: InMemoryFulfillmentIdempotencyRepository;
  mockProvider: MockFulfillmentProviderAdapter;
  fulfillmentService: FulfillmentService;
}

export function createTestHarness(customStoreId = 'store_test_m09'): TestHarness {
  const storeId = customStoreId;
  const sellerContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_merchant_1',
    membershipId: 'mem_merchant_1',
    role: 'STORE_OWNER',
  });

  const now = new Date().toISOString();

  const customerA: Customer = {
    id: `cust_a_${storeId}`,
    storeId,
    name: 'Alice Customer',
    email: 'alice@example.com',
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

  const customerB: Customer = {
    id: `cust_b_${storeId}`,
    storeId,
    name: 'Bob Customer',
    email: 'bob@example.com',
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

  const orderRepo = new InMemoryOrderRepository();
  const customerRepo = new InMemoryCustomerRepository();
  const productRepo = new InMemoryProductRepository();
  const inventoryRepo = new InMemoryInventoryRepository();
  const inventoryItemRepo = new InMemoryInventoryItemRepository();

  const authService = new AuthorizationService({
    entitlementResolver: new InMemoryEntitlementResolver(),
  });

  const inventoryService = new InventoryService({
    inventoryRepository: inventoryRepo,
    productRepository: productRepo,
    authorizationService: authService,
    inventoryItemRepository: inventoryItemRepo,
  });

  const orderService = new OrderService({
    orderRepository: orderRepo,
    customerRepository: customerRepo,
    productRepository: productRepo,
    inventoryService,
    authorizationService: authService,
  });

  const fulfillmentRepo = new InMemoryFulfillmentRepository();
  const fulfillmentItemRepo = new InMemoryFulfillmentItemRepository(fulfillmentRepo);
  const idempotencyRepo = new InMemoryFulfillmentIdempotencyRepository();
  const mockProvider = new MockFulfillmentProviderAdapter();

  const fulfillmentService = new FulfillmentService({
    fulfillmentRepository: fulfillmentRepo,
    fulfillmentItemRepository: fulfillmentItemRepo,
    orderService,
    authorizationService: authService,
    inventoryService,
    idempotencyRepository: idempotencyRepo,
    providers: [mockProvider],
  });

  return {
    storeId,
    sellerContext,
    customerA,
    customerB,
    orderRepo,
    customerRepo,
    productRepo,
    inventoryRepo,
    inventoryItemRepo,
    authService,
    inventoryService,
    orderService,
    fulfillmentRepo,
    fulfillmentItemRepo,
    idempotencyRepo,
    mockProvider,
    fulfillmentService,
  };
}

export async function setupProductAndOrder(
  harness: TestHarness,
  options?: {
    stockMode?: 'TRACKED' | 'UNLIMITED';
    initialStock?: number;
    withDigitalItems?: boolean;
    orderStatus?: 'PENDING_PAYMENT' | 'PAID' | 'PROCESSING' | 'FULFILLED' | 'CANCELLED';
    customerId?: string;
  },
) {
  const stockMode = options?.stockMode ?? 'TRACKED';
  const initialStock = options?.initialStock ?? 10;
  const targetStatus = options?.orderStatus ?? 'PAID';
  const customerId = options?.customerId ?? harness.customerA.id;

  const now = new Date().toISOString();

  // Seed customer
  await harness.customerRepo.create(harness.storeId, harness.customerA);
  await harness.customerRepo.create(harness.storeId, harness.customerB);

  // Seed product
  const productId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const product: Product = {
    id: productId,
    storeId: harness.storeId,
    categoryId: null,
    name: 'Digital Mastery Ebook',
    slug: `digital-mastery-${productId}`,
    description: 'Learn modern software architecture',
    productType: 'DIGITAL',
    price: '50000.00',
    compareAtPrice: null,
    stockMode,
    status: 'ACTIVE',
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
  await harness.productRepo.create(harness.storeId, product);

  // Seed inventory
  if (stockMode === 'TRACKED') {
    await harness.inventoryService.initializeInventory(
      harness.sellerContext,
      productId,
      initialStock,
    );

    if (options?.withDigitalItems) {
      for (let i = 0; i < 3; i++) {
        await harness.inventoryService.createInventoryItem(harness.sellerContext, {
          productId,
          itemType: 'CREDENTIAL',
          secretReference: `secret_license_key_${productId}_${i}`,
        });
      }
    }
  }

  // Create order
  const order = await harness.orderService.createOrder(
    {
      type: 'CUSTOMER',
      context: {
        storeId: harness.storeId,
        customerId,
      },
    },
    {
      items: [
        {
          productId,
          quantity: 1,
        },
      ],
    },
  );

  // Transition order to requested status
  if (targetStatus !== 'PENDING_PAYMENT') {
    if (targetStatus === 'PAID') {
      await harness.orderService.transitionStatus(harness.sellerContext, order.id, 'PAID');
    } else if (targetStatus === 'PROCESSING') {
      await harness.orderService.transitionStatus(harness.sellerContext, order.id, 'PAID');
      await harness.orderService.transitionStatus(harness.sellerContext, order.id, 'PROCESSING');
    } else if (targetStatus === 'CANCELLED') {
      await harness.orderService.cancelOrder(
        { type: 'SELLER', context: harness.sellerContext },
        order.id,
      );
    } else if (targetStatus === 'FULFILLED') {
      await harness.orderService.transitionStatus(harness.sellerContext, order.id, 'PAID');
      await harness.orderService.transitionStatus(harness.sellerContext, order.id, 'PROCESSING');
      await harness.orderService.transitionStatus(harness.sellerContext, order.id, 'FULFILLED');
    }
  }

  const refreshedOrder = await harness.orderRepo.findById(harness.storeId, order.id);
  return { product, order: refreshedOrder! };
}

import { describe, it, expect, beforeEach } from 'vitest';
import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import { AuthorizationService, InMemoryEntitlementResolver } from '@bintang/authorization';
import { InMemoryProductRepository, Product } from '@bintang/commerce';
import { InventoryService, InMemoryInventoryRepository } from '@bintang/inventory';
import {
  OrderService,
  InMemoryOrderRepository,
  InMemoryCustomerRepository,
  Customer,
  InvalidOrderQuantityError,
  EmptyOrderItemsError,
  ProductUnavailableError,
  CustomerNotFoundError,
} from '../src/index.js';

describe('M07 Order Creation Suite', () => {
  let orderRepo: InMemoryOrderRepository;
  let customerRepo: InMemoryCustomerRepository;
  let productRepo: InMemoryProductRepository;
  let inventoryRepo: InMemoryInventoryRepository;
  let inventoryService: InventoryService;
  let authService: AuthorizationService;
  let orderService: OrderService;

  const storeId = 'store_test_order_create';

  const sellerContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_merchant_owner',
    membershipId: 'mem_owner_01',
    role: 'STORE_OWNER',
  });

  const customer: Customer = {
    id: 'cust_alpha_001',
    storeId,
    name: 'Budi Pratama',
    email: 'budi@example.com',
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

  const trackedProduct1: Product = {
    id: 'prod_tracked_01',
    storeId,
    categoryId: null,
    name: 'Canva Pro 1 Month',
    slug: 'canva-pro-1-month',
    description: null,
    productType: 'DIGITAL',
    price: 35000,
    compareAtPrice: null,
    stockMode: 'TRACKED',
    status: 'ACTIVE',
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const trackedProduct2: Product = {
    id: 'prod_tracked_02',
    storeId,
    categoryId: null,
    name: 'YouTube Premium 1 Month',
    slug: 'youtube-premium-1-month',
    description: null,
    productType: 'DIGITAL',
    price: 25000,
    compareAtPrice: null,
    stockMode: 'TRACKED',
    status: 'ACTIVE',
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const inactiveProduct: Product = {
    id: 'prod_inactive_01',
    storeId,
    categoryId: null,
    name: 'Draft Unpublished Course',
    slug: 'draft-unpublished-course',
    description: null,
    productType: 'DIGITAL',
    price: 100000,
    compareAtPrice: null,
    stockMode: 'TRACKED',
    status: 'DRAFT',
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const unlimitedProduct: Product = {
    id: 'prod_unlimited_01',
    storeId,
    categoryId: null,
    name: 'E-Book Digital Marketing',
    slug: 'ebook-digital-marketing',
    description: null,
    productType: 'DIGITAL',
    price: 50000,
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
    authService = new AuthorizationService(new InMemoryEntitlementResolver());

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
    });

    await customerRepo.create(storeId, customer);
    await productRepo.create(storeId, trackedProduct1);
    await productRepo.create(storeId, trackedProduct2);
    await productRepo.create(storeId, inactiveProduct);
    await productRepo.create(storeId, unlimitedProduct);

    // Stock initialization: trackedProduct1 has 10, trackedProduct2 has 5
    await inventoryService.initializeInventory(sellerContext, trackedProduct1.id, 10);
    await inventoryService.initializeInventory(sellerContext, trackedProduct2.id, 5);
  });

  it('creates a valid single-item order with deterministic totals', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      {
        items: [{ productId: trackedProduct1.id, quantity: 2 }],
      },
    );

    expect(order.id).toBeDefined();
    expect(order.orderNumber).toMatch(/^ORD-\d{8}-[A-Z0-9]{6}$/);
    expect(order.storeId).toBe(storeId);
    expect(order.customerId).toBe(customer.id);
    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.fulfillmentStatus).toBe('PENDING');
    expect(order.currency).toBe('IDR');
    expect(order.subtotal).toBe('70000.00'); // 35000 * 2
    expect(order.discountTotal).toBe('0.00');
    expect(order.grandTotal).toBe('70000.00');
    expect(order.items.length).toBe(1);
    expect(order.items[0]!.productName).toBe('Canva Pro 1 Month');
    expect(order.items[0]!.unitPrice).toBe('35000.00');
    expect(order.items[0]!.subtotal).toBe('70000.00');
  });

  it('creates a multi-item order combining TRACKED and UNLIMITED products', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      {
        items: [
          { productId: trackedProduct1.id, quantity: 1 }, // 35000
          { productId: trackedProduct2.id, quantity: 2 }, // 50000
          { productId: unlimitedProduct.id, quantity: 3 }, // 150000
        ],
      },
    );

    expect(order.items.length).toBe(3);
    // Subtotal: 35000 + 50000 + 150000 = 235000.00
    expect(order.subtotal).toBe('235000.00');
    expect(order.grandTotal).toBe('235000.00');
  });

  it('rejects order with non-positive or floating point quantity', async () => {
    await expect(
      orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
        { items: [{ productId: trackedProduct1.id, quantity: 0 }] },
      ),
    ).rejects.toThrow(InvalidOrderQuantityError);

    await expect(
      orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
        { items: [{ productId: trackedProduct1.id, quantity: -2 }] },
      ),
    ).rejects.toThrow(InvalidOrderQuantityError);

    await expect(
      orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
        { items: [{ productId: trackedProduct1.id, quantity: 1.5 }] },
      ),
    ).rejects.toThrow(InvalidOrderQuantityError);
  });

  it('rejects empty order items list', async () => {
    await expect(
      orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
        { items: [] },
      ),
    ).rejects.toThrow(EmptyOrderItemsError);
  });

  it('rejects purchase of non-active product (DRAFT)', async () => {
    await expect(
      orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
        { items: [{ productId: inactiveProduct.id, quantity: 1 }] },
      ),
    ).rejects.toThrow(ProductUnavailableError);
  });

  it('rejects order if customer does not exist in store', async () => {
    await expect(
      orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: 'cust_ghost_999' } },
        { items: [{ productId: trackedProduct1.id, quantity: 1 }] },
      ),
    ).rejects.toThrow(CustomerNotFoundError);
  });

  it('preserves custom metadata and currency on order and items', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      {
        currency: 'USD',
        metadata: { source: 'mobile_app', clientVersion: '2.4.0' },
        items: [
          {
            productId: trackedProduct1.id,
            quantity: 1,
            metadata: { note: 'gift for friend' },
          },
        ],
      },
    );

    expect(order.currency).toBe('USD');
    expect(order.metadata).toEqual({ source: 'mobile_app', clientVersion: '2.4.0' });
    expect(order.items[0]!.metadata).toEqual({ note: 'gift for friend' });
  });

  it('retrieves order by orderNumber successfully', async () => {
    const created = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: trackedProduct1.id, quantity: 1 }] },
    );

    const fetched = await orderService.getOrderByNumber(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      created.orderNumber,
    );

    expect(fetched.id).toBe(created.id);
    expect(fetched.orderNumber).toBe(created.orderNumber);
  });

  it('rejects order with NaN or non-numeric quantity', async () => {
    await expect(
      orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
        { items: [{ productId: trackedProduct1.id, quantity: NaN }] },
      ),
    ).rejects.toThrow(InvalidOrderQuantityError);
  });
});

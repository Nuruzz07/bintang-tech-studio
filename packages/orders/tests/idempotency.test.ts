import { describe, it, expect, beforeEach } from 'vitest';
import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import { AuthorizationService, InMemoryEntitlementResolver } from '@bintang/authorization';
import { InMemoryProductRepository, Product } from '@bintang/commerce';
import { InventoryService, InMemoryInventoryRepository } from '@bintang/inventory';
import {
  OrderService,
  InMemoryOrderRepository,
  InMemoryCustomerRepository,
  InMemoryIdempotencyRepository,
  Customer,
  IdempotencyConflictError,
} from '../src/index.js';

describe('M07 Order Idempotency Suite', () => {
  let orderRepo: InMemoryOrderRepository;
  let customerRepo: InMemoryCustomerRepository;
  let productRepo: InMemoryProductRepository;
  let inventoryRepo: InMemoryInventoryRepository;
  let idempotencyRepo: InMemoryIdempotencyRepository;
  let inventoryService: InventoryService;
  let authService: AuthorizationService;
  let orderService: OrderService;

  const storeId = 'store_test_idempotency';

  const sellerContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_merchant',
    membershipId: 'mem_merchant',
    role: 'STORE_OWNER',
  });

  const customer1: Customer = {
    id: 'cust_idem_01',
    storeId,
    name: 'Customer 1',
    email: 'c1@example.com',
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

  const customer2: Customer = {
    id: 'cust_idem_02',
    storeId,
    name: 'Customer 2',
    email: 'c2@example.com',
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

  const product: Product = {
    id: 'prod_idem_01',
    storeId,
    categoryId: null,
    name: 'Idempotent Product',
    slug: 'idempotent-product',
    description: null,
    productType: 'DIGITAL',
    price: 45000,
    compareAtPrice: null,
    stockMode: 'TRACKED',
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
    idempotencyRepo = new InMemoryIdempotencyRepository();
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
      idempotencyRepository: idempotencyRepo,
    });

    await customerRepo.create(storeId, customer1);
    await customerRepo.create(storeId, customer2);
    await productRepo.create(storeId, product);
    await inventoryService.initializeInventory(sellerContext, product.id, 20);
  });

  it('returns existing order on repeated identical request with same idempotency key', async () => {
    const key = 'idem-req-unique-001';

    // Call 1
    const order1 = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer1.id } },
      {
        idempotencyKey: key,
        items: [{ productId: product.id, quantity: 2 }],
      },
    );

    // Call 2 (network retry or double-click with identical payload)
    const order2 = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer1.id } },
      {
        idempotencyKey: key,
        items: [{ productId: product.id, quantity: 2 }],
      },
    );

    expect(order2.id).toBe(order1.id);
    expect(order2.orderNumber).toBe(order1.orderNumber);

    // Total orders created in repository is strictly 1
    const allOrders = await orderRepo.list(storeId);
    expect(allOrders.length).toBe(1);

    // Stock reserved must be exactly 2, not double-reserved (4)
    const avail = await inventoryService.getAvailability(sellerContext, product.id);
    expect(avail.quantityReserved).toBe(2);
    expect(avail.availableQuantity).toBe(18);
  });

  it('rejects reused idempotency key when payload differs with IdempotencyConflictError', async () => {
    const key = 'idem-req-conflict-002';

    // First request
    await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer1.id } },
      {
        idempotencyKey: key,
        items: [{ productId: product.id, quantity: 1 }],
      },
    );

    // Second request with different quantity
    await expect(
      orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: customer1.id } },
        {
          idempotencyKey: key,
          items: [{ productId: product.id, quantity: 5 }],
        },
      ),
    ).rejects.toThrow(IdempotencyConflictError);
  });

  it('isolates idempotency keys across different customer actors', async () => {
    const sharedKey = 'client-generated-key-xyz';

    // Customer 1 uses key
    const order1 = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer1.id } },
      {
        idempotencyKey: sharedKey,
        items: [{ productId: product.id, quantity: 1 }],
      },
    );

    // Customer 2 uses same key string (keys are scoped by store + actor)
    const order2 = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer2.id } },
      {
        idempotencyKey: sharedKey,
        items: [{ productId: product.id, quantity: 1 }],
      },
    );

    expect(order1.id).not.toBe(order2.id);
    expect(order1.customerId).toBe(customer1.id);
    expect(order2.customerId).toBe(customer2.id);

    const allOrders = await orderRepo.list(storeId);
    expect(allOrders.length).toBe(2);
  });

  it('handles concurrent same-key order creation safely without duplicate orders or double reservation', async () => {
    const concurrentKey = 'concurrent-flash-key-999';
    const caller = { type: 'CUSTOMER' as const, context: { storeId, customerId: customer1.id } };
    const payload = {
      idempotencyKey: concurrentKey,
      items: [{ productId: product.id, quantity: 2 }],
    };

    // Fire 5 concurrent requests at the exact same millisecond
    const results = await Promise.all([
      orderService.createOrder(caller, payload),
      orderService.createOrder(caller, payload),
      orderService.createOrder(caller, payload),
      orderService.createOrder(caller, payload),
      orderService.createOrder(caller, payload),
    ]);

    // All callers receive the exact same order
    const firstOrderId = results[0]!.id;
    for (const res of results) {
      expect(res.id).toBe(firstOrderId);
    }

    // Exactly 1 order in repository, NOT 5 duplicates
    const allOrders = await orderRepo.list(storeId);
    expect(allOrders.length).toBe(1);

    // Stock reserved exactly once (2 units), NOT 5 times (10 units)
    const avail = await inventoryService.getAvailability(sellerContext, product.id);
    expect(avail.quantityReserved).toBe(2);
    expect(avail.availableQuantity).toBe(18);
  });

  it('isolates idempotency keys across different stores without collision', async () => {
    const otherStoreId = 'store_test_idempotency_secondary';
    const otherSeller = createAuthenticatedStoreContext({
      storeId: otherStoreId,
      userId: 'user_merchant_other',
      membershipId: 'mem_other',
      role: 'STORE_OWNER',
    });

    const otherCustomer: Customer = {
      ...customer1,
      id: 'cust_other_store',
      storeId: otherStoreId,
    };
    const otherProduct: Product = {
      ...product,
      id: 'prod_other_store',
      storeId: otherStoreId,
    };

    await customerRepo.create(otherStoreId, otherCustomer);
    await productRepo.create(otherStoreId, otherProduct);
    await inventoryService.initializeInventory(otherSeller, otherProduct.id, 20);

    const sharedKey = 'cross-store-key-111';

    const orderStore1 = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer1.id } },
      { idempotencyKey: sharedKey, items: [{ productId: product.id, quantity: 1 }] },
    );

    const orderStore2 = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId: otherStoreId, customerId: otherCustomer.id } },
      { idempotencyKey: sharedKey, items: [{ productId: otherProduct.id, quantity: 1 }] },
    );

    expect(orderStore1.id).not.toBe(orderStore2.id);
    expect(orderStore1.storeId).toBe(storeId);
    expect(orderStore2.storeId).toBe(otherStoreId);
  });
});

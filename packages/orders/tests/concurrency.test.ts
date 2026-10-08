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
} from '../src/index.js';

describe('M07 Order Concurrency & Race-Condition Suite', () => {
  let orderRepo: InMemoryOrderRepository;
  let customerRepo: InMemoryCustomerRepository;
  let productRepo: InMemoryProductRepository;
  let inventoryRepo: InMemoryInventoryRepository;
  let inventoryService: InventoryService;
  let authService: AuthorizationService;
  let orderService: OrderService;

  const storeId = 'store_test_order_concurrency';

  const sellerContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_merchant',
    membershipId: 'mem_merchant',
    role: 'STORE_OWNER',
  });

  const lastStockProduct: Product = {
    id: 'prod_last_unit_01',
    storeId,
    categoryId: null,
    name: 'Last Unit Limited Sneakers Voucher',
    slug: 'last-unit-limited-sneakers-voucher',
    description: null,
    productType: 'DIGITAL',
    price: 990000,
    compareAtPrice: null,
    stockMode: 'TRACKED',
    status: 'ACTIVE',
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const flashSaleProduct: Product = {
    id: 'prod_flash_sale_05',
    storeId,
    categoryId: null,
    name: 'Flash Sale Steam Voucher $50',
    slug: 'flash-sale-steam-voucher-50',
    description: null,
    productType: 'DIGITAL',
    price: 700000,
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

    await productRepo.create(storeId, lastStockProduct);
    await productRepo.create(storeId, flashSaleProduct);
  });

  it('guarantees that exactly one customer wins when two customers compete for the last stock unit', async () => {
    // Only 1 unit in inventory
    await inventoryService.initializeInventory(sellerContext, lastStockProduct.id, 1);

    const custA: Customer = {
      id: 'cust_race_a',
      storeId,
      name: 'Customer A',
      email: 'a@race.com',
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

    const custB: Customer = {
      id: 'cust_race_b',
      storeId,
      name: 'Customer B',
      email: 'b@race.com',
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

    await customerRepo.create(storeId, custA);
    await customerRepo.create(storeId, custB);

    // Fire two simultaneous order creation requests
    const [resultA, resultB] = await Promise.allSettled([
      orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: custA.id } },
        { items: [{ productId: lastStockProduct.id, quantity: 1 }] },
      ),
      orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: custB.id } },
        { items: [{ productId: lastStockProduct.id, quantity: 1 }] },
      ),
    ]);

    const successes = [resultA, resultB].filter((r) => r.status === 'fulfilled');
    const failures = [resultA, resultB].filter((r) => r.status === 'rejected');

    // Exactly one fulfilled, exactly one rejected
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    // Total orders created in repo is strictly 1
    const orders = await orderRepo.list(storeId);
    expect(orders.length).toBe(1);

    // Final inventory: quantityReserved = 1, available = 0, no negative stock
    const avail = await inventoryService.getAvailability(sellerContext, lastStockProduct.id);
    expect(avail.quantityOnHand).toBe(1);
    expect(avail.quantityReserved).toBe(1);
    expect(avail.availableQuantity).toBe(0);
  });

  it('guarantees zero race conditions and zero negative stock under 15-user concurrent checkout for 5 items', async () => {
    // Exactly 5 units available
    await inventoryService.initializeInventory(sellerContext, flashSaleProduct.id, 5);

    // Create 15 distinct customers
    const concurrency = 15;
    const customers: Customer[] = [];

    for (let i = 0; i < concurrency; i++) {
      const cust: Customer = {
        id: `cust_flash_${i}`,
        storeId,
        name: `Customer ${i}`,
        email: `c${i}@flash.com`,
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
      await customerRepo.create(storeId, cust);
      customers.push(cust);
    }

    // Fire 15 concurrent checkout attempts
    const promises = customers.map((c) =>
      orderService
        .createOrder(
          { type: 'CUSTOMER', context: { storeId, customerId: c.id } },
          { items: [{ productId: flashSaleProduct.id, quantity: 1 }] },
        )
        .then(() => ({ success: true }))
        .catch((err) => ({ success: false, error: err })),
    );

    const results = await Promise.all(promises);

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    // Exactly 5 must succeed, exactly 10 must fail
    expect(successes.length).toBe(5);
    expect(failures.length).toBe(10);

    const ordersInRepo = await orderRepo.list(storeId);
    expect(ordersInRepo.length).toBe(5);

    const avail = await inventoryService.getAvailability(sellerContext, flashSaleProduct.id);
    expect(avail.quantityOnHand).toBe(5);
    expect(avail.quantityReserved).toBe(5);
    expect(avail.availableQuantity).toBe(0);
  });

  it('maintains state machine consistency during concurrent transition attempts', async () => {
    await inventoryService.initializeInventory(sellerContext, flashSaleProduct.id, 10);

    const cust: Customer = {
      id: 'cust_race_trans',
      storeId,
      name: 'Customer Transition',
      email: 'trans@race.com',
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
    await customerRepo.create(storeId, cust);

    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: cust.id } },
      { items: [{ productId: flashSaleProduct.id, quantity: 1 }] },
    );

    // Concurrently try to mark PAID and cancel order
    await Promise.allSettled([
      orderService.transitionStatus(sellerContext, order.id, 'PAID'),
      orderService.cancelOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: cust.id } },
        order.id,
      ),
    ]);

    // One succeeds, the other fails due to invalid transition from updated state, or both resolve sequentially
    const updated = await orderService.getOrderById(
      { type: 'SELLER', context: sellerContext },
      order.id,
    );
    expect(['PAID', 'CANCELLED']).toContain(updated.status);
  });
});

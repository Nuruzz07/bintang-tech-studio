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
  ProductUnavailableError,
} from '../src/index.js';

describe('M07 Inventory Integration & Reservation Rollback Suite', () => {
  let orderRepo: InMemoryOrderRepository;
  let customerRepo: InMemoryCustomerRepository;
  let productRepo: InMemoryProductRepository;
  let inventoryRepo: InMemoryInventoryRepository;
  let inventoryService: InventoryService;
  let authService: AuthorizationService;
  let orderService: OrderService;

  const storeId = 'store_test_inv_integration';

  const sellerContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_merchant',
    membershipId: 'mem_merchant',
    role: 'STORE_OWNER',
  });

  const customer: Customer = {
    id: 'cust_inv_01',
    storeId,
    name: 'Ahmad Dahlan',
    email: 'ahmad@example.com',
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

  const productA: Product = {
    id: 'prod_stock_a',
    storeId,
    categoryId: null,
    name: 'Stock Product A',
    slug: 'stock-product-a',
    description: null,
    productType: 'DIGITAL',
    price: 10000,
    compareAtPrice: null,
    stockMode: 'TRACKED',
    status: 'ACTIVE',
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const productB: Product = {
    id: 'prod_stock_b',
    storeId,
    categoryId: null,
    name: 'Stock Product B (Scarce)',
    slug: 'stock-product-b',
    description: null,
    productType: 'DIGITAL',
    price: 20000,
    compareAtPrice: null,
    stockMode: 'TRACKED',
    status: 'ACTIVE',
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const productUnlimited: Product = {
    id: 'prod_stock_unlimited',
    storeId,
    categoryId: null,
    name: 'Unlimited Software License',
    slug: 'unlimited-software-license',
    description: null,
    productType: 'DIGITAL',
    price: 75000,
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
    await productRepo.create(storeId, productA);
    await productRepo.create(storeId, productB);
    await productRepo.create(storeId, productUnlimited);

    // Initial stock: Product A has 10 units, Product B has only 2 units
    await inventoryService.initializeInventory(sellerContext, productA.id, 10);
    await inventoryService.initializeInventory(sellerContext, productB.id, 2);
  });

  it('atomically reserves tracked inventory when order is created', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: productA.id, quantity: 4 }] },
    );

    expect(order.status).toBe('PENDING_PAYMENT');

    const avail = await inventoryService.getAvailability(sellerContext, productA.id);
    expect(avail.quantityOnHand).toBe(10);
    expect(avail.quantityReserved).toBe(4);
    expect(avail.availableQuantity).toBe(6);
  });

  it('permits ordering UNLIMITED stock without creating artificial finite stock', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: productUnlimited.id, quantity: 50 }] },
    );

    expect(order.id).toBeDefined();

    const avail = await inventoryService.getAvailability(sellerContext, productUnlimited.id);
    expect(avail.availableQuantity).toBe(Number.POSITIVE_INFINITY);
    expect(avail.isAvailable).toBe(true);
  });

  it('rejects order creation when requested quantity exceeds available stock', async () => {
    await expect(
      orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
        { items: [{ productId: productB.id, quantity: 3 }] }, // Only 2 available
      ),
    ).rejects.toThrow(ProductUnavailableError);

    // Verify stock is untouched
    const avail = await inventoryService.getAvailability(sellerContext, productB.id);
    expect(avail.quantityReserved).toBe(0);
    expect(avail.availableQuantity).toBe(2);
  });

  it('executes compensating rollback if multi-item reservation fails midway', async () => {
    // Ordering 3 of Product A (has 10) AND 5 of Product B (has only 2)
    await expect(
      orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
        {
          items: [
            { productId: productA.id, quantity: 3 },
            { productId: productB.id, quantity: 5 }, // Fails here!
          ],
        },
      ),
    ).rejects.toThrow(ProductUnavailableError);

    // Crucial check: Product A's stock must NOT be left reserved!
    const availA = await inventoryService.getAvailability(sellerContext, productA.id);
    expect(availA.quantityReserved).toBe(0);
    expect(availA.availableQuantity).toBe(10);

    const availB = await inventoryService.getAvailability(sellerContext, productB.id);
    expect(availB.quantityReserved).toBe(0);
    expect(availB.availableQuantity).toBe(2);

    // No partial order record in repository
    const orders = await orderRepo.list(storeId);
    expect(orders.length).toBe(0);
  });

  it('automatically releases reserved stock when order is cancelled from PENDING_PAYMENT', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: productA.id, quantity: 3 }] },
    );

    // Availability is currently 7
    let availA = await inventoryService.getAvailability(sellerContext, productA.id);
    expect(availA.availableQuantity).toBe(7);
    expect(availA.quantityReserved).toBe(3);

    // Customer cancels order
    const cancelled = await orderService.cancelOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      order.id,
      'Changed my mind',
    );

    expect(cancelled.status).toBe('CANCELLED');

    // Reserved stock must be fully restored!
    availA = await inventoryService.getAvailability(sellerContext, productA.id);
    expect(availA.quantityReserved).toBe(0);
    expect(availA.availableQuantity).toBe(10);
  });

  it('executes compensating rollback if order repository persistence fails after reservations succeed', async () => {
    // Sabotage order repository create method to simulate DB error
    const originalCreate = orderRepo.create.bind(orderRepo);
    orderRepo.create = async () => {
      throw new Error('Database connection timeout during order persistence');
    };

    try {
      await expect(
        orderService.createOrder(
          { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
          { items: [{ productId: productA.id, quantity: 4 }] },
        ),
      ).rejects.toThrow('Database connection timeout during order persistence');

      // Crucial verification: Even though reservation succeeded, persistence failure triggered rollback!
      const availA = await inventoryService.getAvailability(sellerContext, productA.id);
      expect(availA.quantityReserved).toBe(0);
      expect(availA.availableQuantity).toBe(10);

      const orders = await orderRepo.list(storeId);
      expect(orders.length).toBe(0);
    } finally {
      orderRepo.create = originalCreate;
    }
  });

  it('surfaces composite error with rollbackFailures visibility if compensating release fails', async () => {
    // Sabotage releaseStock to throw during rollback
    const originalRelease = inventoryService.releaseStock.bind(inventoryService);
    inventoryService.releaseStock = async () => {
      throw new Error('Fatal network error during inventory compensation release');
    };

    // Also sabotage orderRepo.create so rollback is triggered
    const originalCreate = orderRepo.create.bind(orderRepo);
    orderRepo.create = async () => {
      throw new Error('Order persistence constraint failure');
    };

    try {
      let caughtError: unknown;
      try {
        await orderService.createOrder(
          { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
          { items: [{ productId: productA.id, quantity: 2 }] },
        );
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(Error);
      const errMsg = (caughtError as Error).message;
      expect(errMsg).toContain('compensating inventory release also partially failed');
      expect(errMsg).toContain('Order persistence constraint failure');
      expect(
        (caughtError as unknown as { rollbackFailures: unknown[] }).rollbackFailures.length,
      ).toBeGreaterThan(0);
    } finally {
      inventoryService.releaseStock = originalRelease;
      orderRepo.create = originalCreate;
    }
  });

  it('consumes reserved stock on FULFILLED transition via InventoryService abstraction', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: productA.id, quantity: 4 }] },
    );

    let avail = await inventoryService.getAvailability(sellerContext, productA.id);
    expect(avail.quantityOnHand).toBe(10);
    expect(avail.quantityReserved).toBe(4);
    expect(avail.availableQuantity).toBe(6);

    await orderService.transitionStatus(sellerContext, order.id, 'PAID');
    await orderService.transitionStatus(sellerContext, order.id, 'PROCESSING');
    await orderService.transitionStatus(sellerContext, order.id, 'FULFILLED');

    // Upon fulfillment, stock is physically consumed: onHand drops from 10 to 6, reserved drops from 4 to 0
    avail = await inventoryService.getAvailability(sellerContext, productA.id);
    expect(avail.quantityOnHand).toBe(6);
    expect(avail.quantityReserved).toBe(0);
    expect(avail.availableQuantity).toBe(6);
  });
});

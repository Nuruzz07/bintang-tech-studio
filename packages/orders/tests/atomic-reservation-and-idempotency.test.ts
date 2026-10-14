import { describe, it, expect, vi } from 'vitest';
import {
  OrderService,
  InMemoryOrderRepository,
  InMemoryCustomerRepository,
  InMemoryIdempotencyRepository,
  OrderRepository,
  IdempotencyRepository,
  Order,
  OrderItem,
  OrderWithItems,
  OrderCaller,
  IdempotencyInFlightError,
} from '../src/index.js';
import { Product, InMemoryProductRepository } from '@bintang/commerce';
import { InventoryService, InMemoryInventoryRepository } from '@bintang/inventory';
import { AuthorizationService, InMemoryEntitlementResolver } from '@bintang/authorization';
import { createAuthenticatedStoreContext } from '@bintang/tenancy';

describe('OrderService - Unified Atomic Stock Reservation & Idempotency Leases', () => {
  const storeId = 'store_test_atomic_01';
  const customerId = 'cust_test_atomic_01';

  const sellerContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_merchant_01',
    membershipId: 'mem_01',
    role: 'STORE_OWNER',
  });

  const caller: OrderCaller = {
    type: 'SELLER',
    context: sellerContext,
  };

  async function setupFixture(options?: {
    customOrderRepo?: OrderRepository;
    customIdempotencyRepo?: IdempotencyRepository;
  }) {
    const customerRepo = new InMemoryCustomerRepository();
    await customerRepo.create(storeId, {
      id: customerId,
      storeId,
      name: 'Test Customer',
      email: 'test@customer.com',
      phone: null,
      telegramId: null,
      whatsappNumber: null,
      totalOrders: 0,
      totalSpent: '0.00',
      lastOrderAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {},
    });

    const productRepo = new InMemoryProductRepository();
    const product: Product = {
      id: 'prod_atomic_01',
      storeId,
      categoryId: null,
      name: 'License Pro',
      slug: 'license-pro',
      description: 'Pro license',
      price: '100000.00',
      stockMode: 'TRACKED',
      status: 'ACTIVE',
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await productRepo.create(storeId, product);

    const authService = new AuthorizationService({
      entitlementResolver: new InMemoryEntitlementResolver(),
    });

    const inventoryRepo = new InMemoryInventoryRepository();
    const inventoryService = new InventoryService({
      inventoryRepository: inventoryRepo,
      productRepository: productRepo,
      authorizationService: authService,
    });

    await inventoryService.adjustStock(sellerContext, product.id, {
      type: 'INCREASE',
      quantity: 50,
      reason: 'Initial test stock',
    });

    const orderRepo = options?.customOrderRepo ?? new InMemoryOrderRepository();
    const idempotencyRepo = options?.customIdempotencyRepo ?? new InMemoryIdempotencyRepository();

    const orderService = new OrderService({
      orderRepository: orderRepo,
      customerRepository: customerRepo,
      productRepository: productRepo,
      inventoryService,
      authorizationService: authService,
      idempotencyRepository: idempotencyRepo,
    });

    return {
      orderService,
      inventoryService,
      orderRepo,
      product,
    };
  }

  it('delegates stock reservation to orderRepo when supportsAtomicStockReservation is true', async () => {
    let capturedReserveStockArg: boolean | undefined;
    const mockOrderRepo: OrderRepository = {
      supportsAtomicStockReservation: true,
      create: vi
        .fn()
        .mockImplementation(
          async (
            sId: string,
            order: Order,
            items: readonly OrderItem[],
            reserveStock?: boolean,
          ): Promise<OrderWithItems> => {
            capturedReserveStockArg = reserveStock;
            return {
              ...order,
              items,
            };
          },
        ),
      findById: vi.fn().mockResolvedValue(null),
      findByOrderNumber: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([]),
      listByCustomerId: vi.fn().mockResolvedValue([]),
      updateStatus: vi.fn(),
    };

    const fixture = await setupFixture({ customOrderRepo: mockOrderRepo });
    const reserveStockSpy = vi.spyOn(fixture.inventoryService, 'reserveStock');

    const created = await fixture.orderService.createOrder(caller, {
      customerId,
      items: [{ productId: fixture.product.id, quantity: 2 }],
    });

    expect(created).toBeDefined();
    expect(capturedReserveStockArg).toBe(true);
    // Crucial check: inventoryService.reserveStock MUST NOT be called separately because the DB handles it!
    expect(reserveStockSpy).not.toHaveBeenCalled();
  });

  it('falls back to application pre-reservation and rollback when supportsAtomicStockReservation is false/in-memory', async () => {
    const fixture = await setupFixture();
    const reserveStockSpy = vi.spyOn(fixture.inventoryService, 'reserveStock');

    const created = await fixture.orderService.createOrder(caller, {
      customerId,
      items: [{ productId: fixture.product.id, quantity: 2 }],
    });

    expect(created).toBeDefined();
    // In-memory repo has supportsAtomicStockReservation = undefined/false, so pre-reservation is executed
    expect(reserveStockSpy).toHaveBeenCalledTimes(1);

    // Verify stock was tracked in inventory service
    const avail = await fixture.inventoryService.getAvailability(sellerContext, fixture.product.id);
    expect(avail.quantityReserved).toBe(2);
    expect(avail.availableQuantity).toBe(48);
  });

  it('supports lease-based acquire() idempotency and returns cached response for completed duplicate requests', async () => {
    let acquireCalled = false;
    let setCalled = false;

    const customIdemp: IdempotencyRepository = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockImplementation(async () => {
        setCalled = true;
      }),
      acquire: vi.fn().mockImplementation(async () => {
        acquireCalled = true;
        return { acquired: true };
      }),
    };

    const fixture = await setupFixture({ customIdempotencyRepo: customIdemp });

    const order = await fixture.orderService.createOrder(caller, {
      customerId,
      idempotencyKey: 'key-atomic-001',
      items: [{ productId: fixture.product.id, quantity: 1 }],
    });

    expect(order).toBeDefined();
    expect(acquireCalled).toBe(true);
    expect(setCalled).toBe(true);
  });

  it('rejects in-flight concurrent requests when acquire() reports in-flight status', async () => {
    const customIdemp: IdempotencyRepository = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
      acquire: vi.fn().mockImplementation(async () => {
        throw new IdempotencyInFlightError(
          'Request with idempotency key "in-flight-key" is currently being processed',
        );
      }),
    };

    const fixture = await setupFixture({ customIdempotencyRepo: customIdemp });

    await expect(
      fixture.orderService.createOrder(caller, {
        customerId,
        idempotencyKey: 'in-flight-key',
        items: [{ productId: fixture.product.id, quantity: 1 }],
      }),
    ).rejects.toThrow(IdempotencyInFlightError);
  });

  it('invokes fail() on idempotencyRepo if order creation fails during processing', async () => {
    let failCalledWithKey = '';

    const customIdemp: IdempotencyRepository = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
      acquire: vi.fn().mockResolvedValue({ acquired: true }),
      fail: vi.fn().mockImplementation(async (_sId: string, _aId: string, key: string) => {
        failCalledWithKey = key;
      }),
    };

    const failingOrderRepo: OrderRepository = {
      supportsAtomicStockReservation: false,
      create: vi.fn().mockRejectedValue(new Error('Simulated database write crash')),
      findById: vi.fn().mockResolvedValue(null),
      findByOrderNumber: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([]),
      listByCustomerId: vi.fn().mockResolvedValue([]),
      updateStatus: vi.fn(),
    };

    const fixture = await setupFixture({
      customOrderRepo: failingOrderRepo,
      customIdempotencyRepo: customIdemp,
    });

    await expect(
      fixture.orderService.createOrder(caller, {
        customerId,
        idempotencyKey: 'fail-recovery-key',
        items: [{ productId: fixture.product.id, quantity: 1 }],
      }),
    ).rejects.toThrow('Simulated database write crash');

    expect(failCalledWithKey).toBe('fail-recovery-key');
  });
});

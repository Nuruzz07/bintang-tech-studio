import { describe, it, expect, beforeEach } from 'vitest';
import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import { AuthorizationService, InMemoryEntitlementResolver } from '@bintang/authorization';
import { InMemoryProductRepository, Product } from '@bintang/commerce';
import {
  InventoryService,
  InMemoryInventoryRepository,
  InsufficientStockError,
} from '../src/index.js';

describe('M06 Inventory Concurrency & Race-Condition Suite', () => {
  let inventoryRepo: InMemoryInventoryRepository;
  let productRepo: InMemoryProductRepository;
  let authService: AuthorizationService;
  let inventoryService: InventoryService;

  const storeId = 'store_test_m06_concurrency';
  const ownerContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_owner',
    membershipId: 'mem_owner',
    role: 'STORE_OWNER',
  });

  const product: Product = {
    id: 'prod_hot_item_01',
    storeId,
    categoryId: null,
    name: 'Flash Sale Limited Voucher',
    slug: 'flash-sale-limited-voucher',
    description: null,
    productType: 'DIGITAL',
    price: 1000,
    compareAtPrice: null,
    stockMode: 'TRACKED',
    status: 'ACTIVE',
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    inventoryRepo = new InMemoryInventoryRepository();
    productRepo = new InMemoryProductRepository();
    authService = new AuthorizationService(new InMemoryEntitlementResolver());
    inventoryService = new InventoryService({
      inventoryRepository: inventoryRepo,
      productRepository: productRepo,
      authorizationService: authService,
    });

    await productRepo.create(storeId, product);
  });

  it('guarantees zero race conditions during simultaneous concurrent reservations', async () => {
    // Exact initial stock: 10 units available
    await inventoryService.initializeInventory(ownerContext, product.id, 10);

    // Simulate 25 simultaneous concurrent checkout requests, each requesting 1 unit
    const concurrency = 25;
    const promises = Array.from({ length: concurrency }).map((_, idx) =>
      inventoryService
        .reserveStock(ownerContext, product.id, {
          amount: 1,
          orderId: `ord_concurrent_${idx}`,
        })
        .then(() => ({ success: true }))
        .catch((err) => ({ success: false, error: err })),
    );

    const results = await Promise.all(promises);

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    // Exactly 10 must succeed, and exactly 15 must fail
    expect(successes.length).toBe(10);
    expect(failures.length).toBe(15);

    // Every failure must be InsufficientStockError
    for (const fail of failures) {
      expect((fail as { error: unknown }).error).toBeInstanceOf(InsufficientStockError);
    }

    // Verify aggregate integrity in repository
    const finalInv = await inventoryService.getInventory(ownerContext, product.id);
    expect(finalInv.quantityOnHand).toBe(10);
    expect(finalInv.quantityReserved).toBe(10);

    const avail = await inventoryService.getAvailability(ownerContext, product.id);
    expect(avail.availableQuantity).toBe(0);
    expect(avail.isAvailable).toBe(false);
  });

  it('maintains mathematical invariants during concurrent mixed reservations and releases', async () => {
    await inventoryService.initializeInventory(ownerContext, product.id, 50);

    // Reserve 20 first
    await inventoryService.reserveStock(ownerContext, product.id, { amount: 20 });
    // onHand = 50, reserved = 20, available = 30

    // Fire 10 concurrent requests: 5 reserve 4 units, 5 release 2 units
    const actions: Promise<unknown>[] = [];

    for (let i = 0; i < 5; i++) {
      actions.push(inventoryService.reserveStock(ownerContext, product.id, { amount: 4 }));
      actions.push(inventoryService.releaseStock(ownerContext, product.id, { amount: 2 }));
    }

    await Promise.all(actions);

    const finalInv = await inventoryService.getInventory(ownerContext, product.id);
    // reserved started at 20 + (5 * 4 = 20) - (5 * 2 = 10) = 30
    expect(finalInv.quantityOnHand).toBe(50);
    expect(finalInv.quantityReserved).toBe(30);

    const avail = await inventoryService.getAvailability(ownerContext, product.id);
    expect(avail.availableQuantity).toBe(20);
    expect(avail.isAvailable).toBe(true);
  });

  it('guarantees consistency during concurrent direct consumptions', async () => {
    await inventoryService.initializeInventory(ownerContext, product.id, 15);

    // 20 concurrent attempts to consume 1 available unit
    const promises = Array.from({ length: 20 }).map(() =>
      inventoryService
        .consumeAvailable(ownerContext, product.id, 1)
        .then(() => ({ success: true }))
        .catch((err) => ({ success: false, error: err })),
    );

    const results = await Promise.all(promises);
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    expect(successes.length).toBe(15);
    expect(failures.length).toBe(5);

    const finalInv = await inventoryService.getInventory(ownerContext, product.id);
    expect(finalInv.quantityOnHand).toBe(0);
    expect(finalInv.quantityReserved).toBe(0);
  });
});

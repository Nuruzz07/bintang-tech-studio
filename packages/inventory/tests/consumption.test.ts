import { describe, it, expect, beforeEach } from 'vitest';
import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import { AuthorizationService, InMemoryEntitlementResolver } from '@bintang/authorization';
import { InMemoryProductRepository, Product } from '@bintang/commerce';
import {
  InventoryService,
  InMemoryInventoryRepository,
  InsufficientStockError,
} from '../src/index.js';

describe('M06 Inventory Consumption Foundation Suite', () => {
  let inventoryRepo: InMemoryInventoryRepository;
  let productRepo: InMemoryProductRepository;
  let authService: AuthorizationService;
  let inventoryService: InventoryService;

  const storeId = 'store_test_m06_consume';
  const ownerContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_owner',
    membershipId: 'mem_owner',
    role: 'STORE_OWNER',
  });

  const trackedProduct: Product = {
    id: 'prod_tracked_consume',
    storeId,
    categoryId: null,
    name: 'Steam Wallet $10',
    slug: 'steam-wallet-10',
    description: null,
    productType: 'DIGITAL',
    price: 160000,
    compareAtPrice: null,
    stockMode: 'TRACKED',
    status: 'ACTIVE',
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const unlimitedProduct: Product = {
    id: 'prod_unlimited_consume',
    storeId,
    categoryId: null,
    name: 'Unlimited E-Book Download',
    slug: 'unlimited-ebook-download',
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
    inventoryRepo = new InMemoryInventoryRepository();
    productRepo = new InMemoryProductRepository();
    authService = new AuthorizationService(new InMemoryEntitlementResolver());
    inventoryService = new InventoryService({
      inventoryRepository: inventoryRepo,
      productRepository: productRepo,
      authorizationService: authService,
    });

    await productRepo.create(storeId, trackedProduct);
    await productRepo.create(storeId, unlimitedProduct);
    await inventoryService.initializeInventory(ownerContext, trackedProduct.id, 50);
  });

  it('consumes stock from previously reserved quantity (consumeReserved)', async () => {
    // 1. Reserve 15 units out of 50
    await inventoryService.reserveStock(ownerContext, trackedProduct.id, { amount: 15 });

    // 2. Consume 10 units from reservation
    const consumed = await inventoryService.consumeReserved(
      ownerContext,
      trackedProduct.id,
      10,
      'ord_paid_001',
    );

    // onHand: 50 - 10 = 40; reserved: 15 - 10 = 5; available: 40 - 5 = 35
    expect(consumed.quantityOnHand).toBe(40);
    expect(consumed.quantityReserved).toBe(5);

    const avail = await inventoryService.getAvailability(ownerContext, trackedProduct.id);
    expect(avail.availableQuantity).toBe(35);
  });

  it('consumes stock directly from available inventory without reservation (consumeAvailable)', async () => {
    // 1. Reserve 10 units out of 50 (available = 40)
    await inventoryService.reserveStock(ownerContext, trackedProduct.id, { amount: 10 });

    // 2. Direct consume 20 units
    const consumed = await inventoryService.consumeAvailable(
      ownerContext,
      trackedProduct.id,
      20,
      'ord_direct_pos',
    );

    // onHand: 50 - 20 = 30; reserved remains 10; available: 30 - 10 = 20
    expect(consumed.quantityOnHand).toBe(30);
    expect(consumed.quantityReserved).toBe(10);

    const avail = await inventoryService.getAvailability(ownerContext, trackedProduct.id);
    expect(avail.availableQuantity).toBe(20);
  });

  it('rejects consumeReserved when requested amount exceeds quantityReserved', async () => {
    await inventoryService.reserveStock(ownerContext, trackedProduct.id, { amount: 5 });

    await expect(
      inventoryService.consumeReserved(ownerContext, trackedProduct.id, 6),
    ).rejects.toThrow(InsufficientStockError);

    const inv = await inventoryService.getInventory(ownerContext, trackedProduct.id);
    expect(inv.quantityOnHand).toBe(50);
    expect(inv.quantityReserved).toBe(5);
  });

  it('rejects consumeAvailable when requested amount exceeds available quantity', async () => {
    // 50 onHand, reserve 45 -> 5 available
    await inventoryService.reserveStock(ownerContext, trackedProduct.id, { amount: 45 });

    await expect(
      inventoryService.consumeAvailable(ownerContext, trackedProduct.id, 6),
    ).rejects.toThrow(InsufficientStockError);

    const inv = await inventoryService.getInventory(ownerContext, trackedProduct.id);
    expect(inv.quantityOnHand).toBe(50);
    expect(inv.quantityReserved).toBe(45);
  });

  it('permits consumption on UNLIMITED products without depleting stock', async () => {
    const res = await inventoryService.consumeAvailable(ownerContext, unlimitedProduct.id, 100);
    expect(res).toBeDefined();

    const avail = await inventoryService.getAvailability(ownerContext, unlimitedProduct.id);
    expect(avail.availableQuantity).toBe(Number.POSITIVE_INFINITY);
  });

  it('executes full checkout fulfillment lifecycle with zero stock leaks', async () => {
    // Initial: 50 onHand, 0 reserved
    // Step 1: Customer A reserves 20 items at checkout
    await inventoryService.reserveStock(ownerContext, trackedProduct.id, { amount: 20 });

    // Step 2: Customer B purchases 10 items directly (e.g. quick buy)
    await inventoryService.consumeAvailable(ownerContext, trackedProduct.id, 10);
    // onHand = 40, reserved = 20, available = 20

    // Step 3: Customer A pays 15 items and cancels 5 items
    await inventoryService.consumeReserved(ownerContext, trackedProduct.id, 15);
    // onHand = 25, reserved = 5, available = 20
    await inventoryService.releaseStock(ownerContext, trackedProduct.id, { amount: 5 });
    // onHand = 25, reserved = 0, available = 25

    const finalInv = await inventoryService.getInventory(ownerContext, trackedProduct.id);
    expect(finalInv.quantityOnHand).toBe(25);
    expect(finalInv.quantityReserved).toBe(0);

    const finalAvail = await inventoryService.getAvailability(ownerContext, trackedProduct.id);
    expect(finalAvail.availableQuantity).toBe(25);
    expect(finalAvail.isAvailable).toBe(true);
  });
});

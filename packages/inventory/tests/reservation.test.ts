import { describe, it, expect, beforeEach } from 'vitest';
import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import { AuthorizationService, InMemoryEntitlementResolver } from '@bintang/authorization';
import { InMemoryProductRepository, Product } from '@bintang/commerce';
import {
  InventoryService,
  InMemoryInventoryRepository,
  InsufficientStockError,
  InvalidReservationError,
} from '../src/index.js';

describe('M06 Inventory Reservation & Release Suite', () => {
  let inventoryRepo: InMemoryInventoryRepository;
  let productRepo: InMemoryProductRepository;
  let authService: AuthorizationService;
  let inventoryService: InventoryService;

  const storeId = 'store_test_m06_reserve';
  const ownerContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_owner',
    membershipId: 'mem_owner',
    role: 'STORE_OWNER',
  });

  const trackedProduct: Product = {
    id: 'prod_tracked_reserve',
    storeId,
    categoryId: null,
    name: 'Spotify Premium 3 Months',
    slug: 'spotify-premium-3-months',
    description: null,
    productType: 'DIGITAL',
    price: 60000,
    compareAtPrice: null,
    stockMode: 'TRACKED',
    status: 'ACTIVE',
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const unlimitedProduct: Product = {
    id: 'prod_unlimited_reserve',
    storeId,
    categoryId: null,
    name: 'Online Masterclass',
    slug: 'online-masterclass',
    description: null,
    productType: 'SERVICE',
    price: 500000,
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
    await inventoryService.initializeInventory(ownerContext, trackedProduct.id, 20);
  });

  it('atomically reserves stock within available limits', async () => {
    const inv = await inventoryService.reserveStock(ownerContext, trackedProduct.id, {
      amount: 5,
      orderId: 'ord_123',
    });

    expect(inv.quantityOnHand).toBe(20);
    expect(inv.quantityReserved).toBe(5);

    const avail = await inventoryService.getAvailability(ownerContext, trackedProduct.id);
    expect(avail.availableQuantity).toBe(15);
    expect(avail.isAvailable).toBe(true);
  });

  it('allows reservation up to exact available stock level', async () => {
    await inventoryService.reserveStock(ownerContext, trackedProduct.id, { amount: 20 });

    const avail = await inventoryService.getAvailability(ownerContext, trackedProduct.id);
    expect(avail.quantityOnHand).toBe(20);
    expect(avail.quantityReserved).toBe(20);
    expect(avail.availableQuantity).toBe(0);
    expect(avail.isAvailable).toBe(false);
  });

  it('rejects reservation exceeding available stock with InsufficientStockError', async () => {
    await inventoryService.reserveStock(ownerContext, trackedProduct.id, { amount: 15 });

    // Available is now 5. Requesting 6 must fail.
    await expect(
      inventoryService.reserveStock(ownerContext, trackedProduct.id, { amount: 6 }),
    ).rejects.toThrow(InsufficientStockError);

    // Verify state was not modified
    const inv = await inventoryService.getInventory(ownerContext, trackedProduct.id);
    expect(inv.quantityOnHand).toBe(20);
    expect(inv.quantityReserved).toBe(15);
  });

  it('atomically releases reserved stock and restores availability', async () => {
    await inventoryService.reserveStock(ownerContext, trackedProduct.id, { amount: 8 });

    const released = await inventoryService.releaseStock(ownerContext, trackedProduct.id, {
      amount: 5,
      orderId: 'ord_cancelled',
    });

    expect(released.quantityOnHand).toBe(20);
    expect(released.quantityReserved).toBe(3);

    const avail = await inventoryService.getAvailability(ownerContext, trackedProduct.id);
    expect(avail.availableQuantity).toBe(17);
  });

  it('rejects release amount exceeding currently reserved quantity', async () => {
    await inventoryService.reserveStock(ownerContext, trackedProduct.id, { amount: 4 });

    await expect(
      inventoryService.releaseStock(ownerContext, trackedProduct.id, { amount: 5 }),
    ).rejects.toThrow(InvalidReservationError);

    const inv = await inventoryService.getInventory(ownerContext, trackedProduct.id);
    expect(inv.quantityReserved).toBe(4);
  });

  it('handles reservation and release on UNLIMITED product as non-depleting no-op', async () => {
    const res = await inventoryService.reserveStock(ownerContext, unlimitedProduct.id, {
      amount: 100,
    });
    expect(res).toBeDefined();

    const avail = await inventoryService.getAvailability(ownerContext, unlimitedProduct.id);
    expect(avail.availableQuantity).toBe(Number.POSITIVE_INFINITY);
    expect(avail.isAvailable).toBe(true);

    const rel = await inventoryService.releaseStock(ownerContext, unlimitedProduct.id, {
      amount: 100,
    });
    expect(rel).toBeDefined();
  });

  it('preserves invariants over complex sequence of reserves and releases', async () => {
    // 20 on hand
    await inventoryService.reserveStock(ownerContext, trackedProduct.id, { amount: 10 }); // reserved: 10
    await inventoryService.reserveStock(ownerContext, trackedProduct.id, { amount: 5 }); // reserved: 15
    await inventoryService.releaseStock(ownerContext, trackedProduct.id, { amount: 7 }); // reserved: 8
    await inventoryService.reserveStock(ownerContext, trackedProduct.id, { amount: 12 }); // reserved: 20
    await inventoryService.releaseStock(ownerContext, trackedProduct.id, { amount: 20 }); // reserved: 0

    const finalInv = await inventoryService.getInventory(ownerContext, trackedProduct.id);
    expect(finalInv.quantityOnHand).toBe(20);
    expect(finalInv.quantityReserved).toBe(0);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import { AuthorizationService, InMemoryEntitlementResolver } from '@bintang/authorization';
import { InMemoryProductRepository, Product } from '@bintang/commerce';
import {
  InventoryService,
  InMemoryInventoryRepository,
  InvalidQuantityError,
  NegativeStockError,
  InventoryInvariantError,
  UnsupportedStockModeError,
  validateInventoryInvariants,
  validateQuantity,
  validatePositiveAmount,
} from '../src/index.js';

describe('M06 Inventory Domain Foundation Suite', () => {
  let inventoryRepo: InMemoryInventoryRepository;
  let productRepo: InMemoryProductRepository;
  let authService: AuthorizationService;
  let inventoryService: InventoryService;

  const storeId = 'store_test_m06_domain';
  const ownerContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_owner',
    membershipId: 'mem_owner',
    role: 'STORE_OWNER',
  });

  const trackedProduct: Product = {
    id: 'prod_tracked_01',
    storeId,
    categoryId: null,
    name: 'Netflix 1 Month',
    slug: 'netflix-1-month',
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

  const unlimitedProduct: Product = {
    id: 'prod_unlimited_01',
    storeId,
    categoryId: null,
    name: 'Consultation Service',
    slug: 'consultation-service',
    description: null,
    productType: 'SERVICE',
    price: 150000,
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
  });

  describe('Invariant Rules & Mathematical Constraints', () => {
    it('validates legal inventory quantities (on_hand >= 0, reserved >= 0, reserved <= on_hand)', () => {
      expect(() => validateInventoryInvariants(10, 0)).not.toThrow();
      expect(() => validateInventoryInvariants(10, 5)).not.toThrow();
      expect(() => validateInventoryInvariants(10, 10)).not.toThrow();
      expect(() => validateInventoryInvariants(0, 0)).not.toThrow();
    });

    it('rejects negative quantity on hand with NegativeStockError', () => {
      expect(() => validateInventoryInvariants(-1, 0)).toThrow(NegativeStockError);
      expect(() => validateInventoryInvariants(-5, 0)).toThrow('quantityOnHand cannot be negative');
    });

    it('rejects negative quantity reserved with NegativeStockError', () => {
      expect(() => validateInventoryInvariants(10, -1)).toThrow(NegativeStockError);
      expect(() => validateInventoryInvariants(10, -3)).toThrow(
        'quantityReserved cannot be negative',
      );
    });

    it('rejects reserved quantity exceeding quantity on hand with InventoryInvariantError', () => {
      expect(() => validateInventoryInvariants(10, 11)).toThrow(InventoryInvariantError);
      expect(() => validateInventoryInvariants(5, 6)).toThrow(
        'quantityReserved (6) cannot exceed quantityOnHand (5)',
      );
    });

    it('rejects non-integer quantities in validation with InvalidQuantityError', () => {
      expect(() => validateQuantity(1.5, 'stock')).toThrow(InvalidQuantityError);
      expect(() => validateQuantity(NaN, 'stock')).toThrow(InvalidQuantityError);
      expect(() => validateQuantity(-1, 'stock')).toThrow(NegativeStockError);
    });

    it('rejects non-positive amounts in validatePositiveAmount', () => {
      expect(() => validatePositiveAmount(0, 'amount')).toThrow(InvalidQuantityError);
      expect(() => validatePositiveAmount(-5, 'amount')).toThrow(NegativeStockError);
      expect(() => validatePositiveAmount(10, 'amount')).not.toThrow();
    });
  });

  describe('Stock Mode Evaluation & Availability', () => {
    it('evaluates TRACKED product with zero initial stock as unavailable', async () => {
      const avail = await inventoryService.getAvailability(ownerContext, trackedProduct.id);
      expect(avail.stockMode).toBe('TRACKED');
      expect(avail.quantityOnHand).toBe(0);
      expect(avail.quantityReserved).toBe(0);
      expect(avail.availableQuantity).toBe(0);
      expect(avail.isAvailable).toBe(false);
    });

    it('evaluates TRACKED product with stock as available', async () => {
      await inventoryService.initializeInventory(ownerContext, trackedProduct.id, 25);
      const avail = await inventoryService.getAvailability(ownerContext, trackedProduct.id);
      expect(avail.stockMode).toBe('TRACKED');
      expect(avail.quantityOnHand).toBe(25);
      expect(avail.quantityReserved).toBe(0);
      expect(avail.availableQuantity).toBe(25);
      expect(avail.isAvailable).toBe(true);
    });

    it('evaluates UNLIMITED product with infinite availability', async () => {
      const avail = await inventoryService.getAvailability(ownerContext, unlimitedProduct.id);
      expect(avail.stockMode).toBe('UNLIMITED');
      expect(avail.availableQuantity).toBe(Number.POSITIVE_INFINITY);
      expect(avail.isAvailable).toBe(true);
    });
  });

  describe('Stock Adjustment Operations', () => {
    it('initializes inventory and performs INCREASE adjustment', async () => {
      const inv = await inventoryService.initializeInventory(ownerContext, trackedProduct.id, 10);
      expect(inv.quantityOnHand).toBe(10);
      expect(inv.quantityReserved).toBe(0);

      const adjusted = await inventoryService.adjustStock(ownerContext, trackedProduct.id, {
        type: 'INCREASE',
        quantity: 15,
        reason: 'Restock shipment',
      });
      expect(adjusted.quantityOnHand).toBe(25);
      expect(adjusted.quantityReserved).toBe(0);
    });

    it('performs DECREASE adjustment down to valid positive levels', async () => {
      await inventoryService.initializeInventory(ownerContext, trackedProduct.id, 50);
      const adjusted = await inventoryService.adjustStock(ownerContext, trackedProduct.id, {
        type: 'DECREASE',
        quantity: 20,
        reason: 'Inventory audit write-off',
      });
      expect(adjusted.quantityOnHand).toBe(30);
    });

    it('performs SET adjustment to explicit quantity', async () => {
      await inventoryService.initializeInventory(ownerContext, trackedProduct.id, 50);
      const adjusted = await inventoryService.adjustStock(ownerContext, trackedProduct.id, {
        type: 'SET',
        quantity: 12,
        reason: 'Physical count adjustment',
      });
      expect(adjusted.quantityOnHand).toBe(12);
    });

    it('rejects DECREASE adjustment that violates non-negative invariant', async () => {
      await inventoryService.initializeInventory(ownerContext, trackedProduct.id, 10);
      await expect(
        inventoryService.adjustStock(ownerContext, trackedProduct.id, {
          type: 'DECREASE',
          quantity: 15,
        }),
      ).rejects.toThrow(NegativeStockError);
    });

    it('rejects DECREASE adjustment below currently reserved quantity', async () => {
      await inventoryService.initializeInventory(ownerContext, trackedProduct.id, 20);
      await inventoryService.reserveStock(ownerContext, trackedProduct.id, { amount: 15 });

      // Trying to decrease by 10 would leave onHand = 10, but reserved = 15 -> invariant violation!
      await expect(
        inventoryService.adjustStock(ownerContext, trackedProduct.id, {
          type: 'DECREASE',
          quantity: 10,
        }),
      ).rejects.toThrow(InventoryInvariantError);
    });

    it('rejects SET adjustment below currently reserved quantity', async () => {
      await inventoryService.initializeInventory(ownerContext, trackedProduct.id, 20);
      await inventoryService.reserveStock(ownerContext, trackedProduct.id, { amount: 15 });

      // Trying to set onHand to 10 when reserved is 15 -> invariant violation!
      await expect(
        inventoryService.adjustStock(ownerContext, trackedProduct.id, {
          type: 'SET',
          quantity: 10,
        }),
      ).rejects.toThrow(InventoryInvariantError);
    });

    it('prohibits stock adjustment for UNLIMITED stockMode products', async () => {
      await expect(
        inventoryService.adjustStock(ownerContext, unlimitedProduct.id, {
          type: 'INCREASE',
          quantity: 10,
        }),
      ).rejects.toThrow(UnsupportedStockModeError);
    });
  });
});

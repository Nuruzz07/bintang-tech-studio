import { describe, it, expect, beforeEach } from 'vitest';
import { createAuthenticatedStoreContext, createStoreContext } from '@bintang/tenancy';
import {
  AuthorizationService,
  InMemoryEntitlementResolver,
  PermissionDeniedError,
  UnauthenticatedError,
} from '@bintang/authorization';
import { InMemoryProductRepository, Product } from '@bintang/commerce';
import { InventoryService, InMemoryInventoryRepository } from '../src/index.js';

describe('M06 Inventory Authorization Integration Suite', () => {
  let inventoryRepo: InMemoryInventoryRepository;
  let productRepo: InMemoryProductRepository;
  let authService: AuthorizationService;
  let inventoryService: InventoryService;

  const storeId = 'store_test_m06_auth';

  const ownerContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_owner',
    membershipId: 'mem_owner',
    role: 'STORE_OWNER',
  });

  const adminContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_admin',
    membershipId: 'mem_admin',
    role: 'STORE_ADMIN',
  });

  const staffContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_staff',
    membershipId: 'mem_staff',
    role: 'STORE_STAFF',
  });

  const unauthenticatedContext = createStoreContext({
    storeId,
  });

  const product: Product = {
    id: 'prod_auth_01',
    storeId,
    categoryId: null,
    name: 'Xbox Game Pass Ultimate',
    slug: 'xbox-game-pass-ultimate',
    description: null,
    productType: 'DIGITAL',
    price: 120000,
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
    await inventoryService.initializeInventory(ownerContext, product.id, 100);
  });

  describe('STORE_OWNER Role Permissions', () => {
    it('allows STORE_OWNER full read and mutation access to inventory', async () => {
      const inv = await inventoryService.getInventory(ownerContext, product.id);
      expect(inv.quantityOnHand).toBe(100);

      const adjusted = await inventoryService.adjustStock(ownerContext, product.id, {
        type: 'INCREASE',
        quantity: 10,
      });
      expect(adjusted.quantityOnHand).toBe(110);

      const reserved = await inventoryService.reserveStock(ownerContext, product.id, {
        amount: 5,
      });
      expect(reserved.quantityReserved).toBe(5);
    });
  });

  describe('STORE_ADMIN Role Permissions', () => {
    it('allows STORE_ADMIN full read and mutation access to inventory', async () => {
      const inv = await inventoryService.getInventory(adminContext, product.id);
      expect(inv.quantityOnHand).toBe(100);

      const adjusted = await inventoryService.adjustStock(adminContext, product.id, {
        type: 'INCREASE',
        quantity: 20,
      });
      expect(adjusted.quantityOnHand).toBe(120);

      const reserved = await inventoryService.reserveStock(adminContext, product.id, {
        amount: 10,
      });
      expect(reserved.quantityReserved).toBe(10);
    });
  });

  describe('STORE_STAFF Role Restrictions (Read-Only)', () => {
    it('allows STORE_STAFF to read inventory levels and availability', async () => {
      const inv = await inventoryService.getInventory(staffContext, product.id);
      expect(inv.quantityOnHand).toBe(100);

      const avail = await inventoryService.getAvailability(staffContext, product.id);
      expect(avail.availableQuantity).toBe(100);

      const list = await inventoryService.listInventory(staffContext);
      expect(list.length).toBe(1);
    });

    it('denies STORE_STAFF from initializing inventory with PermissionDeniedError', async () => {
      await expect(
        inventoryService.initializeInventory(staffContext, product.id, 50),
      ).rejects.toThrow(PermissionDeniedError);
    });

    it('denies STORE_STAFF from adjusting stock with PermissionDeniedError', async () => {
      await expect(
        inventoryService.adjustStock(staffContext, product.id, {
          type: 'INCREASE',
          quantity: 10,
        }),
      ).rejects.toThrow(PermissionDeniedError);
    });

    it('denies STORE_STAFF from reserving stock with PermissionDeniedError', async () => {
      await expect(
        inventoryService.reserveStock(staffContext, product.id, { amount: 5 }),
      ).rejects.toThrow(PermissionDeniedError);
    });

    it('denies STORE_STAFF from releasing stock with PermissionDeniedError', async () => {
      await expect(
        inventoryService.releaseStock(staffContext, product.id, { amount: 5 }),
      ).rejects.toThrow(PermissionDeniedError);
    });

    it('denies STORE_STAFF from consuming stock with PermissionDeniedError', async () => {
      await expect(
        inventoryService.consumeStock(staffContext, product.id, {
          amount: 5,
          fromReserved: false,
        }),
      ).rejects.toThrow(PermissionDeniedError);
    });
  });

  describe('Unauthenticated & Context Safety', () => {
    it('denies unauthenticated context on read with UnauthenticatedError', async () => {
      await expect(
        inventoryService.getInventory(unauthenticatedContext, product.id),
      ).rejects.toThrow(UnauthenticatedError);
    });

    it('denies unauthenticated context on mutation with UnauthenticatedError', async () => {
      await expect(
        inventoryService.adjustStock(unauthenticatedContext, product.id, {
          type: 'INCREASE',
          quantity: 10,
        }),
      ).rejects.toThrow(UnauthenticatedError);
    });
  });
});

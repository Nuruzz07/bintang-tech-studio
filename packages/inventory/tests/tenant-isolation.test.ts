import { describe, it, expect, beforeEach } from 'vitest';
import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import { AuthorizationService, InMemoryEntitlementResolver } from '@bintang/authorization';
import { InMemoryProductRepository, Product } from '@bintang/commerce';
import {
  InventoryService,
  InMemoryInventoryRepository,
  CrossTenantInventoryError,
} from '../src/index.js';

describe('M06 Inventory Tenant Isolation Suite', () => {
  let inventoryRepo: InMemoryInventoryRepository;
  let productRepo: InMemoryProductRepository;
  let authService: AuthorizationService;
  let inventoryService: InventoryService;

  const storeA = 'store_tenant_alpha';
  const storeB = 'store_tenant_beta';

  const storeAContext = createAuthenticatedStoreContext({
    storeId: storeA,
    userId: 'user_alpha',
    membershipId: 'mem_alpha',
    role: 'STORE_OWNER',
  });

  const storeBContext = createAuthenticatedStoreContext({
    storeId: storeB,
    userId: 'user_beta',
    membershipId: 'mem_beta',
    role: 'STORE_OWNER',
  });

  const productA: Product = {
    id: 'prod_alpha_01',
    storeId: storeA,
    categoryId: null,
    name: 'Alpha Product',
    slug: 'alpha-product',
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
    id: 'prod_beta_01',
    storeId: storeB,
    categoryId: null,
    name: 'Beta Product',
    slug: 'beta-product',
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

  beforeEach(async () => {
    inventoryRepo = new InMemoryInventoryRepository();
    productRepo = new InMemoryProductRepository();
    authService = new AuthorizationService(new InMemoryEntitlementResolver());
    inventoryService = new InventoryService({
      inventoryRepository: inventoryRepo,
      productRepository: productRepo,
      authorizationService: authService,
    });

    await productRepo.create(storeA, productA);
    await productRepo.create(storeB, productB);

    await inventoryService.initializeInventory(storeAContext, productA.id, 50);
    await inventoryService.initializeInventory(storeBContext, productB.id, 100);
  });

  it('prevents Store A from reading Store B product inventory levels', async () => {
    await expect(inventoryService.getInventory(storeAContext, productB.id)).rejects.toThrow(
      CrossTenantInventoryError,
    );
  });

  it('prevents Store A from querying Store B availability', async () => {
    await expect(inventoryService.getAvailability(storeAContext, productB.id)).rejects.toThrow(
      CrossTenantInventoryError,
    );
  });

  it('prevents Store A from adjusting Store B inventory', async () => {
    await expect(
      inventoryService.adjustStock(storeAContext, productB.id, {
        type: 'INCREASE',
        quantity: 10,
      }),
    ).rejects.toThrow(CrossTenantInventoryError);
  });

  it('prevents Store A from reserving Store B inventory', async () => {
    await expect(
      inventoryService.reserveStock(storeAContext, productB.id, { amount: 5 }),
    ).rejects.toThrow(CrossTenantInventoryError);
  });

  it('prevents Store A from releasing Store B inventory', async () => {
    await expect(
      inventoryService.releaseStock(storeAContext, productB.id, { amount: 5 }),
    ).rejects.toThrow(CrossTenantInventoryError);
  });

  it('prevents Store A from consuming Store B inventory', async () => {
    await expect(
      inventoryService.consumeStock(storeAContext, productB.id, {
        amount: 5,
        fromReserved: false,
      }),
    ).rejects.toThrow(CrossTenantInventoryError);
  });

  it('isolates inventory lists so Store A only sees Store A inventory records', async () => {
    const listA = await inventoryService.listInventory(storeAContext);
    expect(listA.length).toBe(1);
    expect(listA[0]!.storeId).toBe(storeA);
    expect(listA[0]!.productId).toBe(productA.id);

    const listB = await inventoryService.listInventory(storeBContext);
    expect(listB.length).toBe(1);
    expect(listB[0]!.storeId).toBe(storeB);
    expect(listB[0]!.productId).toBe(productB.id);
  });
});

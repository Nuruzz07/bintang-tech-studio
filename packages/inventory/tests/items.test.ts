import { describe, it, expect, beforeEach } from 'vitest';
import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import { AuthorizationService, InMemoryEntitlementResolver } from '@bintang/authorization';
import { InMemoryProductRepository, Product } from '@bintang/commerce';
import {
  InventoryService,
  InMemoryInventoryRepository,
  InMemoryInventoryItemRepository,
  CrossTenantInventoryError,
} from '../src/index.js';

describe('M06 Inventory Items Foundation Suite (Digital Credentials)', () => {
  let inventoryRepo: InMemoryInventoryRepository;
  let itemRepo: InMemoryInventoryItemRepository;
  let productRepo: InMemoryProductRepository;
  let authService: AuthorizationService;
  let inventoryService: InventoryService;

  const storeId = 'store_test_m06_items';
  const ownerContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_owner',
    membershipId: 'mem_owner',
    role: 'STORE_OWNER',
  });

  const otherStoreContext = createAuthenticatedStoreContext({
    storeId: 'store_other',
    userId: 'user_other',
    membershipId: 'mem_other',
    role: 'STORE_OWNER',
  });

  const product: Product = {
    id: 'prod_license_keys',
    storeId,
    categoryId: null,
    name: 'Windows 11 Pro Retail Key',
    slug: 'windows-11-pro-retail-key',
    description: null,
    productType: 'DIGITAL',
    price: 250000,
    compareAtPrice: null,
    stockMode: 'TRACKED',
    status: 'ACTIVE',
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    inventoryRepo = new InMemoryInventoryRepository();
    itemRepo = new InMemoryInventoryItemRepository();
    productRepo = new InMemoryProductRepository();
    authService = new AuthorizationService(new InMemoryEntitlementResolver());
    inventoryService = new InventoryService({
      inventoryRepository: inventoryRepo,
      inventoryItemRepository: itemRepo,
      productRepository: productRepo,
      authorizationService: authService,
    });

    await productRepo.create(storeId, product);
    await inventoryService.initializeInventory(ownerContext, product.id, 0);
  });

  it('creates individual digital inventory items with AVAILABLE status', async () => {
    const item1 = await inventoryService.createInventoryItem(ownerContext, {
      productId: product.id,
      itemType: 'LICENSE_KEY',
      secretReference: 'vault:secret:win11-key-001',
      metadata: { edition: 'Pro', batch: '2026-Q1' },
    });

    expect(item1.id).toBeDefined();
    expect(item1.storeId).toBe(storeId);
    expect(item1.productId).toBe(product.id);
    expect(item1.status).toBe('AVAILABLE');
    expect(item1.secretReference).toBe('vault:secret:win11-key-001');

    const availableCount = await itemRepo.countByStatus(storeId, product.id, 'AVAILABLE');
    expect(availableCount).toBe(1);
  });

  it('progresses item through lifecycle: AVAILABLE -> RESERVED -> ASSIGNED', async () => {
    const item = await inventoryService.createInventoryItem(ownerContext, {
      productId: product.id,
      itemType: 'LICENSE_KEY',
      secretReference: 'vault:secret:win11-key-002',
    });

    // 1. Reserve item for an order
    const reserved = await inventoryService.updateInventoryItemStatus(
      ownerContext,
      item.id,
      'RESERVED',
      {
        reservedOrderId: 'ord_order_999',
        reservedAt: new Date().toISOString(),
      },
    );
    expect(reserved.status).toBe('RESERVED');
    expect(reserved.reservedOrderId).toBe('ord_order_999');

    // 2. Assign item upon payment completion
    const assigned = await inventoryService.updateInventoryItemStatus(
      ownerContext,
      item.id,
      'ASSIGNED',
      {
        assignedOrderId: 'ord_order_999',
        assignedAt: new Date().toISOString(),
      },
    );
    expect(assigned.status).toBe('ASSIGNED');
    expect(assigned.assignedOrderId).toBe('ord_order_999');

    const availableCount = await itemRepo.countByStatus(storeId, product.id, 'AVAILABLE');
    const assignedCount = await itemRepo.countByStatus(storeId, product.id, 'ASSIGNED');
    expect(availableCount).toBe(0);
    expect(assignedCount).toBe(1);
  });

  it('filters and lists items by status within store boundary', async () => {
    await inventoryService.createInventoryItem(ownerContext, {
      productId: product.id,
      itemType: 'LICENSE_KEY',
      secretReference: 'vault:secret:k1',
    });
    const item2 = await inventoryService.createInventoryItem(ownerContext, {
      productId: product.id,
      itemType: 'LICENSE_KEY',
      secretReference: 'vault:secret:k2',
    });
    await inventoryService.updateInventoryItemStatus(ownerContext, item2.id, 'EXPIRED');

    const availableList = await inventoryService.listInventoryItems(
      ownerContext,
      product.id,
      'AVAILABLE',
    );
    expect(availableList.length).toBe(1);

    const allList = await inventoryService.listInventoryItems(ownerContext, product.id);
    expect(allList.length).toBe(2);
  });

  it('enforces tenant boundary isolation when managing items', async () => {
    await expect(
      inventoryService.createInventoryItem(otherStoreContext, {
        productId: product.id,
        itemType: 'LICENSE_KEY',
        secretReference: 'vault:secret:steal',
      }),
    ).rejects.toThrow(CrossTenantInventoryError);

    await expect(
      inventoryService.listInventoryItems(otherStoreContext, product.id),
    ).rejects.toThrow(CrossTenantInventoryError);
  });
});

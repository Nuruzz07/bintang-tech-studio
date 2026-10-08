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

describe('M07 Order Item Historical Snapshot Suite', () => {
  let orderRepo: InMemoryOrderRepository;
  let customerRepo: InMemoryCustomerRepository;
  let productRepo: InMemoryProductRepository;
  let inventoryRepo: InMemoryInventoryRepository;
  let inventoryService: InventoryService;
  let authService: AuthorizationService;
  let orderService: OrderService;

  const storeId = 'store_test_snapshot';

  const sellerContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_seller',
    membershipId: 'mem_seller',
    role: 'STORE_OWNER',
  });

  const customer: Customer = {
    id: 'cust_snapshot_01',
    storeId,
    name: 'Siti Nurhaliza',
    email: 'siti@example.com',
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

  const product: Product = {
    id: 'prod_snap_01',
    storeId,
    categoryId: null,
    name: 'Canva Premium 1 Year',
    slug: 'canva-premium-1-year',
    description: null,
    productType: 'DIGITAL',
    price: 50000,
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

    await customerRepo.create(storeId, customer);
    await productRepo.create(storeId, product);
    await inventoryService.initializeInventory(sellerContext, product.id, 20);
  });

  it('preserves unit_price and product_name snapshot when product is updated later', async () => {
    // 1. Customer creates order at initial price 50000.00
    const createdOrder = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 2 }] },
    );

    expect(createdOrder.subtotal).toBe('100000.00');
    expect(createdOrder.items[0]!.unitPrice).toBe('50000.00');
    expect(createdOrder.items[0]!.productName).toBe('Canva Premium 1 Year');

    // 2. Merchant changes product price to 85000.00 and renames to "Canva Ultra 1 Year"
    await productRepo.update(storeId, product.id, {
      price: 85000,
      name: 'Canva Ultra 1 Year',
    });

    const updatedProduct = await productRepo.findById(storeId, product.id);
    expect(updatedProduct!.price).toBe(85000);
    expect(updatedProduct!.name).toBe('Canva Ultra 1 Year');

    // 3. Historical order remains 100% frozen with original snapshotted values
    const historicalOrder = await orderService.getOrderById(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      createdOrder.id,
    );

    expect(historicalOrder.subtotal).toBe('100000.00');
    expect(historicalOrder.grandTotal).toBe('100000.00');
    expect(historicalOrder.items[0]!.unitPrice).toBe('50000.00');
    expect(historicalOrder.items[0]!.productName).toBe('Canva Premium 1 Year');
    expect(historicalOrder.items[0]!.subtotal).toBe('100000.00');
  });

  it('preserves order history even if product is archived later', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );

    // Merchant archives product
    await productRepo.archive(storeId, product.id);

    const fetched = await orderService.getOrderById(
      { type: 'SELLER', context: sellerContext },
      order.id,
    );

    expect(fetched.items[0]!.productName).toBe('Canva Premium 1 Year');
    expect(fetched.items[0]!.unitPrice).toBe('50000.00');
  });
});

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
  OrderNotFoundError,
  ProductUnavailableError,
} from '../src/index.js';

describe('M07 Order Tenant Boundary Isolation Suite', () => {
  let orderRepo: InMemoryOrderRepository;
  let customerRepo: InMemoryCustomerRepository;
  let productRepo: InMemoryProductRepository;
  let inventoryRepo: InMemoryInventoryRepository;
  let inventoryService: InventoryService;
  let authService: AuthorizationService;
  let orderService: OrderService;

  const storeAlpha = 'store_tenant_alpha';
  const storeBeta = 'store_tenant_beta';

  const sellerAlpha = createAuthenticatedStoreContext({
    storeId: storeAlpha,
    userId: 'user_alpha',
    membershipId: 'mem_alpha',
    role: 'STORE_OWNER',
  });

  const sellerBeta = createAuthenticatedStoreContext({
    storeId: storeBeta,
    userId: 'user_beta',
    membershipId: 'mem_beta',
    role: 'STORE_OWNER',
  });

  const customerAlpha: Customer = {
    id: 'cust_alpha',
    storeId: storeAlpha,
    name: 'Customer Alpha',
    email: 'alpha@example.com',
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

  const customerBeta: Customer = {
    id: 'cust_beta',
    storeId: storeBeta,
    name: 'Customer Beta',
    email: 'beta@example.com',
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

  const productAlpha: Product = {
    id: 'prod_alpha',
    storeId: storeAlpha,
    categoryId: null,
    name: 'Alpha Product',
    slug: 'alpha-product',
    description: null,
    productType: 'DIGITAL',
    price: 30000,
    compareAtPrice: null,
    stockMode: 'TRACKED',
    status: 'ACTIVE',
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const productBeta: Product = {
    id: 'prod_beta',
    storeId: storeBeta,
    categoryId: null,
    name: 'Beta Product',
    slug: 'beta-product',
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

    await customerRepo.create(storeAlpha, customerAlpha);
    await customerRepo.create(storeBeta, customerBeta);
    await productRepo.create(storeAlpha, productAlpha);
    await productRepo.create(storeBeta, productBeta);

    await inventoryService.initializeInventory(sellerAlpha, productAlpha.id, 20);
    await inventoryService.initializeInventory(sellerBeta, productBeta.id, 20);
  });

  it('prevents Store Alpha from accessing Store Beta orders by ID', async () => {
    const orderBeta = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId: storeBeta, customerId: customerBeta.id } },
      { items: [{ productId: productBeta.id, quantity: 1 }] },
    );

    await expect(
      orderService.getOrderById({ type: 'SELLER', context: sellerAlpha }, orderBeta.id),
    ).rejects.toThrow(OrderNotFoundError);
  });

  it('prevents Store Alpha from accessing Store Beta orders by orderNumber', async () => {
    const orderBeta = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId: storeBeta, customerId: customerBeta.id } },
      { items: [{ productId: productBeta.id, quantity: 1 }] },
    );

    await expect(
      orderService.getOrderByNumber(
        { type: 'SELLER', context: sellerAlpha },
        orderBeta.orderNumber,
      ),
    ).rejects.toThrow(OrderNotFoundError);
  });

  it('prevents Store Alpha from cancelling Store Beta order', async () => {
    const orderBeta = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId: storeBeta, customerId: customerBeta.id } },
      { items: [{ productId: productBeta.id, quantity: 1 }] },
    );

    await expect(
      orderService.cancelOrder({ type: 'SELLER', context: sellerAlpha }, orderBeta.id),
    ).rejects.toThrow(OrderNotFoundError);
  });

  it('prevents Customer Alpha from purchasing Product Beta', async () => {
    await expect(
      orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId: storeAlpha, customerId: customerAlpha.id } },
        { items: [{ productId: productBeta.id, quantity: 1 }] },
      ),
    ).rejects.toThrow(ProductUnavailableError);
  });

  it('strictly isolates order lists between merchants with zero cross-tenant leak', async () => {
    await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId: storeAlpha, customerId: customerAlpha.id } },
      { items: [{ productId: productAlpha.id, quantity: 1 }] },
    );

    await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId: storeBeta, customerId: customerBeta.id } },
      { items: [{ productId: productBeta.id, quantity: 2 }] },
    );

    const listAlpha = await orderService.listOrders({ type: 'SELLER', context: sellerAlpha });
    expect(listAlpha.length).toBe(1);
    expect(listAlpha[0]!.storeId).toBe(storeAlpha);

    const listBeta = await orderService.listOrders({ type: 'SELLER', context: sellerBeta });
    expect(listBeta.length).toBe(1);
    expect(listBeta[0]!.storeId).toBe(storeBeta);
  });
});

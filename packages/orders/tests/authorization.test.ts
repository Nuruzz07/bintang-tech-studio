import { describe, it, expect, beforeEach } from 'vitest';
import { createAuthenticatedStoreContext, createStoreContext } from '@bintang/tenancy';
import {
  AuthorizationService,
  InMemoryEntitlementResolver,
  PermissionDeniedError,
  UnauthenticatedError,
} from '@bintang/authorization';
import { InMemoryProductRepository, Product } from '@bintang/commerce';
import { InventoryService, InMemoryInventoryRepository } from '@bintang/inventory';
import {
  OrderService,
  InMemoryOrderRepository,
  InMemoryCustomerRepository,
  Customer,
  CustomerOrderAccessDeniedError,
} from '../src/index.js';

describe('M07 Order Authorization & Role Boundary Suite', () => {
  let orderRepo: InMemoryOrderRepository;
  let customerRepo: InMemoryCustomerRepository;
  let productRepo: InMemoryProductRepository;
  let inventoryRepo: InMemoryInventoryRepository;
  let inventoryService: InventoryService;
  let authService: AuthorizationService;
  let orderService: OrderService;

  const storeId = 'store_test_auth_boundaries';

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

  const customerA: Customer = {
    id: 'cust_auth_a',
    storeId,
    name: 'Customer A',
    email: 'custA@example.com',
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

  const customerB: Customer = {
    id: 'cust_auth_b',
    storeId,
    name: 'Customer B',
    email: 'custB@example.com',
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
    id: 'prod_auth_item',
    storeId,
    categoryId: null,
    name: 'Standard Digital Product',
    slug: 'standard-digital-product',
    description: null,
    productType: 'DIGITAL',
    price: 15000,
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

    await customerRepo.create(storeId, customerA);
    await customerRepo.create(storeId, customerB);
    await productRepo.create(storeId, product);
    await inventoryService.initializeInventory(ownerContext, product.id, 50);
  });

  describe('STORE_OWNER & STORE_ADMIN Permissions', () => {
    it('permits STORE_OWNER full management (read, list, transition, cancel)', async () => {
      const order = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
        { items: [{ productId: product.id, quantity: 1 }] },
      );

      const fetched = await orderService.getOrderById(
        { type: 'SELLER', context: ownerContext },
        order.id,
      );
      expect(fetched.id).toBe(order.id);

      const list = await orderService.listOrders({ type: 'SELLER', context: ownerContext });
      expect(list.length).toBe(1);

      const cancelled = await orderService.cancelOrder(
        { type: 'SELLER', context: ownerContext },
        order.id,
      );
      expect(cancelled.status).toBe('CANCELLED');
    });

    it('permits STORE_ADMIN to cancel an order', async () => {
      const order = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
        { items: [{ productId: product.id, quantity: 1 }] },
      );

      const cancelled = await orderService.cancelOrder(
        { type: 'SELLER', context: adminContext },
        order.id,
      );
      expect(cancelled.status).toBe('CANCELLED');
    });
  });

  describe('STORE_STAFF Permissions & Restrictions', () => {
    it('permits STORE_STAFF to read and list store orders', async () => {
      await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
        { items: [{ productId: product.id, quantity: 1 }] },
      );

      const list = await orderService.listOrders({ type: 'SELLER', context: staffContext });
      expect(list.length).toBe(1);
    });

    it('denies STORE_STAFF from cancelling order with PermissionDeniedError', async () => {
      const order = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
        { items: [{ productId: product.id, quantity: 1 }] },
      );

      // STORE_STAFF does NOT have orders.cancel permission in M04 policy
      await expect(
        orderService.cancelOrder({ type: 'SELLER', context: staffContext }, order.id),
      ).rejects.toThrow(PermissionDeniedError);
    });
  });

  describe('Customer Ownership Boundary', () => {
    it('prevents Customer B from accessing Customer A order', async () => {
      const orderA = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
        { items: [{ productId: product.id, quantity: 1 }] },
      );

      await expect(
        orderService.getOrderById(
          { type: 'CUSTOMER', context: { storeId, customerId: customerB.id } },
          orderA.id,
        ),
      ).rejects.toThrow(CustomerOrderAccessDeniedError);
    });

    it('prevents Customer B from cancelling Customer A order', async () => {
      const orderA = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
        { items: [{ productId: product.id, quantity: 1 }] },
      );

      await expect(
        orderService.cancelOrder(
          { type: 'CUSTOMER', context: { storeId, customerId: customerB.id } },
          orderA.id,
        ),
      ).rejects.toThrow(CustomerOrderAccessDeniedError);
    });

    it('prevents Customer from seeing other customers orders in listOrders', async () => {
      await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
        { items: [{ productId: product.id, quantity: 1 }] },
      );
      await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: customerB.id } },
        { items: [{ productId: product.id, quantity: 2 }] },
      );

      const listA = await orderService.listOrders({
        type: 'CUSTOMER',
        context: { storeId, customerId: customerA.id },
      });
      expect(listA.length).toBe(1);
      expect(listA[0]!.customerId).toBe(customerA.id);

      const listB = await orderService.listOrders({
        type: 'CUSTOMER',
        context: { storeId, customerId: customerB.id },
      });
      expect(listB.length).toBe(1);
      expect(listB[0]!.customerId).toBe(customerB.id);
    });

    it('prevents Customer B from accessing Customer A order via getOrderByNumber', async () => {
      const orderA = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
        { items: [{ productId: product.id, quantity: 1 }] },
      );

      await expect(
        orderService.getOrderByNumber(
          { type: 'CUSTOMER', context: { storeId, customerId: customerB.id } },
          orderA.orderNumber,
        ),
      ).rejects.toThrow(CustomerOrderAccessDeniedError);
    });

    it('prevents customer caller from spoofing customerId via input payload', async () => {
      // Customer A tries to place order under victim Customer B's identity
      const order = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
        {
          customerId: customerB.id, // Malicious spoofing attempt
          items: [{ productId: product.id, quantity: 1 }],
        },
      );

      // Order must belong to caller authenticated customerA, NOT victim customerB
      expect(order.customerId).toBe(customerA.id);
      expect(order.customerId).not.toBe(customerB.id);
    });

    it('prevents cross-store order access by customer caller', async () => {
      const otherStoreId = 'store_other_realm';
      const orderA = await orderService.createOrder(
        { type: 'CUSTOMER', context: { storeId, customerId: customerA.id } },
        { items: [{ productId: product.id, quantity: 1 }] },
      );

      // Customer attempts to lookup order using a foreign storeId
      await expect(
        orderService.getOrderById(
          { type: 'CUSTOMER', context: { storeId: otherStoreId, customerId: customerA.id } },
          orderA.id,
        ),
      ).rejects.toThrow();
    });
  });

  describe('Unauthenticated Context Defense', () => {
    it('denies unauthenticated context on listOrders with UnauthenticatedError', async () => {
      await expect(
        orderService.listOrders({ type: 'SELLER', context: unauthenticatedContext }),
      ).rejects.toThrow(UnauthenticatedError);
    });
  });
});

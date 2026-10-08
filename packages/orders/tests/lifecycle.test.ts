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
  OrderAlreadyCancelledError,
  OrderAlreadyFulfilledError,
  InvalidOrderStateTransitionError,
} from '../src/index.js';

describe('M07 Order Lifecycle & State Machine Suite', () => {
  let orderRepo: InMemoryOrderRepository;
  let customerRepo: InMemoryCustomerRepository;
  let productRepo: InMemoryProductRepository;
  let inventoryRepo: InMemoryInventoryRepository;
  let inventoryService: InventoryService;
  let authService: AuthorizationService;
  let orderService: OrderService;

  const storeId = 'store_test_lifecycle';

  const sellerContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_merchant_lifecycle',
    membershipId: 'mem_merchant_lifecycle',
    role: 'STORE_OWNER',
  });

  const customer: Customer = {
    id: 'cust_life_01',
    storeId,
    name: 'Dewi Lestari',
    email: 'dewi@example.com',
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
    id: 'prod_life_01',
    storeId,
    categoryId: null,
    name: 'Gramedia Digital Subscription',
    slug: 'gramedia-digital-subscription',
    description: null,
    productType: 'DIGITAL',
    price: 89000,
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

  it('progresses through standard valid lifecycle: PENDING_PAYMENT -> PAID -> PROCESSING -> FULFILLED', async () => {
    // 1. Initial creation
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );
    expect(order.status).toBe('PENDING_PAYMENT');

    // 2. Payment received
    const paidOrder = await orderService.transitionStatus(sellerContext, order.id, 'PAID');
    expect(paidOrder.status).toBe('PAID');

    // 3. Processing initiated
    const processingOrder = await orderService.transitionStatus(
      sellerContext,
      order.id,
      'PROCESSING',
    );
    expect(processingOrder.status).toBe('PROCESSING');

    // 4. Fulfillment completed
    const fulfilledOrder = await orderService.transitionStatus(
      sellerContext,
      order.id,
      'FULFILLED',
    );
    expect(fulfilledOrder.status).toBe('FULFILLED');
  });

  it('rejects illegal state transition bypassing sequential progression', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );

    // Direct transition PENDING_PAYMENT -> FULFILLED without payment is strictly illegal
    await expect(
      orderService.transitionStatus(sellerContext, order.id, 'FULFILLED'),
    ).rejects.toThrow(InvalidOrderStateTransitionError);
  });

  it('treats FULFILLED as terminal state and rejects further transitions', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );

    await orderService.transitionStatus(sellerContext, order.id, 'PAID');
    await orderService.transitionStatus(sellerContext, order.id, 'PROCESSING');
    await orderService.transitionStatus(sellerContext, order.id, 'FULFILLED');

    // Attempting to cancel fulfilled order
    await expect(
      orderService.cancelOrder({ type: 'SELLER', context: sellerContext }, order.id),
    ).rejects.toThrow(OrderAlreadyFulfilledError);

    // Attempting to transition fulfilled order
    await expect(
      orderService.transitionStatus(sellerContext, order.id, 'PROCESSING'),
    ).rejects.toThrow(OrderAlreadyFulfilledError);
  });

  it('treats CANCELLED as terminal state and rejects further transitions', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );

    await orderService.cancelOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      order.id,
    );

    // Attempting to pay cancelled order
    await expect(orderService.transitionStatus(sellerContext, order.id, 'PAID')).rejects.toThrow(
      OrderAlreadyCancelledError,
    );

    // Attempting double-cancellation
    await expect(
      orderService.cancelOrder({ type: 'SELLER', context: sellerContext }, order.id),
    ).rejects.toThrow(OrderAlreadyCancelledError);
  });

  it('expires unpaid order and releases inventory reservation', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 5 }] },
    );

    let avail = await inventoryService.getAvailability(sellerContext, product.id);
    expect(avail.quantityReserved).toBe(5);

    // System/seller triggers expiration
    const expiredOrder = await orderService.transitionStatus(sellerContext, order.id, 'EXPIRED');
    expect(expiredOrder.status).toBe('EXPIRED');

    avail = await inventoryService.getAvailability(sellerContext, product.id);
    expect(avail.quantityReserved).toBe(0);
    expect(avail.availableQuantity).toBe(20);
  });

  it('prohibits cancelling PAID order without payment refund integration', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );
    await orderService.transitionStatus(sellerContext, order.id, 'PAID');

    await expect(
      orderService.cancelOrder({ type: 'SELLER', context: sellerContext }, order.id),
    ).rejects.toThrow(InvalidOrderStateTransitionError);
  });

  it('allows transition to FAILED from PROCESSING or PENDING_PAYMENT', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );
    await orderService.transitionStatus(sellerContext, order.id, 'PAID');
    await orderService.transitionStatus(sellerContext, order.id, 'PROCESSING');

    const failedOrder = await orderService.transitionStatus(sellerContext, order.id, 'FAILED', {
      failureReason: 'Delivery failure',
    });
    expect(failedOrder.status).toBe('FAILED');
  });

  it('handles transition to identical status idempotently without error', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );
    await orderService.transitionStatus(sellerContext, order.id, 'PAID');

    // Transitioning to PAID again is a no-op and returns order
    const repeated = await orderService.transitionStatus(sellerContext, order.id, 'PAID');
    expect(repeated.status).toBe('PAID');
  });

  it('permits seller to transition PROCESSING order to CANCELLED and releases reserved inventory', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 2 }] },
    );

    await orderService.transitionStatus(sellerContext, order.id, 'PAID');
    await orderService.transitionStatus(sellerContext, order.id, 'PROCESSING');

    let avail = await inventoryService.getAvailability(sellerContext, product.id);
    expect(avail.quantityReserved).toBe(2);

    const cancelledOrder = await orderService.transitionStatus(
      sellerContext,
      order.id,
      'CANCELLED',
      {
        cancellationReason: 'Defective item discovered during fulfillment',
      },
    );
    expect(cancelledOrder.status).toBe('CANCELLED');

    // Reserved stock must be released back
    avail = await inventoryService.getAvailability(sellerContext, product.id);
    expect(avail.quantityReserved).toBe(0);
    expect(avail.availableQuantity).toBe(20);
  });

  it('permits seller to transition PAID order to CANCELLED and releases reserved inventory', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 3 }] },
    );

    await orderService.transitionStatus(sellerContext, order.id, 'PAID');

    let avail = await inventoryService.getAvailability(sellerContext, product.id);
    expect(avail.quantityReserved).toBe(3);

    const cancelledOrder = await orderService.transitionStatus(
      sellerContext,
      order.id,
      'CANCELLED',
      {
        cancellationReason: 'Merchant out-of-stock resolution',
      },
    );
    expect(cancelledOrder.status).toBe('CANCELLED');

    // Reserved stock must be released back
    avail = await inventoryService.getAvailability(sellerContext, product.id);
    expect(avail.quantityReserved).toBe(0);
    expect(avail.availableQuantity).toBe(20);
  });

  it('enforces that direct repository updateStatus mutations cannot bypass state machine', async () => {
    const order = await orderService.createOrder(
      { type: 'CUSTOMER', context: { storeId, customerId: customer.id } },
      { items: [{ productId: product.id, quantity: 1 }] },
    );
    expect(order.status).toBe('PENDING_PAYMENT');

    // Attempting direct repo mutation from PENDING_PAYMENT to FULFILLED
    await expect(orderRepo.updateStatus(storeId, order.id, 'FULFILLED')).rejects.toThrow(
      InvalidOrderStateTransitionError,
    );
  });
});

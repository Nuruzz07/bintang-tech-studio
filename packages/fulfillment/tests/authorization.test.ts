import { describe, it, expect, beforeEach } from 'vitest';
import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import { createTestHarness, setupProductAndOrder, TestHarness } from './test-helpers.js';
import { FulfillmentCustomerAccessDeniedError, PublicFulfillment } from '../src/index.js';

describe('M09 Fulfillment Authorization & Security Boundary Suite', () => {
  let h: TestHarness;

  beforeEach(() => {
    h = createTestHarness();
  });

  it('allows STORE_OWNER to create, execute, read, and list fulfillments', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });
    const ownerContext = createAuthenticatedStoreContext({
      storeId: h.storeId,
      userId: 'user_owner',
      membershipId: 'mem_owner',
      role: 'STORE_OWNER',
    });

    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: ownerContext },
      { orderId: order.id },
    );
    expect(f.status).toBe('PENDING');

    const executed = await h.fulfillmentService.executeFulfillment(
      { type: 'SELLER', context: ownerContext },
      { fulfillmentId: f.id },
    );
    expect(executed.status).toBe('FULFILLED');

    const retrieved = await h.fulfillmentService.getFulfillment(
      { type: 'SELLER', context: ownerContext },
      f.id,
    );
    expect(retrieved.id).toBe(f.id);

    const list = await h.fulfillmentService.listFulfillments({
      type: 'SELLER',
      context: ownerContext,
    });
    expect(list).toHaveLength(1);
  });

  it('allows STORE_ADMIN to create, execute, read, and list fulfillments', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });
    const adminContext = createAuthenticatedStoreContext({
      storeId: h.storeId,
      userId: 'user_admin',
      membershipId: 'mem_admin',
      role: 'STORE_ADMIN',
    });

    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: adminContext },
      { orderId: order.id },
    );
    expect(f.status).toBe('PENDING');

    const retrieved = await h.fulfillmentService.getFulfillment(
      { type: 'SELLER', context: adminContext },
      f.id,
    );
    expect(retrieved.id).toBe(f.id);
  });

  it('allows STORE_STAFF to create, execute, read, and list fulfillments', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });
    const staffContext = createAuthenticatedStoreContext({
      storeId: h.storeId,
      userId: 'user_staff',
      membershipId: 'mem_staff',
      role: 'STORE_STAFF',
    });

    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: staffContext },
      { orderId: order.id },
    );
    expect(f.status).toBe('PENDING');

    const executed = await h.fulfillmentService.executeFulfillment(
      { type: 'SELLER', context: staffContext },
      { fulfillmentId: f.id },
    );
    expect(executed.status).toBe('FULFILLED');
  });

  it('denies access to sellers from a different store (cross-store context)', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });
    const intruderContext = createAuthenticatedStoreContext({
      storeId: 'store_intruder_999',
      userId: 'user_intruder',
      membershipId: 'mem_intruder',
      role: 'STORE_OWNER',
    });

    // Create via legitimate owner first
    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    // Intruder cannot read
    await expect(
      h.fulfillmentService.getFulfillment({ type: 'SELLER', context: intruderContext }, f.id),
    ).rejects.toThrow();

    // Intruder cannot execute
    await expect(
      h.fulfillmentService.executeFulfillment(
        { type: 'SELLER', context: intruderContext },
        { fulfillmentId: f.id },
      ),
    ).rejects.toThrow();

    // Intruder cannot cancel
    await expect(
      h.fulfillmentService.cancelFulfillment({ type: 'SELLER', context: intruderContext }, f.id),
    ).rejects.toThrow();
  });

  it('denies CUSTOMER callers from all mutating fulfillment actions', async () => {
    const { order } = await setupProductAndOrder(h, { orderStatus: 'PAID' });
    const customerCaller = {
      type: 'CUSTOMER' as const,
      context: { storeId: h.storeId, customerId: h.customerA.id },
    };

    // Customer cannot create
    await expect(
      h.fulfillmentService.createFulfillment(customerCaller, { orderId: order.id }),
    ).rejects.toThrow(FulfillmentCustomerAccessDeniedError);

    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    // Customer cannot execute
    await expect(
      h.fulfillmentService.executeFulfillment(customerCaller, { fulfillmentId: f.id }),
    ).rejects.toThrow(FulfillmentCustomerAccessDeniedError);

    // Customer cannot retry
    await expect(
      h.fulfillmentService.retryFulfillment(customerCaller, { fulfillmentId: f.id }),
    ).rejects.toThrow(FulfillmentCustomerAccessDeniedError);

    // Customer cannot cancel
    await expect(h.fulfillmentService.cancelFulfillment(customerCaller, f.id)).rejects.toThrow(
      FulfillmentCustomerAccessDeniedError,
    );
  });

  it('allows CUSTOMER to view sanitized PublicFulfillment for their own order', async () => {
    const { order } = await setupProductAndOrder(h, {
      orderStatus: 'PAID',
      customerId: h.customerA.id,
      withDigitalItems: true,
    });

    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    const customerCaller = {
      type: 'CUSTOMER' as const,
      context: { storeId: h.storeId, customerId: h.customerA.id },
    };

    const pub = (await h.fulfillmentService.getFulfillment(
      customerCaller,
      f.id,
    )) as PublicFulfillment;

    expect(pub.id).toBe(f.id);
    expect(pub.orderId).toBe(order.id);
    expect(pub.items).toHaveLength(1);
    // Verify internal inventoryItemId is NOT present in PublicFulfillmentItem
    expect('inventoryItemId' in (pub.items[0] ?? {})).toBe(false);
  });

  it('denies CUSTOMER from viewing another customer’s fulfillment', async () => {
    const { order } = await setupProductAndOrder(h, {
      orderStatus: 'PAID',
      customerId: h.customerA.id,
    });

    const f = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: order.id },
    );

    // Customer B attempts to view Customer A's fulfillment
    const customerBCaller = {
      type: 'CUSTOMER' as const,
      context: { storeId: h.storeId, customerId: h.customerB.id },
    };

    await expect(h.fulfillmentService.getFulfillment(customerBCaller, f.id)).rejects.toThrow(
      FulfillmentCustomerAccessDeniedError,
    );
  });

  it('customer listing only returns fulfillments belonging to their own orders', async () => {
    const { order: orderA } = await setupProductAndOrder(h, {
      orderStatus: 'PAID',
      customerId: h.customerA.id,
    });
    const { order: orderB } = await setupProductAndOrder(h, {
      orderStatus: 'PAID',
      customerId: h.customerB.id,
    });

    const fA = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: orderA.id },
    );
    const fB = await h.fulfillmentService.createFulfillment(
      { type: 'SELLER', context: h.sellerContext },
      { orderId: orderB.id },
    );

    const customerACaller = {
      type: 'CUSTOMER' as const,
      context: { storeId: h.storeId, customerId: h.customerA.id },
    };

    const customerAList = await h.fulfillmentService.listFulfillments(customerACaller);
    expect(customerAList).toHaveLength(1);
    expect(customerAList[0]?.id).toBe(fA.id);

    const customerBCaller = {
      type: 'CUSTOMER' as const,
      context: { storeId: h.storeId, customerId: h.customerB.id },
    };

    const customerBList = await h.fulfillmentService.listFulfillments(customerBCaller);
    expect(customerBList).toHaveLength(1);
    expect(customerBList[0]?.id).toBe(fB.id);
  });
});

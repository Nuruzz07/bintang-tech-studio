import { describe, it, expect, vi } from 'vitest';
import { PostgrestClient } from '../src/client.js';
import { SupabaseInventoryRepository } from '../src/repositories/inventory-repository.js';
import { SupabaseOrderRepository } from '../src/repositories/order-repository.js';
import { SupabaseFulfillmentRepository } from '../src/repositories/fulfillment-repository.js';
import {
  SupabaseIdempotencyRepository,
  IdempotencyInFlightError,
  AcquireIdempotencyResult,
} from '../src/repositories/idempotency-repository.js';
import { InsufficientStockError } from '@bintang/inventory';
import { Order, OrderItem } from '@bintang/orders';
import { Fulfillment, FulfillmentItem } from '@bintang/fulfillment';
import {
  DbIdempotencyRecord,
  DbOrder,
  DbOrderItem,
  DbFulfillment,
  DbFulfillmentItem,
} from '../src/types.js';

describe('Production Pilot Concurrency and Deadlock Prevention Tests', () => {
  // Simple Async Mutex for simulating PostgreSQL row-level locks (SELECT FOR UPDATE)
  class AsyncMutex {
    private mutex = Promise.resolve();

    async lock(): Promise<() => void> {
      let unlockNext: () => void = () => {};
      const nextPromise = new Promise<void>((resolve) => {
        unlockNext = resolve;
      });
      const current = this.mutex;
      this.mutex = current.then(() => nextPromise);
      await current;
      return unlockNext;
    }
  }

  // ============================================================================
  // TEST 1: Overbooking Race Prevention (Promise.all([reserve(10), reserve(1)]))
  // ============================================================================
  it('prevents overbooking under concurrent parallel reservation races', async () => {
    const availableQuantity = 10;
    let reservedQuantity = 0;
    const inventoryMutex = new AsyncMutex();

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/rpc/rpc_atomic_reserve_stock')) {
        const body = JSON.parse(init?.body as string);
        const requested = body.p_amount;

        // Acquire simulated row lock (SELECT FOR UPDATE on inventory row)
        const unlock = await inventoryMutex.lock();
        try {
          // Simulate slight database I/O latency inside the transaction
          await new Promise((r) => setTimeout(r, 10));

          const currentAvailable = availableQuantity - reservedQuantity;
          if (currentAvailable < requested) {
            return new Response(
              JSON.stringify({
                code: 'P0001',
                message: `Insufficient stock: requested ${requested}, available ${currentAvailable}`,
              }),
              { status: 400, headers: { 'Content-Type': 'application/json' } },
            );
          }

          reservedQuantity += requested;
          return new Response(
            JSON.stringify({
              id: 'inv-1',
              store_id: body.p_store_id,
              product_id: body.p_product_id,
              quantity_on_hand: availableQuantity,
              quantity_reserved: reservedQuantity,
              updated_at: new Date().toISOString(),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        } finally {
          unlock();
        }
      }

      return new Response('[]', { status: 200 });
    });

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'mock',
      fetch: mockFetch as unknown as typeof fetch,
    });
    const repo = new SupabaseInventoryRepository(client);

    // Launch two parallel reservations simultaneously: one for 10 units, one for 1 unit.
    // Total demand = 11. Total capacity = 10.
    const [resA, resB] = await Promise.allSettled([
      repo.atomicReserve('store-1', 'prod-1', 10),
      repo.atomicReserve('store-1', 'prod-1', 1),
    ]);

    // Exactly one must succeed and one must fail with InsufficientStockError
    const successes = [resA, resB].filter((r) => r.status === 'fulfilled');
    const failures = [resA, resB].filter((r) => r.status === 'rejected');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const failureReason = (failures[0] as PromiseRejectedResult).reason;
    expect(failureReason).toBeInstanceOf(InsufficientStockError);

    // Final reserved quantity must not exceed total available (10)
    expect(reservedQuantity).toBeLessThanOrEqual(10);
    expect(reservedQuantity === 10 || reservedQuantity === 1).toBe(true);
  });

  // ============================================================================
  // TEST 2: Multi-Item Deadlock Prevention (Lock Ordering A->B vs B->A)
  // ============================================================================
  it('prevents deadlocks by enforcing deterministic lock sorting (ORDER BY product_id ASC)', async () => {
    const productA = '00000000-0000-0000-0000-00000000000a';
    const productB = '00000000-0000-0000-0000-00000000000b';

    const productLocks = new Map<string, AsyncMutex>([
      [productA, new AsyncMutex()],
      [productB, new AsyncMutex()],
    ]);

    let activeLocksCount = 0;

    // Simulation of rpc_create_order_atomic lock acquisition logic
    async function simulateAtomicOrderRpc(items: Array<{ product_id: string; quantity: number }>) {
      // RULE: Items MUST be sorted by product_id ASC before locking to eliminate lock inversion cycles
      const sorted = [...items].sort((a, b) => a.product_id.localeCompare(b.product_id));

      const releaseFns: Array<() => void> = [];

      try {
        for (const item of sorted) {
          const mutex = productLocks.get(item.product_id)!;
          const unlock = await mutex.lock();
          releaseFns.push(unlock);
          activeLocksCount++;

          // Simulate concurrent processing delay
          await new Promise((r) => setTimeout(r, 15));
        }

        const mockOrder: DbOrder = {
          id: `ord_${Math.random().toString(36).slice(2)}`,
          store_id: 'store-1',
          customer_id: 'cust-1',
          order_number: 'ORD-001',
          status: 'CONFIRMED',
          currency: 'IDR',
          subtotal: '10000.00',
          discount: '0.00',
          tax: '0.00',
          total: '10000.00',
          voucher_id: null,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const mockItems: DbOrderItem[] = items.map((i, idx) => ({
          id: `item-${idx}`,
          order_id: mockOrder.id,
          store_id: 'store-1',
          product_id: i.product_id,
          name_snapshot: 'Product',
          price_snapshot: '5000.00',
          quantity: i.quantity,
          total: '5000.00',
          metadata: {},
          created_at: new Date().toISOString(),
        }));

        return { order: mockOrder, items: mockItems };
      } finally {
        for (const unlock of releaseFns.reverse()) {
          activeLocksCount--;
          unlock();
        }
      }
    }

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/rpc/rpc_create_order_atomic')) {
        const body = JSON.parse(init?.body as string);
        const result = await simulateAtomicOrderRpc(body.p_items);
        return new Response(JSON.stringify(result), { status: 200 });
      }
      return new Response('[]', { status: 200 });
    });

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'mock',
      fetch: mockFetch as unknown as typeof fetch,
    });
    const repo = new SupabaseOrderRepository(client);

    const makeOrder = (id: string, num: string): Order => ({
      id,
      storeId: 'store-1',
      customerId: 'cust-1',
      orderNumber: num,
      status: 'CONFIRMED',
      subtotal: '10000.00',
      discountTotal: '0.00',
      grandTotal: '10000.00',
      currency: 'IDR',
      voucherId: null,
      fulfillmentStatus: 'PENDING',
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Order 1 sends [productA, productB]
    const order1 = makeOrder('ord-1', 'ORD-001');
    const items1: OrderItem[] = [
      {
        id: 'i-1',
        storeId: 'store-1',
        orderId: 'ord-1',
        productId: productA,
        productName: 'A',
        quantity: 1,
        unitPrice: '5000.00',
        subtotal: '5000.00',
        metadata: {},
        createdAt: new Date().toISOString(),
      },
      {
        id: 'i-2',
        storeId: 'store-1',
        orderId: 'ord-1',
        productId: productB,
        productName: 'B',
        quantity: 1,
        unitPrice: '5000.00',
        subtotal: '5000.00',
        metadata: {},
        createdAt: new Date().toISOString(),
      },
    ];

    // Order 2 sends [productB, productA] (reversed request sequence)
    const order2 = makeOrder('ord-2', 'ORD-002');
    const items2: OrderItem[] = [
      {
        id: 'i-3',
        storeId: 'store-1',
        orderId: 'ord-2',
        productId: productB,
        productName: 'B',
        quantity: 1,
        unitPrice: '5000.00',
        subtotal: '5000.00',
        metadata: {},
        createdAt: new Date().toISOString(),
      },
      {
        id: 'i-4',
        storeId: 'store-1',
        orderId: 'ord-2',
        productId: productA,
        productName: 'A',
        quantity: 1,
        unitPrice: '5000.00',
        subtotal: '5000.00',
        metadata: {},
        createdAt: new Date().toISOString(),
      },
    ];

    const [order1Res, order2Res] = await Promise.allSettled([
      repo.create('store-1', order1, items1, true),
      repo.create('store-1', order2, items2, true),
    ]);

    // Both orders must successfully serialize and complete without deadlock
    expect(order1Res.status).toBe('fulfilled');
    expect(order2Res.status).toBe('fulfilled');
    expect(activeLocksCount).toBe(0);
  });

  // ============================================================================
  // TEST 3: Idempotency Collision Race (Promise.all([acquire(key), acquire(key)]))
  // ============================================================================
  it('strictly serializes concurrent idempotency acquisitions allowing only one winner', async () => {
    const table = new Map<string, DbIdempotencyRecord>();
    const dbWriteMutex = new AsyncMutex();

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'GET') {
        const match = Array.from(table.values()).find((r) => url.includes(r.idempotency_key));
        return new Response(JSON.stringify(match ? [match] : []), { status: 200 });
      }

      if (init?.method === 'POST') {
        const body = JSON.parse(init.body as string)[0] as Partial<DbIdempotencyRecord>;
        const compositeKey = `${body.scope}:${body.idempotency_key}`;

        const unlock = await dbWriteMutex.lock();
        try {
          // Check uniqueness constraint
          if (table.has(compositeKey)) {
            // PostgreSQL unique violation 23505
            return new Response(
              JSON.stringify({
                code: '23505',
                message: 'duplicate key value violates unique constraint "unique_idempotency_key"',
              }),
              { status: 409, headers: { 'Content-Type': 'application/json' } },
            );
          }

          // Simulate network/disk pause
          await new Promise((r) => setTimeout(r, 10));

          const record: DbIdempotencyRecord = {
            id: 'idem-rec-1',
            store_id: body.store_id ?? null,
            scope: body.scope!,
            idempotency_key: body.idempotency_key!,
            request_hash: body.request_hash!,
            status: 'PENDING',
            response_payload: null,
            error_payload: null,
            created_at: new Date().toISOString(),
            expires_at: body.expires_at!,
          };
          table.set(compositeKey, record);
          return new Response(JSON.stringify([record]), { status: 201 });
        } finally {
          unlock();
        }
      }

      return new Response('[]', { status: 200 });
    });

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'mock',
      fetch: mockFetch as unknown as typeof fetch,
    });
    const repo = new SupabaseIdempotencyRepository(client);

    // Two parallel requests attempt to acquire the exact same idempotency key at the same instant
    const [resA, resB] = await Promise.allSettled([
      repo.acquire('payment', 'idemp-pay-100', { amount: 50000 }),
      repo.acquire('payment', 'idemp-pay-100', { amount: 50000 }),
    ]);

    const fulfilled = [resA, resB].filter((r) => r.status === 'fulfilled');
    const rejected = [resA, resB].filter((r) => r.status === 'rejected');

    // Exactly one request must acquire the key; the sibling must be caught as in-flight
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const winner = (fulfilled[0] as PromiseFulfilledResult<AcquireIdempotencyResult>).value;
    expect(winner.acquired).toBe(true);

    const loserError = (rejected[0] as PromiseRejectedResult).reason;
    expect(loserError).toBeInstanceOf(IdempotencyInFlightError);
  });

  // ============================================================================
  // TEST 4: Duplicate Fulfillment Race Prevention
  // ============================================================================
  it('prevents duplicate concurrent fulfillments via order row locking', async () => {
    let fulfillmentStatus = 'UNFULFILLED';
    const orderRowMutex = new AsyncMutex();
    let fulfillmentCount = 0;

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/rpc/rpc_create_fulfillment_atomic')) {
        const body = JSON.parse(init?.body as string);

        // Serialize on order lock (SELECT FOR UPDATE on orders table)
        const unlock = await orderRowMutex.lock();
        try {
          await new Promise((r) => setTimeout(r, 10));

          if (fulfillmentStatus === 'FULFILLED') {
            return new Response(
              JSON.stringify({
                code: 'P0001',
                message: `Order ${body.p_fulfillment.order_id} is already fulfilled`,
              }),
              { status: 400, headers: { 'Content-Type': 'application/json' } },
            );
          }

          fulfillmentStatus = 'FULFILLED';
          fulfillmentCount++;

          const mockFulfillment: DbFulfillment = {
            id: body.p_fulfillment.id,
            store_id: body.p_store_id,
            order_id: body.p_fulfillment.order_id,
            status: 'COMPLETED',
            fulfillment_type: 'MANUAL',
            delivery_payload: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const mockItems: DbFulfillmentItem[] = (body.p_items ?? []).map(
            (i: { order_item_id?: string; inventory_item_id?: string }, idx: number) => ({
              id: `ful-item-${idx}`,
              fulfillment_id: mockFulfillment.id,
              store_id: body.p_store_id,
              order_item_id: i.order_item_id ?? null,
              product_id: '',
              inventory_item_id: i.inventory_item_id ?? null,
              status: 'DELIVERED',
              delivered_credential_reference: null,
              created_at: new Date().toISOString(),
            }),
          );

          return new Response(
            JSON.stringify({
              fulfillment: mockFulfillment,
              items: mockItems,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        } finally {
          unlock();
        }
      }

      return new Response('[]', { status: 200 });
    });

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'mock',
      fetch: mockFetch as unknown as typeof fetch,
    });
    const repo = new SupabaseFulfillmentRepository(client);

    const makeFulfillment = (id: string): Fulfillment => ({
      id,
      storeId: 'store-1',
      orderId: '00000000-0000-0000-0000-000000000001',
      strategy: 'MANUAL',
      status: 'PROCESSING',
      trackingInfo: {},
      failureReason: null,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const items: FulfillmentItem[] = [
      {
        id: 'f-item-1',
        storeId: 'store-1',
        fulfillmentId: 'ful-1',
        orderItemId: 'oi-1',
        inventoryItemId: 'inv-item-1',
        itemType: 'CREDENTIAL',
        status: 'PENDING',
        payloadReference: null,
        createdAt: new Date().toISOString(),
      },
    ];

    // Two parallel worker invocations race to fulfill the same order
    const [call1, call2] = await Promise.allSettled([
      repo.create('store-1', makeFulfillment('ful-1'), items, true),
      repo.create('store-1', makeFulfillment('ful-2'), items, true),
    ]);

    const successes = [call1, call2].filter((r) => r.status === 'fulfilled');
    const failures = [call1, call2].filter((r) => r.status === 'rejected');

    // Exactly one fulfillment must succeed; the duplicate must be rejected
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(fulfillmentCount).toBe(1);
  });

  // ============================================================================
  // TEST 5: Concurrent Voucher Checkout Race Condition (FOR UPDATE + Limit Guard)
  // ============================================================================
  it('strictly serializes concurrent voucher checkouts with usage_limit=1 rejecting the racer with P0001', async () => {
    let voucherUsedCount = 0;
    const voucherUsageLimit = 1;
    const voucherMutex = new AsyncMutex();
    let redemptionRecordsCount = 0;

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/rpc/rpc_create_order_atomic')) {
        const body = JSON.parse(init?.body as string);
        const order = body.p_order;

        if (order.voucher_id) {
          // Simulate SELECT ... FROM vouchers WHERE id = voucher_id FOR UPDATE
          const unlock = await voucherMutex.lock();
          try {
            await new Promise((r) => setTimeout(r, 15));

            // Quota check
            if (voucherUsageLimit !== null && voucherUsedCount >= voucherUsageLimit) {
              return new Response(
                JSON.stringify({
                  code: 'P0001',
                  message: `Voucher ${order.voucher_id} usage limit has been reached`,
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
              );
            }

            // Atomic increment
            voucherUsedCount++;

            // Create Order first (satisfies foreign key fk_voucher_redemptions_store_order)
            const mockOrder: DbOrder = {
              id: order.id,
              store_id: body.p_store_id,
              customer_id: order.customer_id,
              order_number: order.order_number,
              status: 'PENDING',
              currency: 'IDR',
              subtotal: order.subtotal,
              discount: order.discount,
              tax: '0.00',
              total: order.total,
              voucher_id: order.voucher_id,
              metadata: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            // Then record voucher redemption
            redemptionRecordsCount++;

            const mockItems: DbOrderItem[] = (body.p_items ?? []).map(
              (i: { id?: string; product_id: string; quantity: number }, idx: number) => ({
                id: i.id ?? `item-${idx}`,
                order_id: mockOrder.id,
                store_id: body.p_store_id,
                product_id: i.product_id,
                name_snapshot: 'Test Product',
                price_snapshot: '10000.00',
                quantity: i.quantity,
                total: '10000.00',
                metadata: {},
                created_at: new Date().toISOString(),
              }),
            );

            return new Response(
              JSON.stringify({
                order: mockOrder,
                items: mockItems,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
          } finally {
            unlock();
          }
        }
      }
      return new Response('[]', { status: 200 });
    });

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'mock',
      fetch: mockFetch as unknown as typeof fetch,
    });
    const repo = new SupabaseOrderRepository(client);

    const makeOrder = (id: string, num: string): Order => ({
      id,
      storeId: 'store-1',
      customerId: 'cust-1',
      orderNumber: num,
      status: 'PENDING',
      subtotal: '10000.00',
      discountTotal: '1000.00',
      grandTotal: '9000.00',
      currency: 'IDR',
      voucherId: 'vouch-limit-1',
      fulfillmentStatus: 'PENDING',
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const items: OrderItem[] = [
      {
        id: 'i-1',
        storeId: 'store-1',
        orderId: 'ord-1',
        productId: 'prod-1',
        productName: 'Test Product',
        quantity: 1,
        unitPrice: '10000.00',
        subtotal: '10000.00',
        metadata: {},
        createdAt: new Date().toISOString(),
      },
    ];

    // Two parallel checkouts race to redeem the single voucher quota
    const [resA, resB] = await Promise.allSettled([
      repo.create('store-1', makeOrder('ord-race-1', 'ORD-RACE-001'), items, false),
      repo.create('store-1', makeOrder('ord-race-2', 'ORD-RACE-002'), items, false),
    ]);

    const successes = [resA, resB].filter((r) => r.status === 'fulfilled');
    const failures = [resA, resB].filter((r) => r.status === 'rejected');

    // Exactly one checkout must succeed and consume the voucher quota; the other is rejected with P0001
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(voucherUsedCount).toBe(1);
    expect(redemptionRecordsCount).toBe(1);

    const failureReason = (failures[0] as PromiseRejectedResult).reason;
    expect(failureReason.message).toMatch(/usage limit has been reached/);
  });
});

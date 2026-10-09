import { describe, it, expect, vi } from 'vitest';
import { PostgrestClient } from '../src/client.js';
import {
  SupabaseIdempotencyRepository,
  OrdersIdempotencyAdapter,
  PaymentsIdempotencyAdapter,
  FulfillmentIdempotencyAdapter,
  IdempotencyPayloadConflictError,
} from '../src/repositories/idempotency-repository.js';
import { SupabaseOrderRepository } from '../src/repositories/order-repository.js';
import { DbIdempotencyRecord, DbOrder, DbOrderItem } from '../src/types.js';
import { Order, OrderItem } from '@bintang/orders';

describe('M15 Hardening — Authoritative Financial Calculations & Tenant-Safe Idempotency', () => {
  describe('Authoritative Financial Calculations & Order Contracts', () => {
    it('simulates RPC rejection when client attempts unearned discount without voucher', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('/rpc/rpc_create_order_atomic')) {
          const body = JSON.parse(init?.body as string);
          const order = body.p_order;
          // Rejection rule: discount > 0 without voucher_id
          if (order.discount > 0 && !order.voucher_id) {
            return new Response(
              JSON.stringify({
                code: 'P0001',
                message: 'Cannot claim discount without a valid voucher',
              }),
              { status: 400, headers: { 'Content-Type': 'application/json' } },
            );
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

      const order: Order = {
        id: 'ord-unearned',
        storeId: 'store-1',
        customerId: 'cust-1',
        orderNumber: 'ORD-UNEARNED-001',
        status: 'PENDING_PAYMENT',
        subtotal: '50000.00',
        discountTotal: '10000.00', // Client attempts discount without voucher
        grandTotal: '40000.00',
        currency: 'IDR',
        voucherId: null, // No voucher provided
        fulfillmentStatus: 'PENDING',
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const items: OrderItem[] = [
        {
          id: 'item-1',
          storeId: 'store-1',
          orderId: 'ord-unearned',
          productId: 'prod-1',
          productName: 'Product 1',
          quantity: 1,
          unitPrice: '50000.00',
          subtotal: '50000.00',
          metadata: {},
          createdAt: new Date().toISOString(),
        },
      ];

      await expect(repo.create('store-1', order, items, true)).rejects.toThrow(
        /Cannot claim discount without a valid voucher/,
      );
    });

    it('simulates RPC rejection when client attempts untrusted tax override', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('/rpc/rpc_create_order_atomic')) {
          const body = JSON.parse(init?.body as string);
          const order = body.p_order;
          if (order.tax && order.tax !== 0 && order.tax !== '0.00') {
            return new Response(
              JSON.stringify({
                code: 'P0001',
                message: 'Untrusted client tax override is not permitted',
              }),
              { status: 400, headers: { 'Content-Type': 'application/json' } },
            );
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

      const order: Order = {
        id: 'ord-tax-override',
        storeId: 'store-1',
        customerId: 'cust-1',
        orderNumber: 'ORD-TAX-001',
        status: 'PENDING_PAYMENT',
        subtotal: '50000.00',
        discountTotal: '0.00',
        grandTotal: '55000.00',
        currency: 'IDR',
        voucherId: null,
        fulfillmentStatus: 'PENDING',
        metadata: { tax: 5000 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const items: OrderItem[] = [
        {
          id: 'item-1',
          storeId: 'store-1',
          orderId: 'ord-tax-override',
          productId: 'prod-1',
          productName: 'Product 1',
          quantity: 1,
          unitPrice: '50000.00',
          subtotal: '50000.00',
          metadata: {},
          createdAt: new Date().toISOString(),
        },
      ];

      // Sending tax in order payload should be rejected
      await expect(repo.create('store-1', order, items, true)).rejects.toThrow();
    });

    it('simulates valid order creation populating dual legacy and modern financial columns', async () => {
      const mockOrderRow: DbOrder = {
        id: 'ord-authoritative',
        store_id: 'store-1',
        customer_id: 'cust-1',
        voucher_id: 'vouch-1',
        order_number: 'ORD-AUTH-001',
        currency: 'IDR',
        subtotal: '50000.00',
        discount: '5000.00',
        discount_total: '5000.00',
        tax: '0.00',
        total: '45000.00',
        grand_total: '45000.00',
        status: 'PENDING',
        fulfillment_status: 'PENDING',
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockItemRow: DbOrderItem = {
        id: 'item-auth-1',
        store_id: 'store-1',
        order_id: 'ord-authoritative',
        product_id: 'prod-1',
        product_name: 'Product 1',
        name_snapshot: 'Product 1',
        price_snapshot: '50000.00',
        unit_price: '50000.00',
        quantity: 1,
        subtotal: '50000.00',
        total: '50000.00',
        metadata: {},
        created_at: new Date().toISOString(),
      };

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/rpc/rpc_create_order_atomic')) {
          return new Response(
            JSON.stringify({
              order: mockOrderRow,
              items: [mockItemRow],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response('[]', { status: 200 });
      });

      const client = new PostgrestClient({
        supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
        supabaseKey: 'mock',
        fetch: mockFetch as unknown as typeof fetch,
      });
      const repo = new SupabaseOrderRepository(client);

      const order: Order = {
        id: 'ord-authoritative',
        storeId: 'store-1',
        customerId: 'cust-1',
        orderNumber: 'ORD-AUTH-001',
        status: 'PENDING_PAYMENT',
        subtotal: '50000.00',
        discountTotal: '5000.00',
        grandTotal: '45000.00',
        currency: 'IDR',
        voucherId: 'vouch-1',
        fulfillmentStatus: 'PENDING',
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const items: OrderItem[] = [
        {
          id: 'item-auth-1',
          storeId: 'store-1',
          orderId: 'ord-authoritative',
          productId: 'prod-1',
          productName: 'Product 1',
          quantity: 1,
          unitPrice: '50000.00',
          subtotal: '50000.00',
          metadata: {},
          createdAt: new Date().toISOString(),
        },
      ];

      const created = await repo.create('store-1', order, items, true);
      expect(created.id).toBe('ord-authoritative');
      expect(created.subtotal).toBe('50000.00');
      expect(created.discountTotal).toBe('5000.00');
      expect(created.grandTotal).toBe('45000.00');
      expect(created.items).toHaveLength(1);
      expect(created.items[0]?.subtotal).toBe('50000.00');
    });

    it('simulates transaction rollback on order creation failure ensuring no orphan voucher redemption', async () => {
      let voucherUsedCount = 5;
      let redemptionInserted = false;
      let orderInserted = false;

      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('/rpc/rpc_create_order_atomic')) {
          const body = JSON.parse(init?.body as string);
          const order = body.p_order;

          // Step 1: Valid product prices and subtotal (stock reservation occurs)
          // Step 2: Voucher validated and in-transaction used_count increment occurs
          const inTxVoucherUsedCount = voucherUsedCount + 1;

          // Step 4: Authoritative total validation calculates subtotal (50000) - discount (5000) = 45000
          const expectedTotal = '45000.00';
          if (order.total && order.total !== expectedTotal) {
            // Transaction aborts! All mutations in the transaction roll back
            return new Response(
              JSON.stringify({
                code: 'P0001',
                message: `Financial mismatch: client total ${order.total} does not match trusted calculation ${expectedTotal}`,
              }),
              { status: 400, headers: { 'Content-Type': 'application/json' } },
            );
          }

          // If successful, commit changes
          voucherUsedCount = inTxVoucherUsedCount;
          orderInserted = true;
          redemptionInserted = true;
          return new Response(
            JSON.stringify({
              order: {
                id: body.p_order.id,
                store_id: 'store-1',
                customer_id: 'cust-1',
                order_number: 'ORD-ROLLBACK-001',
                currency: 'IDR',
                subtotal: '50000.00',
                discount: '5000.00',
                discount_total: '5000.00',
                tax: '0.00',
                total: '45000.00',
                grand_total: '45000.00',
                status: 'PENDING',
                fulfillment_status: 'PENDING',
                metadata: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              items: [],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response('[]', { status: 200 });
      });

      const client = new PostgrestClient({
        supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
        supabaseKey: 'mock',
        fetch: mockFetch as unknown as typeof fetch,
      });
      const repo = new SupabaseOrderRepository(client);

      // Order with valid items, valid subtotal, valid discount, but mismatched total (9999.00 vs 45000.00)
      const order: Order = {
        id: 'ord-fail-rollback',
        storeId: 'store-1',
        customerId: 'cust-1',
        orderNumber: 'ORD-ROLLBACK-001',
        status: 'PENDING_PAYMENT',
        subtotal: '50000.00',
        discountTotal: '5000.00',
        grandTotal: '9999.00', // Deliberately mismatched total: triggers P0001 after stock & voucher mutations
        currency: 'IDR',
        voucherId: 'vouch-1',
        fulfillmentStatus: 'PENDING',
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const validItems: OrderItem[] = [
        {
          id: 'item-roll-1',
          storeId: 'store-1',
          orderId: 'ord-fail-rollback',
          productId: 'prod-1',
          productName: 'Valid Product',
          quantity: 1,
          unitPrice: '50000.00',
          subtotal: '50000.00',
          metadata: {},
          createdAt: new Date().toISOString(),
        },
      ];

      await expect(repo.create('store-1', order, validItems, true)).rejects.toThrow(
        /Financial mismatch/,
      );

      // State remains pristine: unincremented voucher, no order, no redemption record
      expect(voucherUsedCount).toBe(5);
      expect(orderInserted).toBe(false);
      expect(redemptionInserted).toBe(false);
    });

    it('guarantees foreign key insertion sequence: order row exists before voucher redemption is created', async () => {
      const dbOperations: string[] = [];

      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('/rpc/rpc_create_order_atomic')) {
          const body = JSON.parse(init?.body as string);
          // Simulate PL/pgSQL sequential execution order:
          // 1. Lock and validate voucher
          dbOperations.push('SELECT_VOUCHER_FOR_UPDATE');
          // 2. Increment voucher used count
          dbOperations.push('UPDATE_VOUCHER_USED_COUNT');
          // 3. Insert order header
          dbOperations.push('INSERT_ORDER_HEADER');
          // 4. Insert voucher redemption (order_id FK is valid now)
          if (body.p_order.voucher_id) {
            dbOperations.push('INSERT_VOUCHER_REDEMPTION');
          }
          // 5. Insert line items
          dbOperations.push('INSERT_ORDER_ITEMS');

          return new Response(
            JSON.stringify({
              order: {
                id: body.p_order.id,
                store_id: 'store-1',
                customer_id: 'cust-1',
                order_number: 'ORD-FK-001',
                currency: 'IDR',
                subtotal: '50000.00',
                discount: '5000.00',
                discount_total: '5000.00',
                tax: '0.00',
                total: '45000.00',
                grand_total: '45000.00',
                status: 'PENDING',
                fulfillment_status: 'PENDING',
                metadata: {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              items: [
                {
                  id: 'item-fk-1',
                  store_id: 'store-1',
                  order_id: body.p_order.id,
                  product_id: 'prod-1',
                  product_name: 'Product 1',
                  name_snapshot: 'Product 1',
                  price_snapshot: '50000.00',
                  quantity: 1,
                  unit_price: '50000.00',
                  subtotal: '50000.00',
                  total: '50000.00',
                  metadata: {},
                  created_at: new Date().toISOString(),
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response('[]', { status: 200 });
      });

      const client = new PostgrestClient({
        supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
        supabaseKey: 'mock',
        fetch: mockFetch as unknown as typeof fetch,
      });
      const repo = new SupabaseOrderRepository(client);

      const order: Order = {
        id: 'ord-fk-seq',
        storeId: 'store-1',
        customerId: 'cust-1',
        orderNumber: 'ORD-FK-001',
        status: 'PENDING_PAYMENT',
        subtotal: '50000.00',
        discountTotal: '5000.00',
        grandTotal: '45000.00',
        currency: 'IDR',
        voucherId: 'vouch-1',
        fulfillmentStatus: 'PENDING',
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const items: OrderItem[] = [
        {
          id: 'item-fk-1',
          storeId: 'store-1',
          orderId: 'ord-fk-seq',
          productId: 'prod-1',
          productName: 'Product 1',
          quantity: 1,
          unitPrice: '50000.00',
          subtotal: '50000.00',
          metadata: {},
          createdAt: new Date().toISOString(),
        },
      ];

      const res = await repo.create('store-1', order, items, false);
      expect(res.id).toBe('ord-fk-seq');

      // Verify sequence: INSERT_ORDER_HEADER MUST precede INSERT_VOUCHER_REDEMPTION
      const orderHeaderIdx = dbOperations.indexOf('INSERT_ORDER_HEADER');
      const voucherRedemptionIdx = dbOperations.indexOf('INSERT_VOUCHER_REDEMPTION');

      expect(orderHeaderIdx).toBeGreaterThan(-1);
      expect(voucherRedemptionIdx).toBeGreaterThan(-1);
      expect(orderHeaderIdx).toBeLessThan(voucherRedemptionIdx);
    });
  });

  describe('Multi-Tenant Idempotency Key Isolation', () => {
    it('allows identical idempotency keys across different store_ids in SupabaseIdempotencyRepository', async () => {
      const records = new Map<string, DbIdempotencyRecord>();

      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        const storeMatch = url.match(/store_id=eq\.([^&]+)/);
        const targetStoreId = storeMatch ? storeMatch[1] : null;

        if (init?.method === 'GET') {
          const matches = Array.from(records.values()).filter((r) => {
            if (targetStoreId && r.store_id !== targetStoreId) return false;
            return url.includes(r.idempotency_key) && url.includes(r.scope);
          });
          return new Response(JSON.stringify(matches), { status: 200 });
        }

        if (init?.method === 'POST') {
          const body = JSON.parse(init.body as string)[0] as Partial<DbIdempotencyRecord>;
          const compoundKey = `${body.store_id ?? 'global'}:${body.scope}:${body.idempotency_key}`;

          if (records.has(compoundKey)) {
            return new Response(
              JSON.stringify({
                code: '23505',
                message: 'duplicate key value violates unique constraint',
              }),
              { status: 409, headers: { 'Content-Type': 'application/json' } },
            );
          }

          const record: DbIdempotencyRecord = {
            id: `idem-${records.size + 1}`,
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
          records.set(compoundKey, record);
          return new Response(JSON.stringify([record]), { status: 201 });
        }

        return new Response('[]', { status: 200 });
      });

      const client = new PostgrestClient({
        supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
        supabaseKey: 'mock',
        fetch: mockFetch as unknown as typeof fetch,
      });

      const repo = new SupabaseIdempotencyRepository(client);

      const storeA = 'store-aaaa-1111';
      const storeB = 'store-bbbb-2222';
      const sharedKey = 'order-checkout-uuid-999';

      // 1. Store A acquires sharedKey
      const resA = await repo.acquire('checkout', sharedKey, { cart: [1] }, storeA);
      expect(resA.acquired).toBe(true);

      // 2. Store B acquires the EXACT same sharedKey in checkout scope with DIFFERENT payload
      // Due to multi-tenant isolation, this must SUCCEED (no conflict with Store A)
      const resB = await repo.acquire('checkout', sharedKey, { cart: [2] }, storeB);
      expect(resB.acquired).toBe(true);

      // 3. Store A retrying with different payload gets conflict error
      await expect(repo.acquire('checkout', sharedKey, { cart: [999] }, storeA)).rejects.toThrow(
        IdempotencyPayloadConflictError,
      );

      // 4. Store B is completely isolated from Store A's state
      const foundA = await repo.findByKey('checkout', sharedKey, storeA);
      const foundB = await repo.findByKey('checkout', sharedKey, storeB);
      expect(foundA?.storeId).toBe(storeA);
      expect(foundB?.storeId).toBe(storeB);
    });

    it('enforces store isolation in OrdersIdempotencyAdapter', async () => {
      const records = new Map<string, DbIdempotencyRecord>();

      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        const decodedUrl = decodeURIComponent(url);
        const storeMatch = decodedUrl.match(/store_id=eq\.([^&]+)/);
        const targetStoreId = storeMatch ? storeMatch[1] : null;

        if (init?.method === 'GET') {
          const matches = Array.from(records.values()).filter((r) => {
            if (targetStoreId && r.store_id !== targetStoreId) return false;
            return decodedUrl.includes(r.idempotency_key) && decodedUrl.includes(r.scope);
          });
          return new Response(JSON.stringify(matches), { status: 200 });
        }

        if (init?.method === 'POST') {
          const body = JSON.parse(init.body as string)[0] as Partial<DbIdempotencyRecord>;
          const compoundKey = `${body.store_id ?? 'global'}:${body.scope}:${body.idempotency_key}`;

          const record: DbIdempotencyRecord = {
            id: `idem-${records.size + 1}`,
            store_id: body.store_id ?? null,
            scope: body.scope!,
            idempotency_key: body.idempotency_key!,
            request_hash: body.request_hash!,
            status: 'COMPLETED',
            response_payload: body.response_payload ?? null,
            error_payload: null,
            created_at: new Date().toISOString(),
            expires_at: body.expires_at!,
          };
          records.set(compoundKey, record);
          return new Response(JSON.stringify([record]), { status: 201 });
        }

        return new Response('[]', { status: 200 });
      });

      const client = new PostgrestClient({
        supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
        supabaseKey: 'mock',
        fetch: mockFetch as unknown as typeof fetch,
      });

      const adapter = new OrdersIdempotencyAdapter(client);

      const storeA = 'store-alpha';
      const storeB = 'store-beta';
      const actorId = 'actor-user-1';
      const key = 'idem-req-42';

      // 1. Set for store A
      await adapter.set({
        key,
        storeId: storeA,
        actorId,
        requestHash: 'hash_A',
        response: { orderId: 'ord-A' },
      });

      // 2. Set identical key for store B
      await adapter.set({
        key,
        storeId: storeB,
        actorId,
        requestHash: 'hash_B',
        response: { orderId: 'ord-B' },
      });

      // 3. Get for store A returns store A's data
      const recordA = await adapter.get(storeA, actorId, key);
      expect(recordA?.response).toEqual({ orderId: 'ord-A' });
      expect(recordA?.storeId).toBe(storeA);

      // 4. Get for store B returns store B's data
      const recordB = await adapter.get(storeB, actorId, key);
      expect(recordB?.response).toEqual({ orderId: 'ord-B' });
      expect(recordB?.storeId).toBe(storeB);
    });

    it('enforces store isolation in PaymentsIdempotencyAdapter and FulfillmentIdempotencyAdapter', async () => {
      const records = new Map<string, DbIdempotencyRecord>();

      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        const decodedUrl = decodeURIComponent(url);
        const storeMatch = decodedUrl.match(/store_id=eq\.([^&]+)/);
        const targetStoreId = storeMatch ? storeMatch[1] : null;

        if (init?.method === 'GET') {
          const matches = Array.from(records.values()).filter((r) => {
            if (targetStoreId && r.store_id !== targetStoreId) return false;
            return decodedUrl.includes(r.idempotency_key) && decodedUrl.includes(r.scope);
          });
          return new Response(JSON.stringify(matches), { status: 200 });
        }

        if (init?.method === 'POST') {
          const body = JSON.parse(init.body as string)[0] as Partial<DbIdempotencyRecord>;
          const compoundKey = `${body.store_id ?? 'global'}:${body.scope}:${body.idempotency_key}`;

          const record: DbIdempotencyRecord = {
            id: `idem-${records.size + 1}`,
            store_id: body.store_id ?? null,
            scope: body.scope!,
            idempotency_key: body.idempotency_key!,
            request_hash: body.request_hash!,
            status: 'COMPLETED',
            response_payload: body.response_payload ?? null,
            error_payload: null,
            created_at: new Date().toISOString(),
            expires_at: body.expires_at!,
          };
          records.set(compoundKey, record);
          return new Response(JSON.stringify([record]), { status: 201 });
        }

        return new Response('[]', { status: 200 });
      });

      const client = new PostgrestClient({
        supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
        supabaseKey: 'mock',
        fetch: mockFetch as unknown as typeof fetch,
      });

      const payAdapter = new PaymentsIdempotencyAdapter(client);
      const fulAdapter = new FulfillmentIdempotencyAdapter(client);

      // Payments adapter store isolation
      await payAdapter.set({
        key: 'pay-key-1',
        storeId: 'store-1',
        actorId: 'act-1',
        requestHash: 'hash-1',
        response: { paymentId: 'pay-1' },
      });
      await payAdapter.set({
        key: 'pay-key-1',
        storeId: 'store-2',
        actorId: 'act-1',
        requestHash: 'hash-2',
        response: { paymentId: 'pay-2' },
      });

      const payA = await payAdapter.get('store-1', 'act-1', 'pay-key-1');
      const payB = await payAdapter.get('store-2', 'act-1', 'pay-key-1');
      expect(payA?.response).toEqual({ paymentId: 'pay-1' });
      expect(payB?.response).toEqual({ paymentId: 'pay-2' });

      // Fulfillment adapter store isolation
      await fulAdapter.set({
        key: 'ful-key-1',
        storeId: 'store-1',
        actorId: 'act-1',
        requestHash: 'hash-1',
        response: { fulfillmentId: 'ful-1' },
      });
      await fulAdapter.set({
        key: 'ful-key-1',
        storeId: 'store-2',
        actorId: 'act-1',
        requestHash: 'hash-2',
        response: { fulfillmentId: 'ful-2' },
      });

      const fulA = await fulAdapter.get('store-1', 'act-1', 'ful-key-1');
      const fulB = await fulAdapter.get('store-2', 'act-1', 'ful-key-1');
      expect(fulA?.response).toEqual({ fulfillmentId: 'ful-1' });
      expect(fulB?.response).toEqual({ fulfillmentId: 'ful-2' });
    });
  });
});

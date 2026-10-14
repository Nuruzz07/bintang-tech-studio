import { describe, it, expect, vi } from 'vitest';
import { PostgrestClient } from '../src/client.js';
import { SupabaseOrderRepository } from '../src/repositories/order-repository.js';
import {
  SupabaseIdempotencyRepository,
  OrdersIdempotencyAdapter,
  IdempotencyInFlightError,
  IdempotencyPayloadConflictError,
} from '../src/repositories/idempotency-repository.js';
import { DbIdempotencyRecord, DbOrder, DbOrderItem } from '../src/types.js';
import { Order, OrderItem } from '@bintang/orders';
import { DatabaseError } from '../src/errors.js';

describe('Cross-Instance PostgreSQL Idempotency & Unified Stock Reservation', () => {
  const storeId = '11111111-1111-1111-1111-111111111111';

  describe('SupabaseOrderRepository Unified Atomic Stock Reservation', () => {
    it('fails closed when the atomic order RPC is missing and stock reservation was requested', async () => {
      const mockClient = {
        rpc: vi
          .fn()
          .mockRejectedValue(
            new DatabaseError('HTTP 404 PGRST202: rpc_create_order_atomic not found'),
          ),
        from: vi.fn(),
      } as unknown as PostgrestClient;
      const orderRepo = new SupabaseOrderRepository(mockClient);

      await expect(orderRepo.create(storeId, {} as Order, [] as OrderItem[], true)).rejects.toThrow(
        /Atomic order creation is unavailable/,
      );
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    it('declares supportsAtomicStockReservation as true and passes p_reserve_stock: true by default', async () => {
      let capturedRpcName = '';
      let capturedRpcParams: Record<string, unknown> = {};

      const mockClient = {
        rpc: vi.fn().mockImplementation(async (name: string, params: Record<string, unknown>) => {
          capturedRpcName = name;
          capturedRpcParams = params;
          const fakeOrder: DbOrder = {
            id: 'ord-01',
            store_id: storeId,
            customer_id: 'cust-01',
            order_number: 'ORD-TEST-001',
            status: 'PENDING_PAYMENT',
            currency: 'IDR',
            subtotal: '100000.00',
            discount: '0.00',
            tax: '0.00',
            total: '100000.00',
            voucher_id: null,
            metadata: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          const fakeItem: DbOrderItem = {
            id: 'item-01',
            order_id: 'ord-01',
            store_id: storeId,
            product_id: 'prod-01',
            name_snapshot: 'Test Product',
            price_snapshot: '100000.00',
            quantity: 1,
            total: '100000.00',
            metadata: {},
          };
          return { order: fakeOrder, items: [fakeItem] };
        }),
        from: vi.fn(),
      } as unknown as PostgrestClient;

      const orderRepo = new SupabaseOrderRepository(mockClient);

      expect(orderRepo.supportsAtomicStockReservation).toBe(true);

      const order: Order = {
        id: 'ord-01',
        storeId,
        customerId: 'cust-01',
        orderNumber: 'ORD-TEST-001',
        status: 'PENDING_PAYMENT',
        subtotal: '100000.00',
        discountTotal: '0.00',
        grandTotal: '100000.00',
        currency: 'IDR',
        voucherId: null,
        fulfillmentStatus: 'PENDING',
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const items: OrderItem[] = [
        {
          id: 'item-01',
          storeId,
          orderId: 'ord-01',
          productId: 'prod-01',
          productName: 'Test Product',
          quantity: 1,
          unitPrice: '100000.00',
          subtotal: '100000.00',
          metadata: {},
          createdAt: new Date().toISOString(),
        },
      ];

      const result = await orderRepo.create(storeId, order, items);

      expect(result).toBeDefined();
      expect(capturedRpcName).toBe('rpc_create_order_atomic');
      // Crucial verification: p_reserve_stock must be true to unify reservation & order creation in DB
      expect(capturedRpcParams['p_reserve_stock']).toBe(true);
      expect(capturedRpcParams['p_store_id']).toBe(storeId);
    });
  });

  describe('SupabaseIdempotencyRepository & OrdersIdempotencyAdapter Concurrency & Recovery', () => {
    it('acquires new PENDING lease and rejects concurrent in-flight requests', async () => {
      const dbStore: Map<string, DbIdempotencyRecord> = new Map();

      function createMockClient(): PostgrestClient {
        return {
          from: (table: string) => {
            if (table !== 'idempotency_records') throw new Error(`Unexpected table ${table}`);
            return {
              select: () => ({
                eq: (_col1: string, val1: string) => ({
                  eq: (_col2: string, val2: string) => ({
                    eq: (_col3: string, val3: string) => ({
                      maybeSingle: async () => {
                        return dbStore.get(`${val1}:${val2}:${val3}`) ?? null;
                      },
                      single: async () => {
                        const r = dbStore.get(`${val1}:${val2}:${val3}`);
                        if (!r) throw new Error('Not found');
                        return r;
                      },
                    }),
                    maybeSingle: async () => {
                      return dbStore.get(`${val1}:${val2}`) ?? null;
                    },
                    single: async () => {
                      const r = dbStore.get(`${val1}:${val2}`);
                      if (!r) throw new Error('Not found');
                      return r;
                    },
                  }),
                }),
              }),
              insert: async (
                data: Partial<DbIdempotencyRecord> | Partial<DbIdempotencyRecord>[],
              ) => {
                const record = Array.isArray(data) ? data[0]! : data;
                const compositeKey = `${record.scope}:${record.idempotency_key}${record.store_id ? ':' + record.store_id : ''}`;
                if (dbStore.has(compositeKey)) {
                  const err = new Error('Unique constraint violated');
                  (err as unknown as { status: number }).status = 409;
                  throw err;
                }
                const row: DbIdempotencyRecord = {
                  id: 'idemp-01',
                  store_id: record.store_id ?? null,
                  scope: record.scope!,
                  idempotency_key: record.idempotency_key!,
                  request_hash: record.request_hash!,
                  status: record.status as 'PENDING',
                  response_payload: null,
                  error_payload: null,
                  created_at: new Date().toISOString(),
                  expires_at: record.expires_at!,
                };
                dbStore.set(compositeKey, row);
                return [row];
              },
              update: async () => [],
            };
          },
        } as unknown as PostgrestClient;
      }

      const client1 = createMockClient();
      const adapter1 = new OrdersIdempotencyAdapter(client1);

      const client2 = createMockClient();
      const adapter2 = new OrdersIdempotencyAdapter(client2);

      const requestHash = 'hash_alpha_123';

      // Instance 1 acquires the lease
      const lease1 = await adapter1.acquire(storeId, 'cust-01', 'key-concur-01', requestHash);
      expect(lease1.acquired).toBe(true);

      // Instance 2 attempts to acquire the same key concurrently
      await expect(
        adapter2.acquire(storeId, 'cust-01', 'key-concur-01', requestHash),
      ).rejects.toThrow(IdempotencyInFlightError);
    });

    it('rejects reused key with different payload with IdempotencyPayloadConflictError', async () => {
      const storedRow: DbIdempotencyRecord = {
        id: 'idemp-conflict-01',
        store_id: storeId,
        scope: 'checkout',
        idempotency_key: 'cust-01:key-reused',
        request_hash: 'hash_original',
        status: 'PENDING',
        response_payload: null,
        error_payload: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      };

      const mockClient = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => storedRow,
                }),
              }),
            }),
          }),
        }),
      } as unknown as PostgrestClient;

      const adapter = new OrdersIdempotencyAdapter(mockClient);

      await expect(
        adapter.acquire(storeId, 'cust-01', 'key-reused', 'hash_different_payload'),
      ).rejects.toThrow(IdempotencyPayloadConflictError);
    });

    it('recovers expired PENDING record and successfully claims acquired: true', async () => {
      const payload = { items: [{ id: 'prod-recover', qty: 1 }] };
      const helper = new SupabaseIdempotencyRepository({} as unknown as PostgrestClient);
      const originalHash = await helper.computeHash(payload);

      const expiredRow: DbIdempotencyRecord = {
        id: 'idemp-expired-01',
        store_id: storeId,
        scope: 'checkout',
        idempotency_key: 'cust-01:key-expired',
        request_hash: originalHash,
        status: 'PENDING',
        response_payload: null,
        error_payload: null,
        created_at: new Date(Date.now() - 7200000).toISOString(),
        expires_at: new Date(Date.now() - 3600000).toISOString(), // expired 1h ago
      };

      let updateCalled = false;
      const mockClient = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => expiredRow,
                }),
              }),
            }),
          }),
          eq: () => ({
            eq: () => ({
              eq: (column: string, value: string) => ({
                update: async (patch: Partial<DbIdempotencyRecord>) => {
                  expect(column).toBe('expires_at');
                  expect(value).toBe(expiredRow.expires_at);
                  updateCalled = true;
                  return [{ ...expiredRow, ...patch }];
                },
              }),
            }),
          }),
        }),
      } as unknown as PostgrestClient;

      const adapter = new OrdersIdempotencyAdapter(mockClient);

      const lease = await adapter.acquire(storeId, 'cust-01', 'key-expired', payload);

      expect(lease.acquired).toBe(true);
      expect(updateCalled).toBe(true);
    });
  });
});

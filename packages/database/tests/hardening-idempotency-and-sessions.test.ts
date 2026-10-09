import { describe, it, expect, vi } from 'vitest';
import { PostgrestClient } from '../src/client.js';
import {
  SupabaseIdempotencyRepository,
  IdempotencyPayloadConflictError,
  IdempotencyInFlightError,
} from '../src/repositories/idempotency-repository.js';
import {
  SupabaseSessionRepository,
  SessionExpiredError,
  SessionRevokedError,
  hashSessionToken,
} from '../src/repositories/session-repository.js';
import { DurableQueueWorker } from '../src/worker.js';
import { createSupabaseDatabase, createProductionDomainServices } from '../src/factory.js';
import { DbIdempotencyRecord, DbAppSession, DbJob, DbOutboxEvent } from '../src/types.js';

describe('M15 Hardening — Durable Idempotency, Sessions, and Worker', () => {
  describe('SupabaseIdempotencyRepository', () => {
    it('acquires new key, detects conflicts with different payload, and returns cached response', async () => {
      const records = new Map<string, DbIdempotencyRecord>();

      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (init?.method === 'GET') {
          const match = Array.from(records.values()).find(
            (r) => url.includes(r.idempotency_key) && url.includes(r.scope),
          );
          return new Response(JSON.stringify(match ? [match] : []), { status: 200 });
        }
        if (init?.method === 'POST') {
          const body = JSON.parse(init.body as string)[0] as Partial<DbIdempotencyRecord>;
          const record: DbIdempotencyRecord = {
            id: 'idem-1',
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
          records.set(`${record.scope}:${record.idempotency_key}`, record);
          return new Response(JSON.stringify([record]), { status: 201 });
        }
        if (init?.method === 'PATCH') {
          const patch = JSON.parse(init.body as string) as Partial<DbIdempotencyRecord>;
          const existing = records.get('checkout:key-123')!;
          Object.assign(existing, patch);
          return new Response(JSON.stringify([existing]), { status: 200 });
        }
        return new Response('[]', { status: 200 });
      });

      const client = new PostgrestClient({
        supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
        supabaseKey: 'test-key',
        fetch: mockFetch as unknown as typeof fetch,
      });

      const repo = new SupabaseIdempotencyRepository(client);

      // 1. Initial acquisition
      const first = await repo.acquire('checkout', 'key-123', { total: 50000 });
      expect(first.acquired).toBe(true);
      expect(first.cachedResponse).toBeUndefined();

      // 2. In-flight acquisition attempt with same payload throws in-flight error
      await expect(repo.acquire('checkout', 'key-123', { total: 50000 })).rejects.toThrow(
        IdempotencyInFlightError,
      );

      // 3. Complete the request
      await repo.complete('checkout', 'key-123', { orderId: 'ord-999' });

      // 4. Repeated identical request returns cached result
      const repeat = await repo.acquire('checkout', 'key-123', { total: 50000 });
      expect(repeat.acquired).toBe(false);
      expect(repeat.cachedResponse).toEqual({ orderId: 'ord-999' });

      // 5. Attempt with DIFFERENT payload throws IdempotencyPayloadConflictError
      await expect(repo.acquire('checkout', 'key-123', { total: 99999 })).rejects.toThrow(
        IdempotencyPayloadConflictError,
      );
    });
  });

  describe('SupabaseSessionRepository', () => {
    it('creates, validates, and revokes durable app sessions', async () => {
      const tokenHash = await hashSessionToken('seller_tok_123');
      let sessionRow: DbAppSession = {
        id: 'sess-1',
        session_type: 'SELLER',
        token_hash: tokenHash,
        user_id: 'user-1',
        store_id: 'store-1',
        active_membership_id: 'mem-1',
        role: 'STORE_OWNER',
        metadata: {},
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        created_at: new Date().toISOString(),
        revoked_at: null,
      };

      const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return new Response(JSON.stringify([sessionRow]), { status: 201 });
        }
        if (init?.method === 'PATCH') {
          sessionRow = { ...sessionRow, revoked_at: new Date().toISOString() };
          return new Response(JSON.stringify([sessionRow]), { status: 200 });
        }
        return new Response(JSON.stringify([sessionRow]), { status: 200 });
      });

      const client = new PostgrestClient({
        supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
        supabaseKey: 'test-key',
        fetch: mockFetch as unknown as typeof fetch,
      });

      const repo = new SupabaseSessionRepository(client);

      const session = await repo.validateSession('seller_tok_123');
      expect(session.sessionToken).toBe('seller_tok_123');
      expect(session.tokenHash).toBe(tokenHash);
      expect(session.role).toBe('STORE_OWNER');

      // Revoke session
      await repo.revokeSession('seller_tok_123');

      // Subsequent validation must throw SessionRevokedError
      await expect(repo.validateSession('seller_tok_123')).rejects.toThrow(SessionRevokedError);
    });

    it('rejects expired session', async () => {
      const expiredHash = await hashSessionToken('cust_expired_tok');
      const expiredRow: DbAppSession = {
        id: 'sess-2',
        session_type: 'CUSTOMER',
        token_hash: expiredHash,
        user_id: 'user-2',
        store_id: 'store-1',
        active_membership_id: null,
        role: 'CUSTOMER',
        metadata: {},
        expires_at: new Date(Date.now() - 3600000).toISOString(), // 1h in the past
        created_at: new Date(Date.now() - 7200000).toISOString(),
        revoked_at: null,
      };

      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify([expiredRow]), { status: 200 }));
      const client = new PostgrestClient({
        supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
        supabaseKey: 'test-key',
        fetch: mockFetch as unknown as typeof fetch,
      });

      const repo = new SupabaseSessionRepository(client);
      await expect(repo.validateSession('cust_expired_tok')).rejects.toThrow(SessionExpiredError);
    });
  });

  describe('DurableQueueWorker', () => {
    it('claims and processes next job with successful completion', async () => {
      const mockJob: DbJob = {
        id: 'job-1',
        job_type: 'SEND_TELEGRAM_NOTIF',
        queue_name: 'default',
        payload: { orderId: 'ord-1' },
        status: 'QUEUED',
        attempts: 0,
        max_attempts: 3,
        locked_until: null,
        error: null,
        created_at: new Date().toISOString(),
        processed_at: null,
      };

      const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          return new Response(JSON.stringify([{ ...mockJob, status: 'COMPLETED' }]), {
            status: 200,
          });
        }
        return new Response(JSON.stringify([mockJob]), { status: 200 });
      });

      const client = new PostgrestClient({
        supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
        supabaseKey: 'test-key',
        fetch: mockFetch as unknown as typeof fetch,
      });

      const worker = new DurableQueueWorker(client);
      const handler = vi.fn().mockResolvedValue(undefined);

      const result = await worker.processNextJob('default', handler);
      expect(result.processed).toBe(true);
      expect(result.status).toBe('COMPLETED');
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-1' }));
    });

    it('retries job on transient handler error when attempts < max_attempts', async () => {
      const mockJob: DbJob = {
        id: 'job-2',
        job_type: 'SEND_TELEGRAM_NOTIF',
        queue_name: 'default',
        payload: {},
        status: 'QUEUED',
        attempts: 1,
        max_attempts: 3,
        locked_until: null,
        error: null,
        created_at: new Date().toISOString(),
        processed_at: null,
      };

      const mockFetch = vi
        .fn()
        .mockImplementation(async () => new Response(JSON.stringify([mockJob]), { status: 200 }));
      const client = new PostgrestClient({
        supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
        supabaseKey: 'test-key',
        fetch: mockFetch as unknown as typeof fetch,
      });

      const worker = new DurableQueueWorker(client);
      const handler = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const result = await worker.processNextJob('default', handler);
      expect(result.processed).toBe(true);
      expect(result.status).toBe('RETRYING');
      expect(result.error).toBe('Network timeout');
    });

    it('marks job FAILED when retry attempts reach max_attempts', async () => {
      const mockJob: DbJob = {
        id: 'job-3',
        job_type: 'SEND_TELEGRAM_NOTIF',
        queue_name: 'default',
        payload: {},
        status: 'QUEUED',
        attempts: 3,
        max_attempts: 3,
        locked_until: null,
        error: null,
        created_at: new Date().toISOString(),
        processed_at: null,
      };

      const mockFetch = vi
        .fn()
        .mockImplementation(async () => new Response(JSON.stringify([mockJob]), { status: 200 }));
      const client = new PostgrestClient({
        supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
        supabaseKey: 'test-key',
        fetch: mockFetch as unknown as typeof fetch,
      });

      const worker = new DurableQueueWorker(client);
      const handler = vi.fn().mockRejectedValue(new Error('Permanent rejection'));

      const result = await worker.processNextJob('default', handler);
      expect(result.processed).toBe(true);
      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('Permanent rejection');
    });

    it('claims and processes next outbox event', async () => {
      const mockEvt: DbOutboxEvent = {
        id: 'evt-1',
        event_name: 'order.created',
        aggregate_type: 'ORDER',
        aggregate_id: 'ord-1',
        store_id: 'store-1',
        correlation_id: 'corr-1',
        causation_id: null,
        payload: { orderId: 'ord-1' },
        status: 'PENDING',
        attempts: 0,
        locked_until: null,
        processed_at: null,
        error: null,
        created_at: new Date().toISOString(),
      };

      const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH') {
          return new Response(JSON.stringify([{ ...mockEvt, status: 'PUBLISHED' }]), {
            status: 200,
          });
        }
        return new Response(JSON.stringify([mockEvt]), { status: 200 });
      });

      const client = new PostgrestClient({
        supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
        supabaseKey: 'test-key',
        fetch: mockFetch as unknown as typeof fetch,
      });

      const worker = new DurableQueueWorker(client);
      const handler = vi.fn().mockResolvedValue(undefined);

      const result = await worker.processNextOutboxEvent(handler);
      expect(result.processed).toBe(true);
      expect(result.status).toBe('PUBLISHED');
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'evt-1' }));
    });
  });

  describe('createProductionDomainServices Composition Root', () => {
    it('successfully extracts domain idempotency and session store adapters', () => {
      const db = createSupabaseDatabase({
        supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
        supabaseKey: 'test-key',
        fetch: vi.fn() as unknown as typeof fetch,
      });

      const wiring = createProductionDomainServices(db);
      expect(wiring.ordersIdempotency).toBe(db.ordersIdempotency);
      expect(wiring.paymentsIdempotency).toBe(db.paymentsIdempotency);
      expect(wiring.fulfillmentIdempotency).toBe(db.fulfillmentIdempotency);
      expect(wiring.sellerSessionStore).toBe(db.sellerSessionStore);
      expect(wiring.customerSessionStore).toBe(db.customerSessionStore);
      expect(wiring.platformSessionStore).toBe(db.platformSessionStore);
    });
  });
});

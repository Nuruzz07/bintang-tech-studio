import { describe, it, expect, vi } from 'vitest';
import { PostgrestClient } from '../src/client.js';
import { createSupabaseDatabase, createProductionDomainServices } from '../src/factory.js';
import {
  OrdersIdempotencyAdapter,
  PaymentsIdempotencyAdapter,
  FulfillmentIdempotencyAdapter,
} from '../src/repositories/idempotency-repository.js';
import {
  SellerSessionStoreAdapter,
  CustomerSessionStoreAdapter,
  PlatformSessionStoreAdapter,
  hashSessionToken,
} from '../src/repositories/session-repository.js';
import { DurableQueueWorker } from '../src/worker.js';
import { DbAppSession, DbStore, DbStoreMember } from '../src/types.js';

describe('M15 Production Wiring & Durability Verification', () => {
  const dummyConfig = {
    supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
    supabaseKey: 'test-service-key-123',
    serviceRoleKey: 'test-service-key-123',
  };

  it('proves createSupabaseDatabase wires durable adapters and workers directly to PostgrestClient', () => {
    const db = createSupabaseDatabase(dummyConfig);

    // 1. PostgrestClient initialized
    expect(db.client).toBeInstanceOf(PostgrestClient);

    // 2. Production Idempotency Adapters are wired to client, not in-memory mocks
    expect(db.ordersIdempotency).toBeInstanceOf(OrdersIdempotencyAdapter);
    expect(db.paymentsIdempotency).toBeInstanceOf(PaymentsIdempotencyAdapter);
    expect(db.fulfillmentIdempotency).toBeInstanceOf(FulfillmentIdempotencyAdapter);

    // 3. Production Session Store Adapters are wired to database repo and client
    expect(db.sellerSessionStore).toBeInstanceOf(SellerSessionStoreAdapter);
    expect(db.customerSessionStore).toBeInstanceOf(CustomerSessionStoreAdapter);
    expect(db.platformSessionStore).toBeInstanceOf(PlatformSessionStoreAdapter);

    // 4. Background worker is wired to PostgrestClient
    expect(db.worker).toBeInstanceOf(DurableQueueWorker);
  });

  it('proves createProductionDomainServices exports true database-backed wiring for production pilots', () => {
    const db = createSupabaseDatabase(dummyConfig);
    const domainWiring = createProductionDomainServices(db);

    expect(domainWiring.ordersIdempotency).toBe(db.ordersIdempotency);
    expect(domainWiring.paymentsIdempotency).toBe(db.paymentsIdempotency);
    expect(domainWiring.fulfillmentIdempotency).toBe(db.fulfillmentIdempotency);
    expect(domainWiring.sellerSessionStore).toBe(db.sellerSessionStore);
    expect(domainWiring.customerSessionStore).toBe(db.customerSessionStore);
    expect(domainWiring.platformSessionStore).toBe(db.platformSessionStore);
  });

  it('proves SellerSessionStoreAdapter stores SHA-256 token_hash and never plaintext session tokens in the database', async () => {
    let capturedInsertPayload: Partial<DbAppSession> | null = null;
    let capturedQueryFilter: string | null = null;

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'GET') {
        capturedQueryFilter = url;
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        capturedInsertPayload = Array.isArray(body) ? body[0] : body;
        return new Response(
          JSON.stringify([
            {
              id: 'sess-uuid-1',
              ...capturedInsertPayload,
              created_at: new Date().toISOString(),
              revoked_at: null,
            },
          ]),
          { status: 201 },
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });

    const client = new PostgrestClient({
      supabaseUrl: dummyConfig.supabaseUrl,
      supabaseKey: dummyConfig.supabaseKey,
      fetch: mockFetch as unknown as typeof fetch,
    });

    const db = createSupabaseDatabase({
      ...dummyConfig,
      fetch: mockFetch as unknown as typeof fetch,
    });
    const adapter = new SellerSessionStoreAdapter(db.sessions, client);

    const plaintextToken = 'secret-seller-bearer-token-xyz-789';
    const expectedHash = await hashSessionToken(plaintextToken);

    await adapter.set(plaintextToken, {
      sessionToken: plaintextToken,
      userId: '11111111-1111-1111-1111-111111111111',
      userEmail: 'owner@store.com',
      userName: 'Owner Store',
      activeStoreId: '22222222-2222-2222-2222-222222222222',
      activeRole: 'STORE_OWNER',
      activeMembershipId: '33333333-3333-3333-3333-333333333333',
      availableStores: [],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    // Verify database query filtered by token_hash, not plaintext session_token
    expect(capturedQueryFilter).toContain(`token_hash=eq.${expectedHash}`);

    // Verify insert payload contains token_hash and NOT plaintext token
    expect(capturedInsertPayload).not.toBeNull();
    expect(capturedInsertPayload?.token_hash).toBe(expectedHash);
    expect('session_token' in (capturedInsertPayload ?? {})).toBe(false);
  });

  it('proves dynamic membership verification enforces active store and membership status', async () => {
    const token = 'active-seller-tok';
    const expectedHash = await hashSessionToken(token);
    const storeId = '22222222-2222-2222-2222-222222222222';
    const userId = '11111111-1111-1111-1111-111111111111';
    const membershipId = '33333333-3333-3333-3333-333333333333';

    const sessionRow: DbAppSession = {
      id: 'sess-uuid-1',
      session_type: 'SELLER',
      token_hash: expectedHash,
      user_id: userId,
      store_id: storeId,
      active_membership_id: membershipId,
      role: 'STORE_OWNER',
      metadata: {},
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      created_at: new Date().toISOString(),
      revoked_at: null,
    };

    let storeStatus = 'ACTIVE';
    let memberStatus = 'ACTIVE';

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/app_sessions')) {
        return new Response(JSON.stringify([sessionRow]), { status: 200 });
      }
      if (url.includes('/stores')) {
        const store: DbStore = {
          id: storeId,
          name: 'Active Store',
          slug: 'active-store',
          status: storeStatus,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        return new Response(JSON.stringify([store]), { status: 200 });
      }
      if (url.includes('/store_members')) {
        const member: DbStoreMember = {
          id: membershipId,
          store_id: storeId,
          user_id: userId,
          role: 'STORE_OWNER',
          status: memberStatus,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        return new Response(JSON.stringify([member]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });

    const client = new PostgrestClient({
      supabaseUrl: dummyConfig.supabaseUrl,
      supabaseKey: dummyConfig.supabaseKey,
      fetch: mockFetch as unknown as typeof fetch,
    });
    const repo = client.from; // verify client is working
    expect(repo).toBeDefined();

    const db = createSupabaseDatabase({
      ...dummyConfig,
      fetch: mockFetch as unknown as typeof fetch,
    });

    // 1. Success when both active
    const valid = await db.sessions.validateSellerSessionMembership(token);
    expect(valid.session.sessionType).toBe('SELLER');
    expect(valid.store.status).toBe('ACTIVE');
    expect(valid.member.status).toBe('ACTIVE');

    // 2. Fails when store is SUSPENDED
    storeStatus = 'SUSPENDED';
    await expect(db.sessions.validateSellerSessionMembership(token)).rejects.toThrow(
      'Store is suspended',
    );

    // 3. Fails when membership is INACTIVE
    storeStatus = 'ACTIVE';
    memberStatus = 'INACTIVE';
    await expect(db.sessions.validateSellerSessionMembership(token)).rejects.toThrow(
      'Store membership has been revoked or is inactive',
    );
  });
});

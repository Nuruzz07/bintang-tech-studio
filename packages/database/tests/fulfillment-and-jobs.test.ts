import { describe, it, expect, vi } from 'vitest';
import { PostgrestClient } from '../src/client.js';
import { SupabaseFulfillmentRepository } from '../src/repositories/fulfillment-repository.js';
import { SupabaseFulfillmentItemRepository } from '../src/repositories/fulfillment-item-repository.js';
import { SupabaseOutboxRepository } from '../src/repositories/outbox-repository.js';
import { SupabaseJobRepository } from '../src/repositories/job-repository.js';
import { SupabaseSecurityEventRepository } from '../src/repositories/security-event-repository.js';
import { createSupabaseDatabase } from '../src/factory.js';

describe('Fulfillment, Outbox & Background Jobs', () => {
  it('SupabaseFulfillmentRepository: creates fulfillment and finds active', async () => {
    const mockFulfillmentRow = {
      id: 'ful-1',
      store_id: 'store-1',
      order_id: 'ord-100',
      status: 'PENDING',
      fulfillment_type: 'DIGITAL_AUTO',
      delivery_payload: { trackingInfo: {}, failureReason: null, metadata: {} },
      created_at: '2026-10-08T00:00:00Z',
      updated_at: '2026-10-08T00:00:00Z',
    };

    const mockItemRow = {
      id: 'ful-item-1',
      fulfillment_id: 'ful-1',
      store_id: 'store-1',
      order_item_id: 'item-100',
      product_id: 'prod-1',
      inventory_item_id: 'item-1',
      status: 'PENDING',
      delivered_credential_reference: null,
      created_at: '2026-10-08T00:00:00Z',
    };

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        if (url.includes('fulfillment_items')) {
          return new Response(JSON.stringify([mockItemRow]), { status: 201 });
        }
        return new Response(JSON.stringify([mockFulfillmentRow]), { status: 201 });
      }
      if (url.includes('fulfillment_items')) {
        return new Response(JSON.stringify([mockItemRow]), { status: 200 });
      }
      return new Response(JSON.stringify([mockFulfillmentRow]), { status: 200 });
    });

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'test-key',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const repo = new SupabaseFulfillmentRepository(client);
    const created = await repo.create(
      'store-1',
      {
        id: 'ful-1',
        storeId: 'store-1',
        orderId: 'ord-100',
        strategy: 'DIGITAL_AUTO',
        status: 'PENDING',
        trackingInfo: {},
        failureReason: null,
        metadata: {},
        createdAt: '2026-10-08T00:00:00Z',
        updatedAt: '2026-10-08T00:00:00Z',
      },
      [
        {
          id: 'ful-item-1',
          storeId: 'store-1',
          fulfillmentId: 'ful-1',
          orderItemId: 'item-100',
          inventoryItemId: 'item-1',
          itemType: 'CREDENTIAL',
          status: 'PENDING',
          payloadReference: null,
          createdAt: '2026-10-08T00:00:00Z',
        },
      ],
    );

    expect(created.status).toBe('PENDING');
    expect(created.items).toHaveLength(1);

    const active = await repo.findActiveByOrderId('store-1', 'ord-100');
    expect(active).not.toBeNull();
    expect(active?.strategy).toBe('DIGITAL_AUTO');
  });

  it('SupabaseFulfillmentItemRepository: updates delivered credential payload reference', async () => {
    const mockItemRow = {
      id: 'ful-item-1',
      fulfillment_id: 'ful-1',
      store_id: 'store-1',
      order_item_id: 'item-100',
      product_id: 'prod-1',
      inventory_item_id: 'item-1',
      status: 'DELIVERED',
      delivered_credential_reference: 'ENC-SECRET-TOKEN-999',
      created_at: '2026-10-08T00:00:00Z',
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([mockItemRow]), { status: 200 }));

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'test-key',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const repo = new SupabaseFulfillmentItemRepository(client);
    const updated = await repo.updateItem('store-1', 'ful-item-1', {
      status: 'DELIVERED',
      payloadReference: 'ENC-SECRET-TOKEN-999',
    });
    expect(updated.status).toBe('DELIVERED');
    expect(updated.payloadReference).toBe('ENC-SECRET-TOKEN-999');
  });

  it('SupabaseOutboxRepository: enqueues and transitions event status', async () => {
    const mockOutboxRow = {
      id: 'outbox-1',
      event_name: 'ORDER_PAID',
      aggregate_type: 'Order',
      aggregate_id: 'ord-100',
      store_id: 'store-1',
      correlation_id: 'corr-123',
      causation_id: null,
      payload: { amount: 50000 },
      status: 'PENDING',
      attempts: 0,
      locked_until: null,
      processed_at: null,
      error: null,
      created_at: '2026-10-08T00:00:00Z',
    };

    const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return new Response(JSON.stringify([{ ...mockOutboxRow, status: 'PUBLISHED' }]), {
          status: 200,
        });
      }
      return new Response(JSON.stringify([mockOutboxRow]), { status: 200 });
    });

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'test-key',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const repo = new SupabaseOutboxRepository(client);
    const pending = await repo.fetchPending(10);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.eventName).toBe('ORDER_PAID');

    const published = await repo.markPublished('outbox-1');
    expect(published.status).toBe('PUBLISHED');
  });

  it('SupabaseJobRepository: enqueues, marks running and completed', async () => {
    const mockJobRow = {
      id: 'job-1',
      job_type: 'FULFILL_ORDER',
      queue_name: 'default',
      payload: { orderId: 'ord-100' },
      status: 'QUEUED',
      attempts: 0,
      max_attempts: 3,
      locked_until: null,
      error: null,
      created_at: '2026-10-08T00:00:00Z',
      processed_at: null,
    };

    const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return new Response(JSON.stringify([{ ...mockJobRow, status: 'COMPLETED' }]), {
          status: 200,
        });
      }
      return new Response(JSON.stringify([mockJobRow]), { status: 200 });
    });

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'test-key',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const repo = new SupabaseJobRepository(client);
    const queued = await repo.fetchQueued('default', 10);
    expect(queued).toHaveLength(1);
    expect(queued[0]?.jobType).toBe('FULFILL_ORDER');

    const completed = await repo.markCompleted('job-1');
    expect(completed.status).toBe('COMPLETED');
  });

  it('SupabaseSecurityEventRepository: records security events and lists for store', async () => {
    const mockSecRow = {
      id: 'sec-1',
      store_id: 'store-1',
      actor_user_id: 'user-1',
      event_type: 'FAILED_LOGIN_ATTEMPT',
      severity: 'MEDIUM',
      details: { ip: '10.0.0.1' },
      created_at: '2026-10-08T00:00:00Z',
    };

    const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify([mockSecRow]), { status: 201 });
      }
      return new Response(JSON.stringify([mockSecRow]), { status: 200 });
    });

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'test-key',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const repo = new SupabaseSecurityEventRepository(client);
    const recorded = await repo.recordEvent({
      storeId: 'store-1',
      actorUserId: 'user-1',
      eventType: 'FAILED_LOGIN_ATTEMPT',
      severity: 'MEDIUM',
      details: { ip: '10.0.0.1' },
    });
    expect(recorded.eventType).toBe('FAILED_LOGIN_ATTEMPT');

    const list = await repo.listForStore('store-1');
    expect(list).toHaveLength(1);
    expect(list[0]?.severity).toBe('MEDIUM');
  });

  it('createSupabaseDatabase factory: instantiates all repositories and evaluates health', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([{ id: 'store-1' }]), { status: 200 }));

    const db = createSupabaseDatabase({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'test-anon-key',
      fetch: mockFetch as unknown as typeof fetch,
    });

    expect(db.stores).toBeDefined();
    expect(db.products).toBeDefined();
    expect(db.orders).toBeDefined();
    expect(db.inventory).toBeDefined();
    expect(db.payments).toBeDefined();
    expect(db.fulfillments).toBeDefined();

    const health = await db.checkHealth();
    expect(health.status).toBe('UP');
    expect(health.isCritical).toBe(true);
    expect(health.name).toBe('database');
  });
});

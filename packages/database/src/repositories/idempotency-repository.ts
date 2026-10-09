import { PostgrestClient } from '../client.js';
import { DbIdempotencyRecord } from '../types.js';
import type {
  IdempotencyRepository as OrdersIdempotencyRepository,
  IdempotencyRecord as OrdersIdempotencyRecord,
} from '@bintang/orders';
import type { PaymentIdempotencyRepository, PaymentIdempotencyRecord } from '@bintang/payments';
import type {
  FulfillmentIdempotencyRepository,
  FulfillmentIdempotencyRecord,
} from '@bintang/fulfillment';

export class IdempotencyPayloadConflictError extends Error {
  constructor(message = 'Idempotency key reused with different request payload') {
    super(message);
    this.name = 'IdempotencyPayloadConflictError';
  }
}

export class IdempotencyInFlightError extends Error {
  constructor(message = 'A request with this idempotency key is already in flight') {
    super(message);
    this.name = 'IdempotencyInFlightError';
  }
}

export interface AcquireIdempotencyResult {
  readonly acquired: boolean;
  readonly cachedResponse?: Record<string, unknown> | undefined;
}

export interface IdempotencyRecord {
  readonly id: string;
  readonly storeId: string | null;
  readonly scope: string;
  readonly key: string;
  readonly requestHash: string;
  readonly status: 'PENDING' | 'COMPLETED' | 'FAILED';
  readonly responsePayload: Record<string, unknown> | null;
  readonly errorPayload: Record<string, unknown> | null;
  readonly createdAt: string;
  readonly expiresAt: string;
}

function toDomain(row: DbIdempotencyRecord): IdempotencyRecord {
  return {
    id: row.id,
    storeId: row.store_id,
    scope: row.scope,
    key: row.idempotency_key,
    requestHash: row.request_hash,
    status: row.status,
    responsePayload: row.response_payload,
    errorPayload: row.error_payload,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export class SupabaseIdempotencyRepository {
  private readonly client: PostgrestClient;

  constructor(client: PostgrestClient) {
    this.client = client;
  }

  public computeHash(payload: unknown): string {
    const serialized = JSON.stringify(payload ?? {});
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
      const char = serialized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return `hash_${Math.abs(hash).toString(16)}`;
  }

  async acquire(
    scope: DbIdempotencyRecord['scope'],
    key: string,
    payload: unknown,
    storeId?: string,
    ttlSeconds = 86400,
  ): Promise<AcquireIdempotencyResult> {
    const requestHash = this.computeHash(payload);

    // 1. Check existing record (scoped to storeId if provided)
    let query = this.client
      .from<DbIdempotencyRecord>('idempotency_records')
      .select('*')
      .eq('scope', scope)
      .eq('idempotency_key', key);

    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    const existing = await query.maybeSingle();

    if (existing) {
      // If hash differs, reject with conflict error
      if (existing.request_hash !== requestHash) {
        throw new IdempotencyPayloadConflictError(
          `Idempotency key "${key}" in scope "${scope}" was previously used with a different payload.`,
        );
      }

      // If completed, return cached response
      if (existing.status === 'COMPLETED' && existing.response_payload) {
        return {
          acquired: false,
          cachedResponse: existing.response_payload,
        };
      }

      // If pending and not expired, reject concurrent in-flight attempt
      const now = new Date();
      if (existing.status === 'PENDING' && new Date(existing.expires_at) > now) {
        throw new IdempotencyInFlightError(
          `Request with idempotency key "${key}" is currently being processed.`,
        );
      }

      // If failed or expired pending, allow re-acquisition by updating status to PENDING
      const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
      await this.client
        .from<DbIdempotencyRecord>('idempotency_records')
        .eq('id', existing.id)
        .update({
          status: 'PENDING',
          request_hash: requestHash,
          expires_at: expiresAt,
        });

      return { acquired: true };
    }

    // 2. Insert new idempotency record
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
    const insertPayload: Partial<DbIdempotencyRecord> = {
      scope,
      idempotency_key: key,
      request_hash: requestHash,
      status: 'PENDING',
      expires_at: expiresAt,
    };
    if (storeId) {
      insertPayload.store_id = storeId;
    }

    try {
      await this.client.from<DbIdempotencyRecord>('idempotency_records').insert(insertPayload);
      return { acquired: true };
    } catch {
      // If a concurrent insert occurred between SELECT and INSERT, unique constraint triggers
      let recheckQuery = this.client
        .from<DbIdempotencyRecord>('idempotency_records')
        .select('*')
        .eq('scope', scope)
        .eq('idempotency_key', key);

      if (storeId) {
        recheckQuery = recheckQuery.eq('store_id', storeId);
      }

      const rechecked = await recheckQuery.single();

      if (rechecked.request_hash !== requestHash) {
        throw new IdempotencyPayloadConflictError(
          `Idempotency key "${key}" was concurrently claimed with a different payload.`,
        );
      }

      if (rechecked.status === 'COMPLETED' && rechecked.response_payload) {
        return {
          acquired: false,
          cachedResponse: rechecked.response_payload,
        };
      }

      throw new IdempotencyInFlightError(
        `Request with idempotency key "${key}" is currently being processed.`,
      );
    }
  }

  async complete(
    scope: DbIdempotencyRecord['scope'],
    key: string,
    responsePayload: Record<string, unknown>,
    storeId?: string,
  ): Promise<void> {
    let query = this.client
      .from<DbIdempotencyRecord>('idempotency_records')
      .eq('scope', scope)
      .eq('idempotency_key', key);

    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    await query.update({
      status: 'COMPLETED',
      response_payload: responsePayload,
    });
  }

  async fail(
    scope: DbIdempotencyRecord['scope'],
    key: string,
    errorPayload: Record<string, unknown>,
    storeId?: string,
  ): Promise<void> {
    let query = this.client
      .from<DbIdempotencyRecord>('idempotency_records')
      .eq('scope', scope)
      .eq('idempotency_key', key);

    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    await query.update({
      status: 'FAILED',
      error_payload: errorPayload,
    });
  }

  async findByKey(
    scope: DbIdempotencyRecord['scope'],
    key: string,
    storeId?: string,
  ): Promise<IdempotencyRecord | null> {
    let query = this.client
      .from<DbIdempotencyRecord>('idempotency_records')
      .select('*')
      .eq('scope', scope)
      .eq('idempotency_key', key);

    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    const row = await query.maybeSingle();

    return row ? toDomain(row) : null;
  }
}

/**
 * Adapts Supabase idempotency_records to @bintang/orders IdempotencyRepository interface.
 */
export class OrdersIdempotencyAdapter implements OrdersIdempotencyRepository {
  private readonly client: PostgrestClient;

  constructor(client: PostgrestClient) {
    this.client = client;
  }

  private compositeKey(actorId: string, key: string): string {
    return `${actorId}:${key}`;
  }

  async get(
    storeId: string,
    actorId: string,
    key: string,
  ): Promise<OrdersIdempotencyRecord | null> {
    const composite = this.compositeKey(actorId, key);
    const row = await this.client
      .from<DbIdempotencyRecord>('idempotency_records')
      .select('*')
      .eq('scope', 'checkout')
      .eq('store_id', storeId)
      .eq('idempotency_key', composite)
      .maybeSingle();

    if (!row || row.status !== 'COMPLETED') {
      return null;
    }

    return {
      key,
      storeId: row.store_id ?? storeId,
      actorId,
      requestHash: row.request_hash,
      response: row.response_payload,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }

  async set(record: OrdersIdempotencyRecord): Promise<void> {
    const composite = this.compositeKey(record.actorId, record.key);
    const expiresAt = record.expiresAt ?? new Date(Date.now() + 86400 * 1000).toISOString();

    const existing = await this.client
      .from<DbIdempotencyRecord>('idempotency_records')
      .select('*')
      .eq('scope', 'checkout')
      .eq('store_id', record.storeId)
      .eq('idempotency_key', composite)
      .maybeSingle();

    if (existing) {
      await this.client
        .from<DbIdempotencyRecord>('idempotency_records')
        .eq('id', existing.id)
        .update({
          status: 'COMPLETED',
          request_hash: record.requestHash,
          response_payload: (record.response ?? {}) as Record<string, unknown>,
          expires_at: expiresAt,
        });
    } else {
      await this.client.from<DbIdempotencyRecord>('idempotency_records').insert({
        scope: 'checkout',
        store_id: record.storeId,
        idempotency_key: composite,
        request_hash: record.requestHash,
        status: 'COMPLETED',
        response_payload: (record.response ?? {}) as Record<string, unknown>,
        expires_at: expiresAt,
      });
    }
  }
}

/**
 * Adapts Supabase idempotency_records to @bintang/payments PaymentIdempotencyRepository interface.
 */
export class PaymentsIdempotencyAdapter implements PaymentIdempotencyRepository {
  private readonly client: PostgrestClient;

  constructor(client: PostgrestClient) {
    this.client = client;
  }

  private compositeKey(actorId: string, key: string): string {
    return `${actorId}:${key}`;
  }

  async get(
    storeId: string,
    actorId: string,
    key: string,
  ): Promise<PaymentIdempotencyRecord | null> {
    const composite = this.compositeKey(actorId, key);
    const row = await this.client
      .from<DbIdempotencyRecord>('idempotency_records')
      .select('*')
      .eq('scope', 'payment_command')
      .eq('store_id', storeId)
      .eq('idempotency_key', composite)
      .maybeSingle();

    if (!row || row.status !== 'COMPLETED') {
      return null;
    }

    return {
      key,
      storeId: row.store_id ?? storeId,
      actorId,
      requestHash: row.request_hash,
      response: row.response_payload,
      createdAt: row.created_at,
    };
  }

  async set(record: PaymentIdempotencyRecord): Promise<void> {
    const composite = this.compositeKey(record.actorId, record.key);
    const expiresAt = new Date(Date.now() + 86400 * 1000).toISOString();

    const existing = await this.client
      .from<DbIdempotencyRecord>('idempotency_records')
      .select('*')
      .eq('scope', 'payment_command')
      .eq('store_id', record.storeId)
      .eq('idempotency_key', composite)
      .maybeSingle();

    if (existing) {
      await this.client
        .from<DbIdempotencyRecord>('idempotency_records')
        .eq('id', existing.id)
        .update({
          status: 'COMPLETED',
          request_hash: record.requestHash,
          response_payload: (record.response ?? {}) as Record<string, unknown>,
          expires_at: expiresAt,
        });
    } else {
      await this.client.from<DbIdempotencyRecord>('idempotency_records').insert({
        scope: 'payment_command',
        store_id: record.storeId,
        idempotency_key: composite,
        request_hash: record.requestHash,
        status: 'COMPLETED',
        response_payload: (record.response ?? {}) as Record<string, unknown>,
        expires_at: expiresAt,
      });
    }
  }
}

/**
 * Adapts Supabase idempotency_records to @bintang/fulfillment FulfillmentIdempotencyRepository interface.
 */
export class FulfillmentIdempotencyAdapter implements FulfillmentIdempotencyRepository {
  private readonly client: PostgrestClient;

  constructor(client: PostgrestClient) {
    this.client = client;
  }

  private compositeKey(actorId: string, key: string): string {
    return `${actorId}:${key}`;
  }

  async get(
    storeId: string,
    actorId: string,
    key: string,
  ): Promise<FulfillmentIdempotencyRecord | null> {
    const composite = this.compositeKey(actorId, key);
    const row = await this.client
      .from<DbIdempotencyRecord>('idempotency_records')
      .select('*')
      .eq('scope', 'fulfillment')
      .eq('store_id', storeId)
      .eq('idempotency_key', composite)
      .maybeSingle();

    if (!row || row.status !== 'COMPLETED') {
      return null;
    }

    return {
      key,
      storeId: row.store_id ?? storeId,
      actorId,
      requestHash: row.request_hash,
      response: row.response_payload,
      createdAt: row.created_at,
    };
  }

  async set(record: FulfillmentIdempotencyRecord): Promise<void> {
    const composite = this.compositeKey(record.actorId, record.key);
    const expiresAt = new Date(Date.now() + 86400 * 1000).toISOString();

    const existing = await this.client
      .from<DbIdempotencyRecord>('idempotency_records')
      .select('*')
      .eq('scope', 'fulfillment')
      .eq('store_id', record.storeId)
      .eq('idempotency_key', composite)
      .maybeSingle();

    if (existing) {
      await this.client
        .from<DbIdempotencyRecord>('idempotency_records')
        .eq('id', existing.id)
        .update({
          status: 'COMPLETED',
          request_hash: record.requestHash,
          response_payload: (record.response ?? {}) as Record<string, unknown>,
          expires_at: expiresAt,
        });
    } else {
      await this.client.from<DbIdempotencyRecord>('idempotency_records').insert({
        scope: 'fulfillment',
        store_id: record.storeId,
        idempotency_key: composite,
        request_hash: record.requestHash,
        status: 'COMPLETED',
        response_payload: (record.response ?? {}) as Record<string, unknown>,
        expires_at: expiresAt,
      });
    }
  }
}

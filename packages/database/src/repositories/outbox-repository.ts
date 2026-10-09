import { PostgrestClient } from '../client.js';
import { DbOutboxEvent } from '../types.js';

export interface OutboxEvent {
  readonly id: string;
  readonly eventName: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly storeId: string | null;
  readonly correlationId: string | null;
  readonly causationId: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly status: 'PENDING' | 'PROCESSING' | 'PUBLISHED' | 'FAILED' | 'DEAD_LETTER';
  readonly attempts: number;
  readonly lockedUntil: string | null;
  readonly processedAt: string | null;
  readonly error: string | null;
  readonly createdAt: string;
}

export interface EnqueueOutboxEventInput {
  readonly eventName: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly storeId?: string | null | undefined;
  readonly correlationId?: string | null | undefined;
  readonly causationId?: string | null | undefined;
  readonly payload: Record<string, unknown>;
}

function toDomain(row: DbOutboxEvent): OutboxEvent {
  return {
    id: row.id,
    eventName: row.event_name,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    storeId: row.store_id,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    payload: row.payload,
    status: row.status as OutboxEvent['status'],
    attempts: row.attempts,
    lockedUntil: row.locked_until,
    processedAt: row.processed_at,
    error: row.error,
    createdAt: row.created_at,
  };
}

export class SupabaseOutboxRepository {
  private readonly client: PostgrestClient;

  constructor(client: PostgrestClient) {
    this.client = client;
  }

  async enqueue(input: EnqueueOutboxEventInput): Promise<OutboxEvent> {
    const payload: Partial<DbOutboxEvent> = {
      event_name: input.eventName,
      aggregate_type: input.aggregateType,
      aggregate_id: input.aggregateId,
      store_id: input.storeId ?? null,
      correlation_id: input.correlationId ?? null,
      causation_id: input.causationId ?? null,
      payload: input.payload,
      status: 'PENDING',
      attempts: 0,
    };

    const inserted = await this.client.from<DbOutboxEvent>('outbox_events').insert(payload);
    const row = inserted[0];
    if (!row) {
      throw new Error('Failed to enqueue outbox event');
    }
    return toDomain(row);
  }

  async fetchPending(limit = 50): Promise<readonly OutboxEvent[]> {
    const rows = await this.client
      .from<DbOutboxEvent>('outbox_events')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', true)
      .limit(limit)
      .execute();
    return Object.freeze(rows.map(toDomain));
  }

  async markPublished(id: string): Promise<OutboxEvent> {
    const rows = await this.client.from<DbOutboxEvent>('outbox_events').eq('id', id).update({
      status: 'PUBLISHED',
      processed_at: new Date().toISOString(),
    });
    const row = rows[0];
    if (!row) {
      throw new Error(`Outbox event ${id} not found`);
    }
    return toDomain(row);
  }

  async markFailed(id: string, error: string): Promise<OutboxEvent> {
    const rows = await this.client.from<DbOutboxEvent>('outbox_events').eq('id', id).update({
      status: 'FAILED',
      error,
      processed_at: new Date().toISOString(),
    });
    const row = rows[0];
    if (!row) {
      throw new Error(`Outbox event ${id} not found`);
    }
    return toDomain(row);
  }
}

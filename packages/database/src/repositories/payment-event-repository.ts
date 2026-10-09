import {
  PaymentEvent,
  PaymentEventProcessingStatus,
  PaymentEventRepository,
} from '@bintang/payments';
import { PostgrestClient } from '../client.js';
import { DbPaymentEvent } from '../types.js';

function toDomain(row: DbPaymentEvent): PaymentEvent {
  const payload = row.payload ?? {};
  return {
    id: row.id,
    storeId: row.store_id,
    paymentIntentId:
      typeof payload['paymentIntentId'] === 'string' ? payload['paymentIntentId'] : null,
    paymentAttemptId:
      typeof payload['paymentAttemptId'] === 'string' ? payload['paymentAttemptId'] : null,
    provider: row.provider,
    eventId: row.provider_event_id,
    eventType: row.event_type,
    payload,
    processingStatus: row.status as PaymentEventProcessingStatus,
    processedAt: row.processed_at,
    createdAt: row.created_at,
  };
}

export class SupabasePaymentEventRepository implements PaymentEventRepository {
  private readonly client: PostgrestClient;

  constructor(client: PostgrestClient) {
    this.client = client;
  }

  async create(event: PaymentEvent): Promise<PaymentEvent> {
    const payloadWithRefs = {
      ...(event.payload ?? {}),
      paymentIntentId: event.paymentIntentId,
      paymentAttemptId: event.paymentAttemptId,
    };

    const payload: Partial<DbPaymentEvent> = {
      id: event.id,
      store_id: event.storeId,
      provider: event.provider,
      provider_event_id: event.eventId,
      event_type: event.eventType,
      status: event.processingStatus,
      payload: payloadWithRefs,
    };

    const inserted = await this.client.from<DbPaymentEvent>('payment_events').insert(payload);
    const row = inserted[0];
    if (!row) {
      throw new Error('Failed to insert payment event: empty response');
    }
    return toDomain(row);
  }

  async findById(id: string): Promise<PaymentEvent | null> {
    const row = await this.client
      .from<DbPaymentEvent>('payment_events')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return row ? toDomain(row) : null;
  }

  async findByProviderEventId(provider: string, eventId: string): Promise<PaymentEvent | null> {
    const row = await this.client
      .from<DbPaymentEvent>('payment_events')
      .select('*')
      .eq('provider', provider)
      .eq('provider_event_id', eventId)
      .maybeSingle();
    return row ? toDomain(row) : null;
  }

  async updateProcessingStatus(
    id: string,
    status: PaymentEventProcessingStatus,
    processedAt?: string,
  ): Promise<PaymentEvent> {
    const rows = await this.client
      .from<DbPaymentEvent>('payment_events')
      .eq('id', id)
      .update({
        status,
        processed_at: processedAt ?? new Date().toISOString(),
      });
    const row = rows[0];
    if (!row) {
      throw new Error(`Payment event not found for status update: ${id}`);
    }
    return toDomain(row);
  }
}

import {
  PaymentIntent,
  PaymentIntentFilter,
  PaymentIntentRepository,
  PaymentIntentStatus,
} from '@bintang/payments';
import { PostgrestClient } from '../client.js';
import { DbPayment } from '../types.js';

function toDomain(row: DbPayment): PaymentIntent {
  const metadata = row.metadata ?? {};
  const customerId = typeof metadata['customerId'] === 'string' ? metadata['customerId'] : '';
  const idempotencyKey =
    typeof metadata['idempotencyKey'] === 'string' ? metadata['idempotencyKey'] : null;

  return {
    id: row.id,
    storeId: row.store_id,
    orderId: row.order_id,
    customerId,
    amount: row.amount,
    currency: row.currency,
    status: row.status as PaymentIntentStatus,
    paymentAccountId: row.payment_account_id ?? '',
    provider: row.provider,
    idempotencyKey,
    metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at ?? row.created_at,
  };
}

export class SupabasePaymentRepository implements PaymentIntentRepository {
  private readonly client: PostgrestClient;

  constructor(client: PostgrestClient) {
    this.client = client;
  }

  async create(storeId: string, intent: PaymentIntent): Promise<PaymentIntent> {
    const metadata = {
      ...(intent.metadata ?? {}),
      customerId: intent.customerId,
      idempotencyKey: intent.idempotencyKey,
    };

    const payload: Partial<DbPayment> = {
      id: intent.id,
      store_id: storeId,
      order_id: intent.orderId,
      payment_account_id: intent.paymentAccountId || null,
      provider: intent.provider,
      amount: intent.amount,
      currency: intent.currency,
      status: intent.status,
      expires_at: intent.expiresAt,
      metadata,
    };

    const inserted = await this.client.from<DbPayment>('payments').insert(payload);
    const row = inserted[0];
    if (!row) {
      throw new Error('Failed to insert payment: empty response');
    }
    return toDomain(row);
  }

  async findById(storeId: string, id: string): Promise<PaymentIntent | null> {
    const row = await this.client
      .from<DbPayment>('payments')
      .select('*')
      .eq('store_id', storeId)
      .eq('id', id)
      .maybeSingle();
    return row ? toDomain(row) : null;
  }

  async findByOrderId(storeId: string, orderId: string): Promise<readonly PaymentIntent[]> {
    const rows = await this.client
      .from<DbPayment>('payments')
      .select('*')
      .eq('store_id', storeId)
      .eq('order_id', orderId)
      .execute();
    return Object.freeze(rows.map(toDomain));
  }

  async list(storeId: string, filter?: PaymentIntentFilter): Promise<readonly PaymentIntent[]> {
    let builder = this.client.from<DbPayment>('payments').select('*').eq('store_id', storeId);

    if (filter?.status) {
      if (typeof filter.status === 'string') {
        builder = builder.eq('status', filter.status);
      } else {
        builder = builder.in('status', filter.status as readonly string[]);
      }
    }
    if (filter?.orderId) {
      builder = builder.eq('order_id', filter.orderId);
    }

    const rows = await builder.execute();
    return Object.freeze(rows.map(toDomain));
  }

  async updateStatus(
    storeId: string,
    id: string,
    status: PaymentIntentStatus,
    metadata?: Readonly<Record<string, unknown>>,
  ): Promise<PaymentIntent> {
    const existing = await this.findById(storeId, id);
    if (!existing) {
      throw new Error(`Payment intent ${id} not found in store ${storeId}`);
    }

    const mergedMetadata: Record<string, unknown> = {
      ...existing.metadata,
      ...(metadata ?? {}),
    };

    const rows = await this.client
      .from<DbPayment>('payments')
      .eq('store_id', storeId)
      .eq('id', id)
      .update({
        status,
        metadata: mergedMetadata,
        updated_at: new Date().toISOString(),
      });
    const row = rows[0];
    if (!row) {
      throw new Error(`Payment intent not found for status update: ${id}`);
    }
    return toDomain(row);
  }
}

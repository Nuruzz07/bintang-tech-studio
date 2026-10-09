import { PostgrestClient } from '../client.js';
import { DbSecurityEvent } from '../types.js';

export interface SecurityEvent {
  readonly id: string;
  readonly storeId: string | null;
  readonly actorUserId: string | null;
  readonly eventType: string;
  readonly severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly details: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export interface RecordSecurityEventInput {
  readonly storeId?: string | null | undefined;
  readonly actorUserId?: string | null | undefined;
  readonly eventType: string;
  readonly severity?: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | undefined;
  readonly details: Record<string, unknown>;
}

function toDomain(row: DbSecurityEvent): SecurityEvent {
  return {
    id: row.id,
    storeId: row.store_id,
    actorUserId: row.actor_user_id,
    eventType: row.event_type,
    severity: row.severity as SecurityEvent['severity'],
    details: row.details,
    createdAt: row.created_at,
  };
}

export class SupabaseSecurityEventRepository {
  private readonly client: PostgrestClient;

  constructor(client: PostgrestClient) {
    this.client = client;
  }

  async recordEvent(input: RecordSecurityEventInput): Promise<SecurityEvent> {
    const payload: Partial<DbSecurityEvent> = {
      store_id: input.storeId ?? null,
      actor_user_id: input.actorUserId ?? null,
      event_type: input.eventType,
      severity: input.severity ?? 'INFO',
      details: input.details,
    };

    const inserted = await this.client.from<DbSecurityEvent>('security_events').insert(payload);
    const row = inserted[0];
    if (!row) {
      throw new Error('Failed to record security event');
    }
    return toDomain(row);
  }

  async listForStore(storeId: string, limit = 50): Promise<readonly SecurityEvent[]> {
    const rows = await this.client
      .from<DbSecurityEvent>('security_events')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', false)
      .limit(limit)
      .execute();
    return Object.freeze(rows.map(toDomain));
  }
}

import { PostgrestClient } from '../client.js';
import { DbJob } from '../types.js';

export interface BackgroundJob {
  readonly id: string;
  readonly jobType: string;
  readonly queueName: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly lockedUntil: string | null;
  readonly error: string | null;
  readonly createdAt: string;
  readonly processedAt: string | null;
}

export interface EnqueueJobInput {
  readonly jobType: string;
  readonly queueName?: string | undefined;
  readonly payload: Record<string, unknown>;
  readonly maxAttempts?: number | undefined;
}

function toDomain(row: DbJob): BackgroundJob {
  return {
    id: row.id,
    jobType: row.job_type,
    queueName: row.queue_name,
    payload: row.payload,
    status: row.status as BackgroundJob['status'],
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    lockedUntil: row.locked_until,
    error: row.error,
    createdAt: row.created_at,
    processedAt: row.processed_at,
  };
}

export class SupabaseJobRepository {
  private readonly client: PostgrestClient;

  constructor(client: PostgrestClient) {
    this.client = client;
  }

  async enqueue(input: EnqueueJobInput): Promise<BackgroundJob> {
    const payload: Partial<DbJob> = {
      job_type: input.jobType,
      queue_name: input.queueName ?? 'default',
      payload: input.payload,
      status: 'QUEUED',
      attempts: 0,
      max_attempts: input.maxAttempts ?? 3,
    };

    const inserted = await this.client.from<DbJob>('jobs').insert(payload);
    const row = inserted[0];
    if (!row) {
      throw new Error('Failed to enqueue background job');
    }
    return toDomain(row);
  }

  async fetchQueued(queueName = 'default', limit = 10): Promise<readonly BackgroundJob[]> {
    const rows = await this.client
      .from<DbJob>('jobs')
      .select('*')
      .eq('queue_name', queueName)
      .eq('status', 'QUEUED')
      .order('created_at', true)
      .limit(limit)
      .execute();
    return Object.freeze(rows.map(toDomain));
  }

  async markRunning(id: string, lockDurationSeconds = 60): Promise<BackgroundJob> {
    const lockUntil = new Date(Date.now() + lockDurationSeconds * 1000).toISOString();
    const rows = await this.client.from<DbJob>('jobs').eq('id', id).update({
      status: 'RUNNING',
      locked_until: lockUntil,
    });
    const row = rows[0];
    if (!row) {
      throw new Error(`Job ${id} not found`);
    }
    return toDomain(row);
  }

  async markCompleted(id: string): Promise<BackgroundJob> {
    const rows = await this.client.from<DbJob>('jobs').eq('id', id).update({
      status: 'COMPLETED',
      processed_at: new Date().toISOString(),
    });
    const row = rows[0];
    if (!row) {
      throw new Error(`Job ${id} not found`);
    }
    return toDomain(row);
  }

  async markFailed(id: string, error: string): Promise<BackgroundJob> {
    const rows = await this.client.from<DbJob>('jobs').eq('id', id).update({
      status: 'FAILED',
      error,
      processed_at: new Date().toISOString(),
    });
    const row = rows[0];
    if (!row) {
      throw new Error(`Job ${id} not found`);
    }
    return toDomain(row);
  }
}

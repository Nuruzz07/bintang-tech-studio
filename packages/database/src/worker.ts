import { PostgrestClient } from './client.js';
import { DbJob, DbOutboxEvent } from './types.js';
import { isMissingRpcError } from './errors.js';

export interface JobExecutionResult {
  readonly processed: boolean;
  readonly jobId?: string | undefined;
  readonly status?: 'COMPLETED' | 'RETRYING' | 'FAILED' | undefined;
  readonly attempts?: number | undefined;
  readonly error?: string | undefined;
}

export interface OutboxExecutionResult {
  readonly processed: boolean;
  readonly eventId?: string | undefined;
  readonly status?: 'PUBLISHED' | 'RETRYING' | 'DEAD_LETTER' | undefined;
  readonly attempts?: number | undefined;
  readonly error?: string | undefined;
}

export type JobHandler = (job: DbJob) => Promise<void>;
export type OutboxHandler = (event: DbOutboxEvent) => Promise<void>;

export class DurableQueueWorker {
  private readonly client: PostgrestClient;

  constructor(client: PostgrestClient) {
    this.client = client;
  }

  /**
   * Atomically claims and processes a single queued background job.
   * Utilizes PostgreSQL FOR UPDATE SKIP LOCKED to prevent duplicate execution across workers.
   */
  async processNextJob(
    queueName = 'default',
    handler: JobHandler,
    lockDurationSeconds = 60,
  ): Promise<JobExecutionResult> {
    let job: DbJob | null;
    try {
      const res = await this.client.rpc<DbJob | DbJob[] | null>('rpc_claim_job', {
        p_queue_name: queueName,
        p_lock_duration_seconds: lockDurationSeconds,
      });
      job = Array.isArray(res) ? (res[0] ?? null) : (res ?? null);
    } catch (err: unknown) {
      if (!isMissingRpcError(err)) {
        throw err;
      }
      // Fallback for mocked non-RPC environments
      const rows = await this.client
        .from<DbJob>('jobs')
        .select('*')
        .eq('queue_name', queueName)
        .eq('status', 'QUEUED')
        .limit(1)
        .execute();
      job = rows[0] ?? null;
      if (job) {
        await this.client
          .from<DbJob>('jobs')
          .eq('id', job.id)
          .update({
            status: 'RUNNING',
            attempts: job.attempts + 1,
          });
        job.attempts += 1;
      }
    }

    if (!job) {
      return { processed: false };
    }

    try {
      await handler(job);

      // On success: mark COMPLETED
      await this.client.from<DbJob>('jobs').eq('id', job.id).update({
        status: 'COMPLETED',
        processed_at: new Date().toISOString(),
        locked_until: null,
        error: null,
      });

      return {
        processed: true,
        jobId: job.id,
        status: 'COMPLETED',
        attempts: job.attempts,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isExhausted = job.attempts >= job.max_attempts;

      if (isExhausted) {
        // Permanent failure: mark FAILED
        await this.client.from<DbJob>('jobs').eq('id', job.id).update({
          status: 'FAILED',
          error: errorMsg,
          processed_at: new Date().toISOString(),
          locked_until: null,
        });

        return {
          processed: true,
          jobId: job.id,
          status: 'FAILED',
          attempts: job.attempts,
          error: errorMsg,
        };
      } else {
        // Transient failure: re-queue for retry
        await this.client.from<DbJob>('jobs').eq('id', job.id).update({
          status: 'QUEUED',
          error: errorMsg,
          locked_until: null,
        });

        return {
          processed: true,
          jobId: job.id,
          status: 'RETRYING',
          attempts: job.attempts,
          error: errorMsg,
        };
      }
    }
  }

  /**
   * Atomically claims and dispatches a single pending transactional outbox event.
   */
  async processNextOutboxEvent(
    handler: OutboxHandler,
    lockDurationSeconds = 60,
  ): Promise<OutboxExecutionResult> {
    let event: DbOutboxEvent | null;
    try {
      const res = await this.client.rpc<DbOutboxEvent | DbOutboxEvent[] | null>(
        'rpc_claim_outbox_event',
        {
          p_lock_duration_seconds: lockDurationSeconds,
        },
      );
      event = Array.isArray(res) ? (res[0] ?? null) : (res ?? null);
    } catch (err: unknown) {
      if (!isMissingRpcError(err)) {
        throw err;
      }
      // Fallback for mocked non-RPC environments
      const rows = await this.client
        .from<DbOutboxEvent>('outbox_events')
        .select('*')
        .eq('status', 'PENDING')
        .limit(1)
        .execute();
      event = rows[0] ?? null;
      if (event) {
        await this.client
          .from<DbOutboxEvent>('outbox_events')
          .eq('id', event.id)
          .update({
            status: 'PROCESSING',
            attempts: event.attempts + 1,
          });
        event.attempts += 1;
      }
    }

    if (!event) {
      return { processed: false };
    }

    try {
      await handler(event);

      // On success: mark PUBLISHED
      await this.client.from<DbOutboxEvent>('outbox_events').eq('id', event.id).update({
        status: 'PUBLISHED',
        processed_at: new Date().toISOString(),
        locked_until: null,
        error: null,
      });

      return {
        processed: true,
        eventId: event.id,
        status: 'PUBLISHED',
        attempts: event.attempts,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isDeadLetter = event.attempts >= 5;

      if (isDeadLetter) {
        await this.client.from<DbOutboxEvent>('outbox_events').eq('id', event.id).update({
          status: 'DEAD_LETTER',
          error: errorMsg,
          processed_at: new Date().toISOString(),
          locked_until: null,
        });

        return {
          processed: true,
          eventId: event.id,
          status: 'DEAD_LETTER',
          attempts: event.attempts,
          error: errorMsg,
        };
      } else {
        await this.client.from<DbOutboxEvent>('outbox_events').eq('id', event.id).update({
          status: 'PENDING',
          error: errorMsg,
          locked_until: null,
        });

        return {
          processed: true,
          eventId: event.id,
          status: 'RETRYING',
          attempts: event.attempts,
          error: errorMsg,
        };
      }
    }
  }
}

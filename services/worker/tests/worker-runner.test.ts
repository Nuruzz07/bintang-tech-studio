import { describe, it, expect, vi } from 'vitest';
import { WorkerRunner } from '../src/worker-runner.js';
import { DurableQueueWorker, DbJob, DbOutboxEvent, PostgrestClient } from '@bintang/database';

describe('WorkerRunner Lifecycle and Processing', () => {
  function createMockWorker(): {
    worker: DurableQueueWorker;
    mockProcessJob: ReturnType<typeof vi.fn>;
    mockProcessOutbox: ReturnType<typeof vi.fn>;
  } {
    const mockClient = new PostgrestClient({
      supabaseUrl: 'http://localhost:54321',
      supabaseAnonKey: 'mock',
    });
    const worker = new DurableQueueWorker(mockClient);

    const mockProcessJob = vi.fn().mockResolvedValue({ processed: false });
    const mockProcessOutbox = vi.fn().mockResolvedValue({ processed: false });

    worker.processNextJob = mockProcessJob;
    worker.processNextOutboxEvent = mockProcessOutbox;

    return { worker, mockProcessJob, mockProcessOutbox };
  }

  it('initializes in stopped state and reports DOWN health', () => {
    const { worker } = createMockWorker();
    const runner = new WorkerRunner({ worker });

    expect(runner.isRunning()).toBe(false);
    const health = runner.getHealth();
    expect(health.status).toBe('DOWN');
    expect(health.name).toBe('worker-runner');
    expect(runner.getStats().jobsProcessed).toBe(0);
  });

  it('dispatches outbox events to registered handlers', async () => {
    const { worker, mockProcessOutbox } = createMockWorker();

    const mockEvent: DbOutboxEvent = {
      id: 'outbox-1',
      aggregate_type: 'order',
      aggregate_id: 'ord-123',
      event_name: 'order.created',
      store_id: null,
      correlation_id: null,
      causation_id: null,
      payload: { total: 50000 },
      status: 'QUEUED',
      attempts: 0,
      locked_until: null,
      error: null,
      created_at: new Date().toISOString(),
      processed_at: null,
    };

    mockProcessOutbox
      .mockImplementationOnce(async (handler) => {
        await handler(mockEvent);
        return { processed: true, eventId: mockEvent.id, status: 'PUBLISHED' };
      })
      .mockResolvedValueOnce({ processed: false });

    const runner = new WorkerRunner({ worker, batchSize: 2 });
    let handledPayload: Record<string, unknown> | null = null;

    runner.registerOutboxHandler('order.created', async (payload) => {
      handledPayload = payload;
    });

    const result = await runner.tick();
    expect(result.eventsProcessed).toBe(1);
    expect(handledPayload).toEqual({ total: 50000 });
    expect(runner.getStats().outboxProcessed).toBe(1);
  });

  it('dispatches jobs to registered handlers and tracks stats', async () => {
    const { worker, mockProcessJob } = createMockWorker();

    const mockJob: DbJob = {
      id: 'job-1',
      queue_name: 'default',
      job_type: 'sync_inventory',
      payload: { sku: 'TEST-SKU' },
      status: 'QUEUED',
      attempts: 1,
      max_attempts: 3,
      locked_until: null,
      error: null,
      created_at: new Date().toISOString(),
      processed_at: null,
    };

    mockProcessJob
      .mockImplementationOnce(async (_queue, handler) => {
        await handler(mockJob);
        return { processed: true, jobId: mockJob.id, status: 'COMPLETED' };
      })
      .mockResolvedValueOnce({ processed: false });

    const runner = new WorkerRunner({ worker, batchSize: 2 });
    let handledJob: Record<string, unknown> | null = null;

    runner.registerJobHandler('sync_inventory', async (payload) => {
      handledJob = payload;
    });

    const result = await runner.tick();
    expect(result.jobsProcessed).toBe(1);
    expect(handledJob).toEqual({ sku: 'TEST-SKU' });
    expect(runner.getStats().jobsProcessed).toBe(1);
  });

  it('tracks failed jobs and outbox errors in stats', async () => {
    const { worker, mockProcessJob, mockProcessOutbox } = createMockWorker();

    mockProcessJob.mockResolvedValueOnce({
      processed: true,
      jobId: 'failed-job',
      status: 'RETRYING',
    });
    mockProcessOutbox.mockResolvedValueOnce({
      processed: true,
      eventId: 'failed-outbox',
      status: 'RETRYING',
    });

    const runner = new WorkerRunner({ worker, batchSize: 1 });
    await runner.tick();

    const stats = runner.getStats();
    expect(stats.jobsFailed).toBe(1);
    expect(stats.outboxFailed).toBe(1);
  });

  it('starts and stops gracefully without leaking loop or timers', async () => {
    const { worker } = createMockWorker();
    const runner = new WorkerRunner({
      worker,
      pollIntervalMs: 50,
      maxPollIntervalMs: 100,
    });

    await runner.start();
    expect(runner.isRunning()).toBe(true);
    expect(runner.getHealth().status).toBe('UP');

    // Allow loop to tick at least once
    await new Promise((r) => setTimeout(r, 80));

    await runner.stop();
    expect(runner.isRunning()).toBe(false);
    expect(runner.getHealth().status).toBe('DOWN');
  });
});

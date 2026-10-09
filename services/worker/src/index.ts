declare const process: {
  readonly env: Record<string, string | undefined>;
  readonly argv: readonly string[];
  readonly on?: (signal: string, callback: () => void) => void;
  readonly exit: (code?: number) => void;
};

import { createSupabaseDatabase } from '@bintang/database';
import { StructuredLogger } from '@bintang/observability';
import { WorkerRunner } from './worker-runner.js';

export * from './worker-runner.js';

export async function bootstrap(): Promise<WorkerRunner> {
  const logger = new StructuredLogger({
    requestId: 'worker-bootstrap',
  });

  const env = (typeof process !== 'undefined' ? process.env : {}) ?? {};
  const supabaseUrl = env['SUPABASE_URL'] ?? 'http://127.0.0.1:54321';
  const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'] ?? env['SUPABASE_ANON_KEY'] ?? 'mock_key';

  const db = createSupabaseDatabase({
    supabaseUrl,
    supabaseKey,
    serviceRoleKey: env['SUPABASE_SERVICE_ROLE_KEY'],
  });

  const runner = new WorkerRunner({
    worker: db.worker,
    queues: ['default', 'orders', 'notifications', 'fulfillment'],
    pollIntervalMs: Number(env['WORKER_POLL_INTERVAL_MS'] ?? 1000),
    maxPollIntervalMs: Number(env['WORKER_MAX_POLL_INTERVAL_MS'] ?? 5000),
    logger,
  });

  // Register standard outbox and job handlers
  runner.registerOutboxHandler('order.created', async (payload) => {
    logger.info('Processing outbox event: order.created', { payload });
  });

  runner.registerOutboxHandler('payment.settled', async (payload) => {
    logger.info('Processing outbox event: payment.settled', { payload });
  });

  runner.registerJobHandler('sync_inventory', async (payload) => {
    logger.info('Processing background job: sync_inventory', { payload });
  });

  runner.registerJobHandler('send_notification', async (payload) => {
    logger.info('Processing background job: send_notification', { payload });
  });

  // Signal handlers for graceful shutdown
  if (typeof process !== 'undefined' && process.on) {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Initiating graceful shutdown...`);
      await runner.stop();
      logger.info('Worker terminated gracefully.');
      process.exit(0);
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  }

  return runner;
}

// Auto-run if executed directly
if (
  typeof process !== 'undefined' &&
  process.argv &&
  (process.argv[1]?.endsWith('dist/index.js') || process.argv[1]?.endsWith('src/index.ts'))
) {
  void (async () => {
    const runner = await bootstrap();
    await runner.start();
  })();
}

import { DurableQueueWorker, DbJob, DbOutboxEvent } from '@bintang/database';
import { StructuredLogger, ComponentHealth } from '@bintang/observability';

export type JobPayloadHandler = (payload: Record<string, unknown>, job: DbJob) => Promise<void>;
export type OutboxPayloadHandler = (
  payload: Record<string, unknown>,
  event: DbOutboxEvent,
) => Promise<void>;

export interface WorkerRunnerOptions {
  readonly worker: DurableQueueWorker;
  readonly queues?: readonly string[] | undefined;
  readonly pollIntervalMs?: number | undefined;
  readonly maxPollIntervalMs?: number | undefined;
  readonly lockDurationSeconds?: number | undefined;
  readonly batchSize?: number | undefined;
  readonly logger?: StructuredLogger | undefined;
}

export interface WorkerStats {
  readonly jobsProcessed: number;
  readonly jobsFailed: number;
  readonly outboxProcessed: number;
  readonly outboxFailed: number;
  readonly uptimeSeconds: number;
}

export class WorkerRunner {
  private readonly worker: DurableQueueWorker;
  private readonly queues: readonly string[];
  private readonly pollIntervalMs: number;
  private readonly maxPollIntervalMs: number;
  private readonly lockDurationSeconds: number;
  private readonly batchSize: number;
  private readonly logger: StructuredLogger;

  private readonly jobHandlers = new Map<string, JobPayloadHandler>();
  private readonly outboxHandlers = new Map<string, OutboxPayloadHandler>();

  private isRunningState = false;
  private shouldStop = false;
  private currentLoopPromise: Promise<void> | null = null;
  private wakeUpResolver: (() => void) | null = null;

  private jobsProcessed = 0;
  private jobsFailed = 0;
  private outboxProcessed = 0;
  private outboxFailed = 0;
  private startedAt: number | null = null;

  constructor(options: WorkerRunnerOptions) {
    this.worker = options.worker;
    this.queues = options.queues && options.queues.length > 0 ? options.queues : ['default'];
    this.pollIntervalMs = options.pollIntervalMs ?? 1000;
    this.maxPollIntervalMs = options.maxPollIntervalMs ?? 5000;
    this.lockDurationSeconds = options.lockDurationSeconds ?? 60;
    this.batchSize = options.batchSize ?? 10;
    this.logger = options.logger ?? new StructuredLogger();
  }

  public registerJobHandler(jobType: string, handler: JobPayloadHandler): void {
    this.jobHandlers.set(jobType, handler);
  }

  public registerOutboxHandler(eventType: string, handler: OutboxPayloadHandler): void {
    this.outboxHandlers.set(eventType, handler);
  }

  public isRunning(): boolean {
    return this.isRunningState;
  }

  public getStats(): WorkerStats {
    return {
      jobsProcessed: this.jobsProcessed,
      jobsFailed: this.jobsFailed,
      outboxProcessed: this.outboxProcessed,
      outboxFailed: this.outboxFailed,
      uptimeSeconds: this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0,
    };
  }

  public getHealth(): ComponentHealth {
    return {
      name: 'worker-runner',
      status: this.isRunningState ? 'UP' : 'DOWN',
      isCritical: true,
      timestamp: new Date().toISOString(),
      details: {
        stats: this.getStats(),
        queues: this.queues,
      },
    };
  }

  /**
   * Executes a single processing tick across outbox events and all registered queues.
   */
  public async tick(): Promise<{ jobsProcessed: number; eventsProcessed: number }> {
    let eventsProcessedThisTick = 0;
    let jobsProcessedThisTick = 0;

    // 1. Drain outbox events up to batchSize
    for (let i = 0; i < this.batchSize; i++) {
      try {
        const outboxResult = await this.worker.processNextOutboxEvent(
          async (event: DbOutboxEvent) => {
            const handler = this.outboxHandlers.get(event.event_name);
            if (handler) {
              await handler(event.payload ?? {}, event);
            } else {
              this.logger.warn(`No handler registered for outbox event: ${event.event_name}`);
            }
          },
          this.lockDurationSeconds,
        );

        if (!outboxResult.processed) {
          break; // Queue is empty for now
        }

        if (outboxResult.status === 'PUBLISHED') {
          this.outboxProcessed++;
          eventsProcessedThisTick++;
        } else {
          this.outboxFailed++;
        }
      } catch (err) {
        this.outboxFailed++;
        this.logger.error('Error during outbox event processing tick', {
          error: {
            name: (err as Error).name,
            message: (err as Error).message,
            stack: (err as Error).stack,
          },
        });
        break;
      }
    }

    // 2. Drain background jobs across queues up to batchSize
    for (const queue of this.queues) {
      for (let i = 0; i < this.batchSize; i++) {
        try {
          const jobResult = await this.worker.processNextJob(
            queue,
            async (job: DbJob) => {
              const handler = this.jobHandlers.get(job.job_type);
              if (handler) {
                await handler(job.payload ?? {}, job);
              } else {
                this.logger.warn(`No handler registered for job type: ${job.job_type}`);
              }
            },
            this.lockDurationSeconds,
          );

          if (!jobResult.processed) {
            break; // No more jobs in this queue
          }

          if (jobResult.status === 'COMPLETED') {
            this.jobsProcessed++;
            jobsProcessedThisTick++;
          } else {
            this.jobsFailed++;
          }
        } catch (err) {
          this.jobsFailed++;
          this.logger.error('Error during job processing tick', {
            error: {
              name: (err as Error).name,
              message: (err as Error).message,
              stack: (err as Error).stack,
            },
          });
          break;
        }
      }
    }

    return {
      jobsProcessed: jobsProcessedThisTick,
      eventsProcessed: eventsProcessedThisTick,
    };
  }

  /**
   * Starts the worker polling loop.
   */
  public async start(): Promise<void> {
    if (this.isRunningState) {
      return;
    }

    this.isRunningState = true;
    this.shouldStop = false;
    this.startedAt = Date.now();
    this.logger.info('Starting durable worker runner...', {
      payload: { queues: this.queues },
    });

    this.currentLoopPromise = this.runLoop();
  }

  private async runLoop(): Promise<void> {
    let currentDelay = this.pollIntervalMs;

    while (!this.shouldStop) {
      try {
        const { jobsProcessed, eventsProcessed } = await this.tick();

        if (this.shouldStop) {
          break;
        }

        const workDone = jobsProcessed > 0 || eventsProcessed > 0;
        if (workDone) {
          currentDelay = this.pollIntervalMs; // Reset backoff on activity
        } else {
          // Exponential backoff up to maxPollIntervalMs
          await this.sleep(currentDelay);
          currentDelay = Math.min(Math.floor(currentDelay * 1.5), this.maxPollIntervalMs);
        }
      } catch (err) {
        this.logger.error('Unhandled exception in worker polling loop', {
          error: {
            name: (err as Error).name,
            message: (err as Error).message,
            stack: (err as Error).stack,
          },
        });
        await this.sleep(this.pollIntervalMs);
      }
    }

    this.isRunningState = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const wakeUp = () => {
        if (timer) clearTimeout(timer);
        this.wakeUpResolver = null;
        resolve();
      };
      this.wakeUpResolver = wakeUp;
      timer = setTimeout(wakeUp, ms);
    });
  }

  /**
   * Gracefully stops the worker, waking up any sleeping poll timer and waiting for in-flight tasks.
   */
  public async stop(): Promise<void> {
    if (!this.isRunningState && !this.currentLoopPromise) {
      return;
    }

    this.shouldStop = true;
    this.logger.info('Stopping durable worker runner...');

    if (this.wakeUpResolver) {
      this.wakeUpResolver();
    }

    if (this.currentLoopPromise) {
      await this.currentLoopPromise;
      this.currentLoopPromise = null;
    }

    this.isRunningState = false;
    this.logger.info('Durable worker runner stopped gracefully.', {
      payload: this.getStats(),
    });
  }
}

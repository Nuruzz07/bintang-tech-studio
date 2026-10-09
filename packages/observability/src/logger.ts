import { ObservabilityContext, maskSensitiveData } from './metadata.js';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface StructuredLogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly requestId?: string | undefined;
  readonly correlationId?: string | undefined;
  readonly causationId?: string | undefined;
  readonly storeId?: string | undefined;
  readonly actorUserId?: string | undefined;
  readonly payload?: Record<string, unknown> | undefined;
  readonly error?:
    | {
        readonly name: string;
        readonly message: string;
        readonly code?: string | undefined;
        readonly stack?: string | undefined;
      }
    | undefined;
  readonly eventType?: string | undefined;
  readonly severity?: string | undefined;
}

export type LogWriter = (entry: StructuredLogEntry) => void;

export class StructuredLogger {
  private readonly defaultContext?: Partial<ObservabilityContext> | undefined;
  private readonly writer: LogWriter;

  constructor(defaultContext?: Partial<ObservabilityContext>, writer?: LogWriter) {
    this.defaultContext = defaultContext;
    this.writer =
      writer ??
      ((entry) => {
        const json = JSON.stringify(entry);
        const con = (
          globalThis as unknown as {
            console?: {
              error: (s: string) => void;
              warn: (s: string) => void;
              log: (s: string) => void;
            };
          }
        ).console;
        if (con) {
          if (entry.level === 'ERROR') {
            con.error(json);
          } else if (entry.level === 'WARN') {
            con.warn(json);
          } else {
            con.log(json);
          }
        }
      });
  }

  private buildEntry(
    level: LogLevel,
    message: string,
    payload?: Record<string, unknown>,
    context?: Partial<ObservabilityContext>,
    error?: unknown,
  ): StructuredLogEntry {
    const ctx = { ...this.defaultContext, ...context };
    const maskedPayload = payload ? maskSensitiveData(payload) : undefined;

    let errorDetail: StructuredLogEntry['error'] | undefined;
    if (error) {
      if (error instanceof Error) {
        const errObj: { name: string; message: string; code?: string; stack?: string } = {
          name: error.name,
          message: error.message,
          ...(error.stack ? { stack: error.stack } : {}),
        };
        if ('code' in error && typeof (error as { code: unknown }).code === 'string') {
          errObj.code = (error as { code: string }).code;
        }
        errorDetail = errObj;
      } else {
        errorDetail = {
          name: 'UnknownError',
          message: String(error),
        };
      }
    }

    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
      ...(ctx.correlationId ? { correlationId: ctx.correlationId } : {}),
      ...(ctx.causationId ? { causationId: ctx.causationId } : {}),
      ...(ctx.storeId ? { storeId: ctx.storeId } : {}),
      ...(ctx.actorUserId ? { actorUserId: ctx.actorUserId } : {}),
      ...(maskedPayload ? { payload: maskedPayload } : {}),
      ...(errorDetail ? { error: errorDetail } : {}),
    };
  }

  debug(
    message: string,
    payload?: Record<string, unknown>,
    context?: Partial<ObservabilityContext>,
  ): void {
    const entry = this.buildEntry('DEBUG', message, payload, context);
    this.writer(entry);
  }

  info(
    message: string,
    payload?: Record<string, unknown>,
    context?: Partial<ObservabilityContext>,
  ): void {
    const entry = this.buildEntry('INFO', message, payload, context);
    this.writer(entry);
  }

  warn(
    message: string,
    payload?: Record<string, unknown>,
    context?: Partial<ObservabilityContext>,
  ): void {
    const entry = this.buildEntry('WARN', message, payload, context);
    this.writer(entry);
  }

  error(
    message: string,
    error?: unknown,
    payload?: Record<string, unknown>,
    context?: Partial<ObservabilityContext>,
  ): void {
    const entry = this.buildEntry('ERROR', message, payload, context, error);
    this.writer(entry);
  }

  security(
    eventType: string,
    severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    details: Record<string, unknown>,
    context?: Partial<ObservabilityContext>,
  ): void {
    const base = this.buildEntry('WARN', `[SECURITY:${severity}] ${eventType}`, details, context);
    const entry: StructuredLogEntry = {
      ...base,
      eventType,
      severity,
    };
    this.writer(entry);
  }

  business(
    eventName: string,
    entityType: string,
    entityId: string,
    details?: Record<string, unknown>,
    context?: Partial<ObservabilityContext>,
  ): void {
    const entry = this.buildEntry(
      'INFO',
      `[BIZ] ${eventName} (${entityType}:${entityId})`,
      { entityType, entityId, ...(details ?? {}) },
      context,
    );
    this.writer(entry);
  }
}

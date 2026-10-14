/**
 * Tenant- and Actor-scoped Idempotency Record.
 */
export interface IdempotencyRecord {
  readonly key: string;
  readonly storeId: string;
  readonly actorId: string;
  readonly requestHash: string;
  readonly response: unknown;
  readonly status?: 'PENDING' | 'COMPLETED' | 'FAILED' | undefined;
  readonly createdAt: string;
  readonly expiresAt?: string | undefined;
}

/**
 * Idempotency Repository contract.
 * Strictly scopes records by (storeId, actorId, key) to prevent cross-tenant/cross-actor key collision or leakage.
 */
export interface IdempotencyRepository {
  /**
   * Retrieves an existing idempotency record by storeId, actorId, and key.
   */
  get(storeId: string, actorId: string, key: string): Promise<IdempotencyRecord | null>;

  /**
   * Persists an idempotency record.
   */
  set(record: IdempotencyRecord): Promise<void>;

  /**
   * Atomically acquires an in-flight idempotency lease before executing business logic.
   * Enables cross-instance concurrency serialization in multi-node deployments.
   */
  acquire?(
    storeId: string,
    actorId: string,
    key: string,
    requestHash: string,
    ttlSeconds?: number,
  ): Promise<{ readonly acquired: boolean; readonly cachedResponse?: unknown }>;

  /**
   * Marks an in-flight idempotency record as failed so subsequent retries can succeed.
   */
  fail?(
    storeId: string,
    actorId: string,
    key: string,
    errorPayload?: Record<string, unknown>,
  ): Promise<void>;
}

/**
 * Tenant- and Actor-scoped Idempotency Record.
 */
export interface IdempotencyRecord {
  readonly key: string;
  readonly storeId: string;
  readonly actorId: string;
  readonly requestHash: string;
  readonly response: unknown;
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
}

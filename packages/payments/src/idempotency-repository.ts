export interface PaymentIdempotencyRecord {
  readonly key: string;
  readonly storeId: string;
  readonly actorId: string;
  readonly requestHash: string;
  readonly response: unknown;
  readonly createdAt: string;
}

export interface PaymentIdempotencyRepository {
  get(storeId: string, actorId: string, key: string): Promise<PaymentIdempotencyRecord | null>;
  set(record: PaymentIdempotencyRecord): Promise<void>;
}

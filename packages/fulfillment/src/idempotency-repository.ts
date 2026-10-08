export interface FulfillmentIdempotencyRecord {
  readonly key: string;
  readonly storeId: string;
  readonly actorId: string;
  readonly requestHash: string;
  readonly response: unknown;
  readonly createdAt: string;
}

export interface FulfillmentIdempotencyRepository {
  get(storeId: string, actorId: string, key: string): Promise<FulfillmentIdempotencyRecord | null>;

  set(record: FulfillmentIdempotencyRecord): Promise<void>;
}

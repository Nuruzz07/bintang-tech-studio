import {
  PaymentAccount,
  PaymentAccountStatus,
  PaymentIntent,
  PaymentIntentStatus,
  PaymentIntentFilter,
  PaymentAttempt,
  PaymentAttemptStatus,
  PaymentEvent,
  PaymentEventProcessingStatus,
  Refund,
  RefundStatus,
} from './types.js';
import { PaymentAccountRepository } from './payment-account-repository.js';
import { PaymentIntentRepository } from './payment-intent-repository.js';
import { PaymentAttemptRepository } from './payment-attempt-repository.js';
import { PaymentEventRepository } from './payment-event-repository.js';
import { RefundRepository } from './refund-repository.js';
import {
  PaymentIdempotencyRepository,
  PaymentIdempotencyRecord,
} from './idempotency-repository.js';
import {
  PaymentNotFoundError,
  PaymentAccountNotFoundError,
  PaymentIntentNotFoundError,
  PaymentAttemptNotFoundError,
  PaymentEventDuplicateError,
} from './errors.js';
import {
  validatePaymentIntentStateTransition,
  validatePaymentAttemptStateTransition,
} from './validation.js';

/**
 * Concurrency-safe in-memory PaymentAccountRepository.
 */
export class InMemoryPaymentAccountRepository implements PaymentAccountRepository {
  private readonly accounts = new Map<string, PaymentAccount>();

  async create(storeId: string, account: PaymentAccount): Promise<PaymentAccount> {
    if (account.storeId !== storeId) {
      throw new Error(
        `Account storeId ${account.storeId} does not match repository storeId ${storeId}`,
      );
    }
    const frozen = Object.freeze({ ...account });
    this.accounts.set(account.id, frozen);
    return frozen;
  }

  async findById(storeId: string, id: string): Promise<PaymentAccount | null> {
    const acc = this.accounts.get(id);
    if (!acc || acc.storeId !== storeId) {
      return null;
    }
    return acc;
  }

  async findActiveByStore(storeId: string): Promise<PaymentAccount | null> {
    for (const acc of this.accounts.values()) {
      if (acc.storeId === storeId && acc.status === 'ACTIVE') {
        return acc;
      }
    }
    return null;
  }

  async list(storeId: string): Promise<readonly PaymentAccount[]> {
    const results: PaymentAccount[] = [];
    for (const acc of this.accounts.values()) {
      if (acc.storeId === storeId) {
        results.push(acc);
      }
    }
    return Object.freeze(results);
  }

  async updateStatus(
    storeId: string,
    id: string,
    status: PaymentAccountStatus,
  ): Promise<PaymentAccount> {
    const existing = await this.findById(storeId, id);
    if (!existing) {
      throw new PaymentAccountNotFoundError(id);
    }
    const updated = Object.freeze({
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
    });
    this.accounts.set(id, updated);
    return updated;
  }

  clear(): void {
    this.accounts.clear();
  }
}

/**
 * Concurrency-safe in-memory PaymentIntentRepository with state machine enforcement.
 */
export class InMemoryPaymentIntentRepository implements PaymentIntentRepository {
  private readonly intents = new Map<string, PaymentIntent>();
  private readonly locks = new Map<string, Promise<void>>();

  private async acquireLock(key: string): Promise<() => void> {
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }
    let release!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      release = () => {
        this.locks.delete(key);
        resolve();
      };
    });
    this.locks.set(key, lockPromise);
    return release;
  }

  async create(storeId: string, intent: PaymentIntent): Promise<PaymentIntent> {
    if (intent.storeId !== storeId) {
      throw new Error(
        `Intent storeId ${intent.storeId} does not match repository storeId ${storeId}`,
      );
    }
    const frozen = Object.freeze({ ...intent });
    this.intents.set(intent.id, frozen);
    return frozen;
  }

  async findById(storeId: string, id: string): Promise<PaymentIntent | null> {
    const intent = this.intents.get(id);
    if (!intent || intent.storeId !== storeId) {
      return null;
    }
    return intent;
  }

  async findByOrderId(storeId: string, orderId: string): Promise<readonly PaymentIntent[]> {
    const results: PaymentIntent[] = [];
    for (const intent of this.intents.values()) {
      if (intent.storeId === storeId && intent.orderId === orderId) {
        results.push(intent);
      }
    }
    return Object.freeze(results);
  }

  async list(storeId: string, filter?: PaymentIntentFilter): Promise<readonly PaymentIntent[]> {
    const results: PaymentIntent[] = [];
    const filterStatuses = filter?.status
      ? Array.isArray(filter.status)
        ? filter.status
        : [filter.status]
      : null;

    for (const intent of this.intents.values()) {
      if (intent.storeId !== storeId) continue;
      if (filterStatuses && !filterStatuses.includes(intent.status)) continue;
      if (filter?.orderId && intent.orderId !== filter.orderId) continue;
      if (filter?.customerId && intent.customerId !== filter.customerId) continue;
      results.push(intent);
    }

    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    let sliced = results;
    if (filter?.offset) sliced = sliced.slice(filter.offset);
    if (filter?.limit) sliced = sliced.slice(0, filter.limit);

    return Object.freeze(sliced);
  }

  async updateStatus(
    storeId: string,
    id: string,
    status: PaymentIntentStatus,
    metadata?: Readonly<Record<string, unknown>>,
  ): Promise<PaymentIntent> {
    const releaseLock = await this.acquireLock(id);
    try {
      const existing = await this.findById(storeId, id);
      if (!existing) {
        throw new PaymentIntentNotFoundError(id);
      }

      // Repository-level state machine enforcement
      validatePaymentIntentStateTransition(existing.status, status);

      const updated = Object.freeze({
        ...existing,
        status,
        metadata: metadata
          ? Object.freeze({ ...existing.metadata, ...metadata })
          : existing.metadata,
        updatedAt: new Date().toISOString(),
      });
      this.intents.set(id, updated);
      return updated;
    } finally {
      releaseLock();
    }
  }

  clear(): void {
    this.intents.clear();
    this.locks.clear();
  }
}

/**
 * Concurrency-safe in-memory PaymentAttemptRepository.
 */
export class InMemoryPaymentAttemptRepository implements PaymentAttemptRepository {
  private readonly attempts = new Map<string, PaymentAttempt>();
  private readonly providerRefIndex = new Map<string, string>(); // `${provider}:${reference}` -> attemptId
  private readonly locks = new Map<string, Promise<void>>();

  private async acquireLock(key: string): Promise<() => void> {
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }
    let release!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      release = () => {
        this.locks.delete(key);
        resolve();
      };
    });
    this.locks.set(key, lockPromise);
    return release;
  }

  async create(storeId: string, attempt: PaymentAttempt): Promise<PaymentAttempt> {
    if (attempt.storeId !== storeId) {
      throw new Error(
        `Attempt storeId ${attempt.storeId} does not match repository storeId ${storeId}`,
      );
    }
    const frozen = Object.freeze({ ...attempt });
    this.attempts.set(attempt.id, frozen);
    if (attempt.providerReference) {
      this.providerRefIndex.set(`${attempt.provider}:${attempt.providerReference}`, attempt.id);
    }
    return frozen;
  }

  async findById(storeId: string, id: string): Promise<PaymentAttempt | null> {
    const attempt = this.attempts.get(id);
    if (!attempt || attempt.storeId !== storeId) {
      return null;
    }
    return attempt;
  }

  async findByIntentId(storeId: string, intentId: string): Promise<readonly PaymentAttempt[]> {
    const results: PaymentAttempt[] = [];
    for (const attempt of this.attempts.values()) {
      if (attempt.storeId === storeId && attempt.paymentIntentId === intentId) {
        results.push(attempt);
      }
    }
    results.sort((a, b) => a.attemptNumber - b.attemptNumber);
    return Object.freeze(results);
  }

  async findByProviderReference(
    provider: string,
    reference: string,
  ): Promise<PaymentAttempt | null> {
    const id = this.providerRefIndex.get(`${provider}:${reference}`);
    if (!id) return null;
    const attempt = this.attempts.get(id);
    return attempt ?? null;
  }

  async updateStatus(
    storeId: string,
    id: string,
    status: PaymentAttemptStatus,
    patch?: {
      providerReference?: string | null;
      paymentUrl?: string | null;
      failureCode?: string | null;
      failureReason?: string | null;
    },
  ): Promise<PaymentAttempt> {
    const releaseLock = await this.acquireLock(id);
    try {
      const existing = await this.findById(storeId, id);
      if (!existing) {
        throw new PaymentAttemptNotFoundError(id);
      }

      // Repository-level attempt state machine enforcement
      validatePaymentAttemptStateTransition(existing.status, status);

      const updated = Object.freeze({
        ...existing,
        status,
        providerReference:
          patch?.providerReference !== undefined
            ? patch.providerReference
            : existing.providerReference,
        paymentUrl: patch?.paymentUrl !== undefined ? patch.paymentUrl : existing.paymentUrl,
        failureCode: patch?.failureCode !== undefined ? patch.failureCode : existing.failureCode,
        failureReason:
          patch?.failureReason !== undefined ? patch.failureReason : existing.failureReason,
        updatedAt: new Date().toISOString(),
      });

      this.attempts.set(id, updated);
      if (updated.providerReference) {
        this.providerRefIndex.set(`${updated.provider}:${updated.providerReference}`, updated.id);
      }
      return updated;
    } finally {
      releaseLock();
    }
  }

  clear(): void {
    this.attempts.clear();
    this.providerRefIndex.clear();
    this.locks.clear();
  }
}

/**
 * Concurrency-safe in-memory PaymentEventRepository with duplicate protection.
 */
export class InMemoryPaymentEventRepository implements PaymentEventRepository {
  private readonly events = new Map<string, PaymentEvent>();
  private readonly providerEventIndex = new Map<string, string>(); // `${provider}:${eventId}` -> eventId

  async create(event: PaymentEvent): Promise<PaymentEvent> {
    const compoundKey = `${event.provider}:${event.eventId}`;
    if (this.providerEventIndex.has(compoundKey)) {
      throw new PaymentEventDuplicateError(event.provider, event.eventId);
    }

    const frozen = Object.freeze({ ...event });
    this.events.set(event.id, frozen);
    this.providerEventIndex.set(compoundKey, event.id);
    return frozen;
  }

  async findById(id: string): Promise<PaymentEvent | null> {
    const event = this.events.get(id);
    return event ?? null;
  }

  async findByProviderEventId(provider: string, eventId: string): Promise<PaymentEvent | null> {
    const id = this.providerEventIndex.get(`${provider}:${eventId}`);
    if (!id) return null;
    const event = this.events.get(id);
    return event ?? null;
  }

  async updateProcessingStatus(
    id: string,
    status: PaymentEventProcessingStatus,
    processedAt?: string,
  ): Promise<PaymentEvent> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new PaymentNotFoundError(id);
    }
    const updated = Object.freeze({
      ...existing,
      processingStatus: status,
      processedAt: processedAt ?? new Date().toISOString(),
    });
    this.events.set(id, updated);
    return updated;
  }

  clear(): void {
    this.events.clear();
    this.providerEventIndex.clear();
  }
}

/**
 * Concurrency-safe in-memory RefundRepository.
 */
export class InMemoryRefundRepository implements RefundRepository {
  private readonly refunds = new Map<string, Refund>();

  async create(storeId: string, refund: Refund): Promise<Refund> {
    if (refund.storeId !== storeId) {
      throw new Error(
        `Refund storeId ${refund.storeId} does not match repository storeId ${storeId}`,
      );
    }
    const frozen = Object.freeze({ ...refund });
    this.refunds.set(refund.id, frozen);
    return frozen;
  }

  async findById(storeId: string, id: string): Promise<Refund | null> {
    const refund = this.refunds.get(id);
    if (!refund || refund.storeId !== storeId) {
      return null;
    }
    return refund;
  }

  async findByIntentId(storeId: string, intentId: string): Promise<readonly Refund[]> {
    const results: Refund[] = [];
    for (const ref of this.refunds.values()) {
      if (ref.storeId === storeId && ref.paymentIntentId === intentId) {
        results.push(ref);
      }
    }
    return Object.freeze(results);
  }

  async findByOrderId(storeId: string, orderId: string): Promise<readonly Refund[]> {
    const results: Refund[] = [];
    for (const ref of this.refunds.values()) {
      if (ref.storeId === storeId && ref.orderId === orderId) {
        results.push(ref);
      }
    }
    return Object.freeze(results);
  }

  async updateStatus(
    storeId: string,
    id: string,
    status: RefundStatus,
    providerRefundId?: string | null,
  ): Promise<Refund> {
    const existing = await this.findById(storeId, id);
    if (!existing) {
      throw new PaymentNotFoundError(id);
    }
    const updated = Object.freeze({
      ...existing,
      status,
      providerRefundId:
        providerRefundId !== undefined ? providerRefundId : existing.providerRefundId,
      processedAt: status === 'SUCCEEDED' ? new Date().toISOString() : existing.processedAt,
    });
    this.refunds.set(id, updated);
    return updated;
  }

  clear(): void {
    this.refunds.clear();
  }
}

/**
 * Concurrency-safe in-memory PaymentIdempotencyRepository.
 */
export class InMemoryPaymentIdempotencyRepository implements PaymentIdempotencyRepository {
  private readonly records = new Map<string, PaymentIdempotencyRecord>();

  private buildKey(storeId: string, actorId: string, key: string): string {
    return `${storeId}:${actorId}:${key.trim()}`;
  }

  async get(
    storeId: string,
    actorId: string,
    key: string,
  ): Promise<PaymentIdempotencyRecord | null> {
    const compoundKey = this.buildKey(storeId, actorId, key);
    return this.records.get(compoundKey) ?? null;
  }

  async set(record: PaymentIdempotencyRecord): Promise<void> {
    const compoundKey = this.buildKey(record.storeId, record.actorId, record.key);
    this.records.set(compoundKey, Object.freeze({ ...record }));
  }

  clear(): void {
    this.records.clear();
  }
}

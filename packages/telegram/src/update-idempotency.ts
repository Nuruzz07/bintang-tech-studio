/**
 * Bintang Tech Studio — Telegram Update Idempotency Repository.
 * Baseline: Milestone M11 Telegram Engine.
 *
 * Prevents double-execution caused by Telegram's automatic webhook/polling retries.
 * Logical idempotency key: ${botId}:${updateId}.
 *
 * NOTE: This in-memory implementation serves as the M11 foundation.
 * PRODUCTION PERSISTENCE GAP: Production requires persistent PostgreSQL update tracking.
 */

import { TelegramUpdateRecord } from './types.js';

export interface TelegramUpdateRepository {
  find(botId: string, updateId: number): Promise<TelegramUpdateRecord | null>;

  beginProcessing(
    botId: string,
    updateId: number,
  ): Promise<{ readonly isDuplicate: boolean; readonly record: TelegramUpdateRecord }>;

  markProcessed(botId: string, updateId: number, result?: unknown): Promise<void>;

  markFailed(botId: string, updateId: number, error: string, retryable: boolean): Promise<void>;
}

export class InMemoryTelegramUpdateRepository implements TelegramUpdateRepository {
  private readonly records = new Map<string, TelegramUpdateRecord>();
  private readonly locks = new Map<string, Promise<void>>();

  private toKey(botId: string, updateId: number): string {
    return `${botId}:${updateId}`;
  }

  private async acquireLock(key: string): Promise<() => void> {
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }
    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((res) => {
      resolveLock = res;
    });
    this.locks.set(key, lockPromise);

    return () => {
      this.locks.delete(key);
      resolveLock();
    };
  }

  public async find(botId: string, updateId: number): Promise<TelegramUpdateRecord | null> {
    const key = this.toKey(botId, updateId);
    const existing = this.records.get(key);
    return existing ? { ...existing } : null;
  }

  public async beginProcessing(
    botId: string,
    updateId: number,
  ): Promise<{ readonly isDuplicate: boolean; readonly record: TelegramUpdateRecord }> {
    const key = this.toKey(botId, updateId);
    const release = await this.acquireLock(key);

    try {
      const existing = this.records.get(key);

      // If already processed or currently processing, reject as duplicate
      if (existing) {
        if (existing.status === 'PROCESSED' || existing.status === 'PROCESSING') {
          return { isDuplicate: true, record: { ...existing } };
        }
        if (existing.status === 'FAILED' && !existing.retryable) {
          return { isDuplicate: true, record: { ...existing } };
        }
      }

      const now = new Date().toISOString();
      const newRecord: TelegramUpdateRecord = {
        id: key,
        botId,
        updateId,
        status: 'PROCESSING',
        createdAt: existing?.createdAt ?? now,
      };

      this.records.set(key, newRecord);
      return { isDuplicate: false, record: { ...newRecord } };
    } finally {
      release();
    }
  }

  public async markProcessed(botId: string, updateId: number, result?: unknown): Promise<void> {
    const key = this.toKey(botId, updateId);
    const release = await this.acquireLock(key);

    try {
      const existing = this.records.get(key);
      const now = new Date().toISOString();
      const updated: TelegramUpdateRecord = {
        id: key,
        botId,
        updateId,
        status: 'PROCESSED',
        resultPayload: result,
        processedAt: now,
        createdAt: existing?.createdAt ?? now,
      };
      this.records.set(key, updated);
    } finally {
      release();
    }
  }

  public async markFailed(
    botId: string,
    updateId: number,
    error: string,
    retryable: boolean,
  ): Promise<void> {
    const key = this.toKey(botId, updateId);
    const release = await this.acquireLock(key);

    try {
      const existing = this.records.get(key);
      const now = new Date().toISOString();
      const updated: TelegramUpdateRecord = {
        id: key,
        botId,
        updateId,
        status: 'FAILED',
        errorMessage: error,
        retryable,
        processedAt: now,
        createdAt: existing?.createdAt ?? now,
      };
      this.records.set(key, updated);
    } finally {
      release();
    }
  }

  public clear(): void {
    this.records.clear();
    this.locks.clear();
  }
}

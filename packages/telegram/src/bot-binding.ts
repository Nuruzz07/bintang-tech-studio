/**
 * Bintang Tech Studio — Telegram Bot Binding Repository.
 * Baseline: Milestone M11 Telegram Engine.
 *
 * Explicitly binds a Telegram Bot to a specific tenant Store Context.
 * Corresponds to public.bots in M02 schema.
 *
 * Invariant: Telegram Bot -> exactly one authorized Store Context.
 */

import { TelegramBotBinding, TelegramBotStatus } from './types.js';
import { TelegramBotNotFoundError } from './errors.js';

export interface TelegramBotRepository {
  findByTelegramBotId(telegramBotId: string): Promise<TelegramBotBinding | null>;
  findById(id: string): Promise<TelegramBotBinding | null>;
  listByStore(storeId: string): Promise<readonly TelegramBotBinding[]>;
  create(binding: TelegramBotBinding): Promise<TelegramBotBinding>;
  updateStatus(id: string, status: TelegramBotStatus): Promise<TelegramBotBinding>;
}

export class InMemoryTelegramBotRepository implements TelegramBotRepository {
  private readonly byId = new Map<string, TelegramBotBinding>();
  private readonly byTelegramBotId = new Map<string, string>();

  public async findByTelegramBotId(telegramBotId: string): Promise<TelegramBotBinding | null> {
    const id = this.byTelegramBotId.get(telegramBotId);
    if (!id) return null;
    const b = this.byId.get(id);
    return b ? { ...b } : null;
  }

  public async findById(id: string): Promise<TelegramBotBinding | null> {
    const b = this.byId.get(id);
    return b ? { ...b } : null;
  }

  public async listByStore(storeId: string): Promise<readonly TelegramBotBinding[]> {
    const list: TelegramBotBinding[] = [];
    for (const b of this.byId.values()) {
      if (b.storeId === storeId) {
        list.push({ ...b });
      }
    }
    return Object.freeze(list);
  }

  public async create(binding: TelegramBotBinding): Promise<TelegramBotBinding> {
    const clone: TelegramBotBinding = { ...binding };
    this.byId.set(clone.id, clone);
    this.byTelegramBotId.set(clone.telegramBotId, clone.id);
    return { ...clone };
  }

  public async updateStatus(id: string, status: TelegramBotStatus): Promise<TelegramBotBinding> {
    const existing = this.byId.get(id);
    if (!existing) {
      throw new TelegramBotNotFoundError(id);
    }
    const updated: TelegramBotBinding = {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
    };
    this.byId.set(id, updated);
    return { ...updated };
  }

  public clear(): void {
    this.byId.clear();
    this.byTelegramBotId.clear();
  }
}

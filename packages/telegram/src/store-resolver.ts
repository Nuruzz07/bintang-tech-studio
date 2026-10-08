/**
 * Bintang Tech Studio — Telegram Store Context Resolver.
 * Baseline: Milestone M11 Telegram Engine.
 *
 * Enforces the Golden Rule:
 * Telegram Store Context MUST be resolved from trusted server-side bot binding.
 *
 * Telegram Update -> Bot Identity -> Bot Binding -> Store Context.
 *
 * Client-supplied store_id in command arguments, callbacks, or web app payloads
 * is completely ignored and NEVER used as authorization boundary.
 */

import { TelegramBotRepository } from './bot-binding.js';
import { TelegramBotBinding } from './types.js';
import { TelegramBotNotFoundError, TelegramBotInactiveError } from './errors.js';

export interface ResolvedTelegramStore {
  readonly storeId: string;
  readonly storeName: string;
  readonly tenantSlug?: string | undefined;
  readonly botId: string;
  readonly botUsername?: string | undefined;
  readonly miniAppUrl?: string | undefined;
}

export class TelegramStoreResolver {
  constructor(private readonly botRepository: TelegramBotRepository) {}

  public async resolveStoreFromBot(botId: string): Promise<{
    readonly binding: TelegramBotBinding;
    readonly store: ResolvedTelegramStore;
  }> {
    const binding = await this.botRepository.findByTelegramBotId(botId);
    if (!binding) {
      throw new TelegramBotNotFoundError(botId);
    }

    if (binding.status !== 'ACTIVE') {
      throw new TelegramBotInactiveError(botId, binding.status);
    }

    const store: ResolvedTelegramStore = {
      storeId: binding.storeId,
      storeName: binding.displayName,
      botId: binding.telegramBotId,
      botUsername: binding.username,
      miniAppUrl: binding.miniAppUrl,
    };

    return { binding, store };
  }
}

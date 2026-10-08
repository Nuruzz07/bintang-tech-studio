/**
 * Bintang Tech Studio — Multi-Tenant Telegram Channel Engine Service.
 * Baseline: Milestone M11 Telegram Engine.
 *
 * Canonical orchestrator of the Telegram messaging channel:
 *
 * Telegram Update
 *     ↓
 * Update Idempotency Guard
 *     ↓
 * Update Normalization
 *     ↓
 * Bot Identity & Store Context Resolution
 *     ↓
 * Caller Context Classification (Customer / Seller / Platform)
 *     ↓
 * Command / Callback Routing
 *     ↓
 * Existing Domain & Application Services
 *     ↓
 * Outbound Telegram Presentation
 */

import { TelegramAdapter } from './adapter.js';
import { TelegramUpdateRepository } from './update-idempotency.js';
import { normalizeTelegramUpdate } from './update-normalizer.js';
import { TelegramStoreResolver, ResolvedTelegramStore } from './store-resolver.js';
import { TelegramContextClassifier } from './context-classifier.js';
import { TelegramCommandRouter } from './command-router.js';
import { TelegramCallbackRouter } from './callback-router.js';
import { TelegramOutboundService } from './outbound.js';
import { TelegramProcessResult, TelegramUpdateContext } from './types.js';
import {
  TelegramEngineError,
  TelegramBotNotFoundError,
  TelegramBotInactiveError,
  TelegramDuplicateUpdateError,
} from './errors.js';

export interface TelegramEngineServiceDependencies {
  readonly adapter: TelegramAdapter;
  readonly updateRepository: TelegramUpdateRepository;
  readonly storeResolver: TelegramStoreResolver;
  readonly contextClassifier: TelegramContextClassifier;
  readonly commandRouter: TelegramCommandRouter;
  readonly callbackRouter: TelegramCallbackRouter;
  readonly outbound: TelegramOutboundService;
}

export class TelegramEngineService {
  constructor(private readonly deps: TelegramEngineServiceDependencies) {}

  /**
   * Processes a raw Telegram update safely, idempotently, and in a multi-tenant fashion.
   */
  public async processUpdate(
    botId: string,
    rawUpdate: unknown,
    _options?: { readonly correlationId?: string },
  ): Promise<TelegramProcessResult> {
    // 1. Normalize update to internal representation
    const update = normalizeTelegramUpdate(botId, rawUpdate);

    // 2. Idempotency Check & Lock
    const { isDuplicate } = await this.deps.updateRepository.beginProcessing(
      botId,
      update.updateId,
    );

    if (isDuplicate) {
      return {
        updateId: update.updateId,
        botId,
        status: 'SKIPPED_DUPLICATE',
        outboundMessageCount: 0,
      };
    }

    try {
      // 3. Resolve Store Context from Bot Identity
      const { store } = await this.deps.storeResolver.resolveStoreFromBot(botId);

      // 4. Classify Caller Context (CUSTOMER vs SELLER vs PLATFORM)
      const caller = await this.deps.contextClassifier.classifyCaller(
        store.storeId,
        update.telegramUserId,
        update.from,
        { tenantSlug: store.tenantSlug },
      );

      // 5. Route by Update Type
      let action: string = 'NO_OP';

      if (update.type === 'COMMAND') {
        action = await this.deps.commandRouter.routeCommand(update, store, caller);
      } else if (update.type === 'CALLBACK_QUERY') {
        action = await this.deps.callbackRouter.routeCallback(update, store, caller);
      } else if (update.type === 'MESSAGE' && update.text) {
        action = await this.handleTextMessage(update, store);
      } else if (update.type === 'WEB_APP_DATA') {
        action = 'WEB_APP_DATA_RECEIVED';
      } else {
        action = 'UNKNOWN_UPDATE_IGNORED';
      }

      // 6. Mark Processed
      await this.deps.updateRepository.markProcessed(botId, update.updateId, { action });

      return {
        updateId: update.updateId,
        botId,
        status: 'PROCESSED',
        action,
        outboundMessageCount: 1,
      };
    } catch (err: unknown) {
      const isRetryable = !(
        err instanceof TelegramBotNotFoundError ||
        err instanceof TelegramBotInactiveError ||
        err instanceof TelegramDuplicateUpdateError
      );

      const errorMessage = err instanceof Error ? err.message : String(err);

      await this.deps.updateRepository.markFailed(
        botId,
        update.updateId,
        errorMessage,
        isRetryable,
      );

      // Best-effort safe error presentation if chat is known
      if (update.chatId) {
        try {
          const safeUserMessage =
            err instanceof TelegramEngineError
              ? err.message
              : 'Layanan sedang mengalami kendala. Silakan coba sesaat lagi.';

          const errPayload = this.deps.outbound.formatErrorMessage(update.chatId, safeUserMessage);
          await this.deps.adapter.sendMessage(botId, errPayload);
        } catch {
          // Ignore outbound error formatting failures
        }
      }

      return {
        updateId: update.updateId,
        botId,
        status: 'FAILED',
        error: errorMessage,
        outboundMessageCount: 0,
      };
    }
  }

  private async handleTextMessage(
    update: TelegramUpdateContext,
    store: ResolvedTelegramStore,
  ): Promise<string> {
    const payload = this.deps.outbound.formatWelcomeMessage(
      update.chatId,
      store.storeName,
      store.miniAppUrl,
    );
    await this.deps.adapter.sendMessage(update.botId, payload);
    return 'MSG_WELCOME_REPLY';
  }
}

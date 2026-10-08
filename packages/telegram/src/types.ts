/**
 * Bintang Tech Studio — Multi-Tenant Telegram Channel Engine Types.
 * Baseline: Milestone M11 Telegram Engine.
 */

import type { AuthenticatedStoreContext } from '@bintang/tenancy';
import type { CustomerContext } from '@bintang/orders';

/**
 * Normalized update category.
 */
export type TelegramUpdateType =
  'MESSAGE' | 'COMMAND' | 'CALLBACK_QUERY' | 'WEB_APP_DATA' | 'UNKNOWN';

/**
 * Sender identity within Telegram update.
 */
export interface TelegramSender {
  readonly id: string;
  readonly firstName?: string | undefined;
  readonly lastName?: string | undefined;
  readonly username?: string | undefined;
}

/**
 * Normalized internal representation of an incoming Telegram update.
 * Completely isolates downstream services from raw Telegram SDK formats.
 */
export interface TelegramUpdateContext {
  readonly updateId: number;
  readonly botId: string;
  readonly telegramUserId: string;
  readonly chatId: string;
  readonly messageId?: number | undefined;
  readonly callbackQueryId?: string | undefined;
  readonly type: TelegramUpdateType;
  readonly text?: string | undefined;
  readonly command?: string | undefined;
  readonly commandArgs?: string | undefined;
  readonly callbackData?: string | undefined;
  readonly webAppData?: string | undefined;
  readonly from?: TelegramSender | undefined;
  readonly receivedAt: string;
}

/**
 * Lifecycle status of a tenant-bound Telegram bot.
 */
export type TelegramBotStatus = 'ACTIVE' | 'DISABLED' | 'REVOKED';

/**
 * Explicit binding linking a Telegram Bot directly to a tenant Store Context.
 * Corresponds to public.bots table in M02 schema.
 */
export interface TelegramBotBinding {
  readonly id: string;
  readonly storeId: string;
  readonly telegramBotId: string;
  readonly username?: string | undefined;
  readonly displayName: string;
  readonly status: TelegramBotStatus;
  readonly credentialReference: string;
  readonly miniAppUrl?: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Store-scoped customer identity mapping (storeId, telegramUserId) -> customerId.
 */
export interface TelegramCustomerIdentity {
  readonly storeId: string;
  readonly telegramUserId: string;
  readonly customerId: string;
  readonly name?: string | undefined;
  readonly username?: string | undefined;
}

/**
 * Explicit caller classification for authorization.
 */
export type TelegramCallerContext =
  | {
      readonly type: 'CUSTOMER';
      readonly storeId: string;
      readonly customerId: string;
      readonly telegramUserId: string;
      readonly context: CustomerContext;
    }
  | {
      readonly type: 'SELLER';
      readonly storeId: string;
      readonly userId: string;
      readonly telegramUserId: string;
      readonly context: AuthenticatedStoreContext;
    }
  | {
      readonly type: 'PLATFORM';
      readonly userId: string;
      readonly telegramUserId: string;
      readonly context: AuthenticatedStoreContext;
    };

/**
 * Update processing states for idempotency tracking.
 */
export type TelegramUpdateProcessingStatus = 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'IGNORED';

/**
 * Persistent or in-memory idempotency record for a Telegram update.
 */
export interface TelegramUpdateRecord {
  readonly id: string; // Composite key: ${botId}:${updateId}
  readonly botId: string;
  readonly updateId: number;
  readonly status: TelegramUpdateProcessingStatus;
  readonly resultPayload?: unknown | undefined;
  readonly errorMessage?: string | undefined;
  readonly retryable?: boolean | undefined;
  readonly processedAt?: string | undefined;
  readonly createdAt: string;
}

/**
 * Inline button definition.
 */
export interface TelegramInlineButton {
  readonly text: string;
  readonly callbackData?: string | undefined;
  readonly url?: string | undefined;
  readonly webAppUrl?: string | undefined;
}

/**
 * Outbound message specification.
 */
export interface TelegramMessagePayload {
  readonly chatId: string;
  readonly text: string;
  readonly parseMode?: 'Markdown' | 'HTML' | undefined;
  readonly replyMarkup?:
    | {
        readonly inlineKeyboard?: readonly (readonly TelegramInlineButton[])[] | undefined;
      }
    | undefined;
}

/**
 * Acknowledgment response for Telegram callback query.
 */
export interface TelegramCallbackAnswer {
  readonly callbackQueryId: string;
  readonly text?: string | undefined;
  readonly showAlert?: boolean | undefined;
}

/**
 * Final execution summary for processing an update.
 */
export interface TelegramProcessResult {
  readonly updateId: number;
  readonly botId: string;
  readonly status: 'PROCESSED' | 'SKIPPED_DUPLICATE' | 'FAILED' | 'IGNORED';
  readonly action?: string | undefined;
  readonly error?: string | undefined;
  readonly outboundMessageCount: number;
}

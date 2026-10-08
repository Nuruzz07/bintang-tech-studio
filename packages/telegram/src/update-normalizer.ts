/**
 * Bintang Tech Studio — Telegram Update Normalizer.
 * Baseline: Milestone M11 Telegram Engine.
 *
 * Normalizes diverse raw Telegram updates (webhook JSON, polling objects)
 * into a single unified internal TelegramUpdateContext.
 */

import { TelegramUpdateContext, TelegramSender } from './types.js';
import { TelegramInvalidUpdateError } from './errors.js';

interface RawTelegramUser {
  readonly id?: number | string;
  readonly first_name?: string;
  readonly last_name?: string;
  readonly username?: string;
}

interface RawTelegramChat {
  readonly id?: number | string;
}

interface RawTelegramMessage {
  readonly message_id?: number;
  readonly from?: RawTelegramUser;
  readonly chat?: RawTelegramChat;
  readonly text?: string;
  readonly web_app_data?: { readonly data?: string };
}

interface RawTelegramCallbackQuery {
  readonly id?: string;
  readonly from?: RawTelegramUser;
  readonly message?: RawTelegramMessage;
  readonly data?: string;
}

interface RawTelegramUpdate {
  readonly update_id?: number;
  readonly updateId?: number;
  readonly message?: RawTelegramMessage;
  readonly callback_query?: RawTelegramCallbackQuery;
  readonly callbackQuery?: RawTelegramCallbackQuery;
}

export function normalizeTelegramUpdate(botId: string, raw: unknown): TelegramUpdateContext {
  if (!raw || typeof raw !== 'object') {
    throw new TelegramInvalidUpdateError('Update payload must be a non-null object');
  }

  const u = raw as RawTelegramUpdate;
  const updateId = u.update_id ?? u.updateId;

  if (typeof updateId !== 'number' || !Number.isInteger(updateId)) {
    throw new TelegramInvalidUpdateError('Update missing valid numeric update_id');
  }

  const receivedAt = new Date().toISOString();

  // 1. Handle Callback Query
  const callbackQuery = u.callback_query ?? u.callbackQuery;
  if (callbackQuery) {
    const from = extractSender(callbackQuery.from);
    const chatId = String(callbackQuery.message?.chat?.id ?? callbackQuery.from?.id ?? '');
    return {
      updateId,
      botId,
      telegramUserId: from?.id ?? String(callbackQuery.from?.id ?? ''),
      chatId,
      messageId: callbackQuery.message?.message_id,
      callbackQueryId: callbackQuery.id ? String(callbackQuery.id) : undefined,
      type: 'CALLBACK_QUERY',
      callbackData: callbackQuery.data?.trim() ?? '',
      from,
      receivedAt,
    };
  }

  // 2. Handle Message
  const message = u.message;
  if (message) {
    const from = extractSender(message.from);
    const chatId = String(message.chat?.id ?? message.from?.id ?? '');
    const messageId = message.message_id;

    // 2a. Web App Data
    if (message.web_app_data) {
      return {
        updateId,
        botId,
        telegramUserId: from?.id ?? String(message.from?.id ?? ''),
        chatId,
        messageId,
        type: 'WEB_APP_DATA',
        webAppData: message.web_app_data.data,
        from,
        receivedAt,
      };
    }

    const text = message.text?.trim();

    // 2b. Bot Command
    if (text && text.startsWith('/')) {
      const parts = text.split(/\s+/);
      const rawCommand = parts[0]!;
      // Strip bot username suffix if present, e.g. /start@bintang_bot -> /start
      const cleanCommand = rawCommand.split('@')[0]!.toLowerCase();
      const commandArgs = parts.slice(1).join(' ').trim() || undefined;

      return {
        updateId,
        botId,
        telegramUserId: from?.id ?? String(message.from?.id ?? ''),
        chatId,
        messageId,
        type: 'COMMAND',
        text,
        command: cleanCommand,
        commandArgs,
        from,
        receivedAt,
      };
    }

    // 2c. Regular Message
    return {
      updateId,
      botId,
      telegramUserId: from?.id ?? String(message.from?.id ?? ''),
      chatId,
      messageId,
      type: 'MESSAGE',
      text,
      from,
      receivedAt,
    };
  }

  // 3. Fallback for unhandled update variants (inline queries, channel posts, etc.)
  return {
    updateId,
    botId,
    telegramUserId: '',
    chatId: '',
    type: 'UNKNOWN',
    receivedAt,
  };
}

function extractSender(user?: RawTelegramUser): TelegramSender | undefined {
  if (!user || user.id === undefined) {
    return undefined;
  }
  return {
    id: String(user.id),
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
  };
}

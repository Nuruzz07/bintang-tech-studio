import { describe, it, expect } from 'vitest';
import { normalizeTelegramUpdate, TelegramInvalidUpdateError } from '../src/index.js';

describe('Telegram Engine — Update Normalizer', () => {
  const botId = 'bot_test_101';

  it('normalizes bot command with arguments', () => {
    const raw = {
      update_id: 1001,
      message: {
        message_id: 55,
        from: { id: 98765, first_name: 'Budi', username: 'budi_tech' },
        chat: { id: 98765 },
        text: '/order ORD-9921 details',
      },
    };

    const ctx = normalizeTelegramUpdate(botId, raw);
    expect(ctx.updateId).toBe(1001);
    expect(ctx.botId).toBe(botId);
    expect(ctx.type).toBe('COMMAND');
    expect(ctx.command).toBe('/order');
    expect(ctx.commandArgs).toBe('ORD-9921 details');
    expect(ctx.telegramUserId).toBe('98765');
    expect(ctx.chatId).toBe('98765');
    expect(ctx.from?.username).toBe('budi_tech');
  });

  it('strips bot username suffix from commands (/start@bintang_bot)', () => {
    const raw = {
      update_id: 1002,
      message: {
        message_id: 56,
        from: { id: 98765 },
        chat: { id: 98765 },
        text: '/start@bintang_store_bot promo_ramadhan',
      },
    };

    const ctx = normalizeTelegramUpdate(botId, raw);
    expect(ctx.type).toBe('COMMAND');
    expect(ctx.command).toBe('/start');
    expect(ctx.commandArgs).toBe('promo_ramadhan');
  });

  it('normalizes inline button callback queries', () => {
    const raw = {
      update_id: 1003,
      callback_query: {
        id: 'query_12345',
        from: { id: 98765, first_name: 'Budi' },
        message: {
          message_id: 57,
          chat: { id: 98765 },
        },
        data: 'product:view:prod_spotify_1',
      },
    };

    const ctx = normalizeTelegramUpdate(botId, raw);
    expect(ctx.type).toBe('CALLBACK_QUERY');
    expect(ctx.callbackQueryId).toBe('query_12345');
    expect(ctx.callbackData).toBe('product:view:prod_spotify_1');
    expect(ctx.telegramUserId).toBe('98765');
  });

  it('normalizes Web App data submissions', () => {
    const raw = {
      update_id: 1004,
      message: {
        message_id: 58,
        from: { id: 98765 },
        chat: { id: 98765 },
        web_app_data: {
          data: '{"checkoutSuccess":true,"orderId":"ord_101"}',
        },
      },
    };

    const ctx = normalizeTelegramUpdate(botId, raw);
    expect(ctx.type).toBe('WEB_APP_DATA');
    expect(ctx.webAppData).toBe('{"checkoutSuccess":true,"orderId":"ord_101"}');
  });

  it('normalizes standard text messages', () => {
    const raw = {
      update_id: 1005,
      message: {
        message_id: 59,
        from: { id: 98765 },
        chat: { id: 98765 },
        text: 'Halo admin, apakah Netflix ready?',
      },
    };

    const ctx = normalizeTelegramUpdate(botId, raw);
    expect(ctx.type).toBe('MESSAGE');
    expect(ctx.text).toBe('Halo admin, apakah Netflix ready?');
    expect(ctx.command).toBeUndefined();
  });

  it('throws TelegramInvalidUpdateError on null or missing update_id', () => {
    expect(() => normalizeTelegramUpdate(botId, null)).toThrow(TelegramInvalidUpdateError);
    expect(() => normalizeTelegramUpdate(botId, {})).toThrow(TelegramInvalidUpdateError);
    expect(() => normalizeTelegramUpdate(botId, { update_id: 'invalid' })).toThrow(
      TelegramInvalidUpdateError,
    );
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { createTelegramTestHarness, TelegramTestHarness } from './test-helpers.js';

describe('Telegram Engine — Command Router', () => {
  let harness: TelegramTestHarness;

  beforeEach(async () => {
    harness = await createTelegramTestHarness();
  });

  it('routes /start and presents welcome message with Mini App button', async () => {
    const { engineService, adapter, botIdA } = harness;

    const raw = {
      update_id: 101,
      message: {
        message_id: 1,
        from: { id: 1234, first_name: 'Budi' },
        chat: { id: 1234 },
        text: '/start',
      },
    };

    const result = await engineService.processUpdate(botIdA, raw);
    expect(result.status).toBe('PROCESSED');
    expect(result.action).toBe('CMD_START_SUCCESS');

    expect(adapter.sentMessages).toHaveLength(1);
    const msg = adapter.sentMessages[0]!;
    expect(msg.text).toContain('Selamat datang di Bintang Store');
    expect(msg.replyMarkup?.inlineKeyboard?.[0]?.[0]?.webAppUrl).toBe(
      'https://bintanggstore.web.id',
    );
  });

  it('routes /products and returns active store products with formatted prices', async () => {
    const { engineService, adapter, botIdA } = harness;

    const raw = {
      update_id: 102,
      message: {
        message_id: 2,
        from: { id: 1234 },
        chat: { id: 1234 },
        text: '/products',
      },
    };

    const result = await engineService.processUpdate(botIdA, raw);
    expect(result.status).toBe('PROCESSED');
    expect(result.action).toBe('CMD_PRODUCTS_SUCCESS');

    const msg = adapter.sentMessages[0]!;
    expect(msg.text).toContain('Spotify Premium 1 Bulan');
    expect(msg.text).toContain('Rp 19.000');
    expect(msg.text).toContain('Netflix 4K UHD 1 Bulan');
    expect(msg.text).toContain('Rp 35.000');
  });

  it('routes /orders and shows only the calling customer orders', async () => {
    const { engineService, adapter, botIdA } = harness;

    // Alice queries orders (Alice has order ORD-1001)
    const raw = {
      update_id: 103,
      message: {
        message_id: 3,
        from: { id: 'tg_user_alice', first_name: 'Alice' },
        chat: { id: 'tg_user_alice' },
        text: '/orders',
      },
    };

    const result = await engineService.processUpdate(botIdA, raw);
    expect(result.status).toBe('PROCESSED');
    expect(result.action).toBe('CMD_ORDERS_SUCCESS');

    const msg = adapter.sentMessages[0]!;
    expect(msg.text).toContain('#ORD-1001');
    expect(msg.text).not.toContain('#ORD-1002'); // Bob's order must NOT appear
  });

  it('routes /order <orderId> and returns order detail with sanitized fulfillment', async () => {
    const { engineService, adapter, botIdA, orderA1 } = harness;

    const raw = {
      update_id: 104,
      message: {
        message_id: 4,
        from: { id: 'tg_user_alice' },
        chat: { id: 'tg_user_alice' },
        text: `/order ${orderA1.id}`,
      },
    };

    const result = await engineService.processUpdate(botIdA, raw);
    expect(result.status).toBe('PROCESSED');
    expect(result.action).toBe('CMD_ORDER_DETAIL_SUCCESS');

    const msg = adapter.sentMessages[0]!;
    expect(msg.text).toContain('ORD-1001');
    expect(msg.text).toContain('PAID');
    expect(msg.text).toContain('ref_token_xyz98214');
  });

  it('routes /help and returns command guidance', async () => {
    const { engineService, adapter, botIdA } = harness;

    const raw = {
      update_id: 105,
      message: {
        message_id: 5,
        from: { id: 1234 },
        chat: { id: 1234 },
        text: '/help',
      },
    };

    const result = await engineService.processUpdate(botIdA, raw);
    expect(result.status).toBe('PROCESSED');
    expect(result.action).toBe('CMD_HELP_SUCCESS');

    const msg = adapter.sentMessages[0]!;
    expect(msg.text).toContain('/start');
    expect(msg.text).toContain('/products');
  });

  it('routes /admin for verified store seller successfully', async () => {
    const { engineService, adapter, botIdA } = harness;

    const raw = {
      update_id: 106,
      message: {
        message_id: 6,
        from: { id: 'tg_user_seller_alice' },
        chat: { id: 'tg_user_seller_alice' },
        text: '/admin',
      },
    };

    const result = await engineService.processUpdate(botIdA, raw);
    expect(result.status).toBe('PROCESSED');
    expect(result.action).toBe('CMD_SELLER_SUCCESS');

    const msg = adapter.sentMessages[0]!;
    expect(msg.text).toContain('Panel Penjual');
    expect(msg.text).toContain('STORE_OWNER');
  });

  it('rejects /admin for non-seller customer safely', async () => {
    const { engineService, adapter, botIdA } = harness;

    const raw = {
      update_id: 107,
      message: {
        message_id: 7,
        from: { id: 'tg_user_alice' }, // regular customer
        chat: { id: 'tg_user_alice' },
        text: '/admin',
      },
    };

    const result = await engineService.processUpdate(botIdA, raw);
    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('Akses ditolak');

    const msg = adapter.sentMessages[0]!;
    expect(msg.text).toContain('Akses ditolak');
  });
});

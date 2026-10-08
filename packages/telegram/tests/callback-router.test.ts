import { describe, it, expect, beforeEach } from 'vitest';
import { createTelegramTestHarness, TelegramTestHarness } from './test-helpers.js';

describe('Telegram Engine — Callback Router', () => {
  let harness: TelegramTestHarness;

  beforeEach(async () => {
    harness = await createTelegramTestHarness();
  });

  it('routes product:view:<id> and displays single product card', async () => {
    const { engineService, adapter, botIdA, productA1 } = harness;

    const raw = {
      update_id: 201,
      callback_query: {
        id: 'cb_query_1',
        from: { id: 555 },
        message: {
          message_id: 20,
          chat: { id: 555 },
        },
        data: `product:view:${productA1.id}`,
      },
    };

    const result = await engineService.processUpdate(botIdA, raw);
    expect(result.status).toBe('PROCESSED');
    expect(result.action).toBe('CB_PRODUCT_VIEW_SUCCESS');

    // Acknowledges callback query
    expect(adapter.answeredCallbacks).toHaveLength(1);
    expect(adapter.answeredCallbacks[0]!.callbackQueryId).toBe('cb_query_1');

    // Sends product detail
    const msg = adapter.sentMessages[0]!;
    expect(msg.text).toContain('Spotify Premium 1 Bulan');
    expect(msg.text).toContain('Rp 19.000');
  });

  it('routes order:view:<id> and displays customer order details', async () => {
    const { engineService, adapter, botIdA, orderA1 } = harness;

    const raw = {
      update_id: 202,
      callback_query: {
        id: 'cb_query_2',
        from: { id: 'tg_user_alice' },
        message: {
          message_id: 21,
          chat: { id: 'tg_user_alice' },
        },
        data: `order:view:${orderA1.id}`,
      },
    };

    const result = await engineService.processUpdate(botIdA, raw);
    expect(result.status).toBe('PROCESSED');
    expect(result.action).toBe('CB_ORDER_VIEW_SUCCESS');

    const msg = adapter.sentMessages[0]!;
    expect(msg.text).toContain('#ORD-1001');
    expect(msg.text).toContain('PAID');
  });

  it('routes action:list_products and action:list_orders cleanly', async () => {
    const { engineService, botIdA } = harness;

    const raw1 = {
      update_id: 203,
      callback_query: {
        id: 'cb_3',
        from: { id: 555 },
        message: { message_id: 22, chat: { id: 555 } },
        data: 'action:list_products',
      },
    };

    const res1 = await engineService.processUpdate(botIdA, raw1);
    expect(res1.status).toBe('PROCESSED');
    expect(res1.action).toBe('CB_LIST_PRODUCTS_SUCCESS');

    const raw2 = {
      update_id: 204,
      callback_query: {
        id: 'cb_4',
        from: { id: 'tg_user_alice' },
        message: { message_id: 23, chat: { id: 'tg_user_alice' } },
        data: 'action:list_orders',
      },
    };

    const res2 = await engineService.processUpdate(botIdA, raw2);
    expect(res2.status).toBe('PROCESSED');
    expect(res2.action).toBe('CB_LIST_ORDERS_SUCCESS');
  });

  it('rejects cross-tenant product view in callback safely', async () => {
    const { engineService, adapter, botIdA, productB1 } = harness;

    // Attacker on Bot A attempts to inspect Product B1 from Store B
    const raw = {
      update_id: 205,
      callback_query: {
        id: 'cb_5',
        from: { id: 555 },
        message: { message_id: 24, chat: { id: 555 } },
        data: `product:view:${productB1.id}`,
      },
    };

    const result = await engineService.processUpdate(botIdA, raw);
    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('tidak ditemukan');

    const msg = adapter.sentMessages[0]!;
    expect(msg.text).toContain('tidak ditemukan');
  });
});

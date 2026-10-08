import { describe, it, expect, beforeEach } from 'vitest';
import { MockTelegramAdapter, TelegramAdapterError } from '../src/index.js';

describe('Telegram Engine — Transport Adapter & Mock Double', () => {
  let adapter: MockTelegramAdapter;

  beforeEach(() => {
    adapter = new MockTelegramAdapter();
  });

  it('sends text message and assigns incremental message IDs', async () => {
    const res1 = await adapter.sendMessage('bot_1', {
      chatId: '12345',
      text: 'Halo Pelanggan',
    });
    const res2 = await adapter.sendMessage('bot_1', {
      chatId: '12345',
      text: 'Pesan Kedua',
    });

    expect(res1.messageId).toBe(1001);
    expect(res2.messageId).toBe(1002);
    expect(adapter.sentMessages).toHaveLength(2);
    expect(adapter.sentMessages[0]!.text).toBe('Halo Pelanggan');
  });

  it('records message edits accurately', async () => {
    await adapter.editMessage('bot_1', 1001, {
      chatId: '12345',
      text: 'Pesan Terperbarui',
    });

    expect(adapter.editedMessages).toHaveLength(1);
    expect(adapter.editedMessages[0]!.messageId).toBe(1001);
    expect(adapter.editedMessages[0]!.payload.text).toBe('Pesan Terperbarui');
  });

  it('answers callback queries and records responses', async () => {
    await adapter.answerCallbackQuery('bot_1', {
      callbackQueryId: 'cb_query_999',
      text: 'Aksi diproses',
    });

    expect(adapter.answeredCallbacks).toHaveLength(1);
    expect(adapter.answeredCallbacks[0]!.callbackQueryId).toBe('cb_query_999');
    expect(adapter.answeredCallbacks[0]!.text).toBe('Aksi diproses');
  });

  it('simulates adapter failures when instructed', async () => {
    adapter.simulateSendFailure(new TelegramAdapterError('Network connection refused'));

    await expect(adapter.sendMessage('bot_1', { chatId: '123', text: 'Test' })).rejects.toThrow(
      'Network connection refused',
    );

    // Next send should succeed after single-shot simulation
    const nextRes = await adapter.sendMessage('bot_1', { chatId: '123', text: 'Recovered' });
    expect(nextRes.messageId).toBeGreaterThan(0);
  });
});

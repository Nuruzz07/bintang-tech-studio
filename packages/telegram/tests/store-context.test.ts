import { describe, it, expect, beforeEach } from 'vitest';
import { createTelegramTestHarness, TelegramTestHarness } from './test-helpers.js';
import { TelegramBotNotFoundError, TelegramBotInactiveError } from '../src/index.js';

describe('Telegram Engine — Store Context Resolution', () => {
  let harness: TelegramTestHarness;

  beforeEach(async () => {
    harness = await createTelegramTestHarness();
  });

  it('resolves Store Context from active bot binding', async () => {
    const { storeResolver, botIdA, storeIdA } = harness;

    const { binding, store } = await storeResolver.resolveStoreFromBot(botIdA);
    expect(binding.status).toBe('ACTIVE');
    expect(store.storeId).toBe(storeIdA);
    expect(store.storeName).toBe('Bintang Store');
    expect(store.botId).toBe(botIdA);
  });

  it('rejects unmapped or unknown bot with TelegramBotNotFoundError', async () => {
    const { storeResolver } = harness;

    await expect(storeResolver.resolveStoreFromBot('unknown_bot_999')).rejects.toThrow(
      TelegramBotNotFoundError,
    );
  });

  it('rejects disabled or revoked bot with TelegramBotInactiveError', async () => {
    const { storeResolver, botIdDisabled } = harness;

    await expect(storeResolver.resolveStoreFromBot(botIdDisabled)).rejects.toThrow(
      TelegramBotInactiveError,
    );
  });

  it('ignores client-supplied store_id in command arguments and binds strictly to bot store', async () => {
    const { engineService, adapter, botIdA, storeIdB } = harness;

    // Attacker tries to pass a foreign store_id in command arguments
    const rawUpdate = {
      update_id: 8801,
      message: {
        message_id: 1,
        from: { id: 111, first_name: 'Attacker' },
        chat: { id: 111 },
        text: `/products store_id=${storeIdB}`,
      },
    };

    const result = await engineService.processUpdate(botIdA, rawUpdate);
    expect(result.status).toBe('PROCESSED');

    // Message sent must reflect Store A (Bintang Store), NOT Store B
    const lastMsg = adapter.sentMessages[adapter.sentMessages.length - 1];
    expect(lastMsg?.text).toContain('Bintang Store');
    expect(lastMsg?.text).not.toContain('Other Tenant Store');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryTelegramBotRepository,
  TelegramBotBinding,
  TelegramBotNotFoundError,
} from '../src/index.js';

describe('Telegram Engine — Bot Binding Repository', () => {
  let repo: InMemoryTelegramBotRepository;

  beforeEach(() => {
    repo = new InMemoryTelegramBotRepository();
  });

  it('creates and finds bot binding by telegramBotId and ID', async () => {
    const binding: TelegramBotBinding = {
      id: 'bnd_101',
      storeId: 'str_1',
      telegramBotId: 'bot_alpha_1',
      displayName: 'Toko Alpha',
      status: 'ACTIVE',
      credentialReference: 'vault://secrets/bot_alpha',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await repo.create(binding);

    const byTgId = await repo.findByTelegramBotId('bot_alpha_1');
    expect(byTgId).not.toBeNull();
    expect(byTgId?.storeId).toBe('str_1');

    const byId = await repo.findById('bnd_101');
    expect(byId).not.toBeNull();
    expect(byId?.telegramBotId).toBe('bot_alpha_1');
  });

  it('updates bot lifecycle status (ACTIVE -> DISABLED -> REVOKED)', async () => {
    const binding: TelegramBotBinding = {
      id: 'bnd_102',
      storeId: 'str_1',
      telegramBotId: 'bot_beta_2',
      displayName: 'Toko Beta',
      status: 'ACTIVE',
      credentialReference: 'vault://secrets/bot_beta',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await repo.create(binding);

    const disabled = await repo.updateStatus('bnd_102', 'DISABLED');
    expect(disabled.status).toBe('DISABLED');

    const revoked = await repo.updateStatus('bnd_102', 'REVOKED');
    expect(revoked.status).toBe('REVOKED');
  });

  it('throws TelegramBotNotFoundError when updating unknown binding', async () => {
    await expect(repo.updateStatus('unknown_id', 'DISABLED')).rejects.toThrow(
      TelegramBotNotFoundError,
    );
  });

  it('lists bots scoped to a specific store', async () => {
    const now = new Date().toISOString();
    await repo.create({
      id: 'bnd_1',
      storeId: 'str_A',
      telegramBotId: 'bot_a1',
      displayName: 'Bot A1',
      status: 'ACTIVE',
      credentialReference: 'ref',
      createdAt: now,
      updatedAt: now,
    });
    await repo.create({
      id: 'bnd_2',
      storeId: 'str_A',
      telegramBotId: 'bot_a2',
      displayName: 'Bot A2',
      status: 'ACTIVE',
      credentialReference: 'ref',
      createdAt: now,
      updatedAt: now,
    });
    await repo.create({
      id: 'bnd_3',
      storeId: 'str_B',
      telegramBotId: 'bot_b1',
      displayName: 'Bot B1',
      status: 'ACTIVE',
      credentialReference: 'ref',
      createdAt: now,
      updatedAt: now,
    });

    const storeABots = await repo.listByStore('str_A');
    expect(storeABots).toHaveLength(2);
    expect(storeABots.every((b) => b.storeId === 'str_A')).toBe(true);

    const storeBBots = await repo.listByStore('str_B');
    expect(storeBBots).toHaveLength(1);
    expect(storeBBots[0]!.telegramBotId).toBe('bot_b1');
  });
});

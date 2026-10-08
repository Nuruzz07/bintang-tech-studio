/**
 * Bintang Tech Studio — Platform Templates, Bots & Channels Test Suite.
 * Baseline: Milestone M14 Owner Console Foundation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestOwnerConsoleHarness, TestOwnerConsoleHarness } from './test-helpers.js';

describe('M14 Templates, Bots & Secret Shielding Suite', () => {
  let harness: TestOwnerConsoleHarness;
  let ownerToken: string;
  let adminToken: string;

  beforeEach(async () => {
    harness = createTestOwnerConsoleHarness();
    ownerToken = await harness.createOwnerSession();
    adminToken = await harness.createAdminSession();

    await harness.storeRepo.create({
      id: 'store_bot_1',
      ownerUserId: 'usr_seller_1',
      name: 'Bot Test Store',
      slug: 'bot-test-store',
      templateVersionId: 'tmpl_ver_1',
      status: 'ACTIVE',
      currency: 'IDR',
      settings: {},
    });
  });

  it('lists storefront templates and versions', async () => {
    const tmpls = await harness.service.listTemplates(adminToken);
    expect(tmpls.length).toBeGreaterThanOrEqual(1);
    expect(tmpls[0]!.slug).toBe('template-01');
    expect(tmpls[0]!.publishedVersion).toBe('1.0.0');
  });

  it('updates template version status and records audit log', async () => {
    const updated = await harness.service.updateTemplateVersionStatus(
      ownerToken,
      'tmpl_ver_1',
      'DEPRECATED',
      'Replaced by version 2.0.0',
    );
    expect(updated.status).toBe('DEPRECATED');

    const logs = await harness.auditRepo.list({ resourceType: 'template_version' });
    expect(logs.length).toBe(1);
    expect(logs[0]!.result).toBe('SUCCESS');
  });

  it('lists bots across stores with STRICT ZERO SECRET LEAKAGE', async () => {
    const bots = await harness.service.listBots(adminToken);
    expect(bots.length).toBe(1);

    const bot = bots[0]!;
    expect(bot.storeId).toBe('store_bot_1');
    expect(bot.displayName).toBe('Bot Test Store Bot');
    expect(bot.status).toBe('CONNECTED');

    // CRITICAL: Credential must be masked, zero raw BOT_TOKEN or API secret
    expect(bot.maskedCredentialRef).toMatch(/^ref_tg_\*\*\*/);
    expect(JSON.stringify(bot)).not.toContain('bot_token');
    expect(JSON.stringify(bot)).not.toContain('BOT_TOKEN');
    expect(JSON.stringify(bot)).not.toContain('secret');
  });

  it('lists store channels across the platform', async () => {
    const channels = await harness.service.listChannels(adminToken);
    expect(channels.length).toBe(2); // Telegram + WhatsApp
    expect(channels.some((c) => c.channel === 'TELEGRAM')).toBe(true);
    expect(channels.some((c) => c.channel === 'WHATSAPP')).toBe(true);
  });
});

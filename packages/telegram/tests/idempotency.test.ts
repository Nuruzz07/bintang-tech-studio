import { describe, it, expect, beforeEach } from 'vitest';
import { createTelegramTestHarness, TelegramTestHarness } from './test-helpers.js';

describe('Telegram Engine — Update Idempotency & Concurrency', () => {
  let harness: TelegramTestHarness;

  beforeEach(async () => {
    harness = await createTelegramTestHarness();
  });

  it('processes initial update and skips duplicate delivery safely', async () => {
    const { engineService, adapter, botIdA } = harness;

    const raw = {
      update_id: 301,
      message: {
        message_id: 1,
        from: { id: 100 },
        chat: { id: 100 },
        text: '/start',
      },
    };

    // First delivery
    const res1 = await engineService.processUpdate(botIdA, raw);
    expect(res1.status).toBe('PROCESSED');
    expect(res1.outboundMessageCount).toBe(1);
    expect(adapter.sentMessages).toHaveLength(1);

    // Duplicate delivery with same update_id
    const res2 = await engineService.processUpdate(botIdA, raw);
    expect(res2.status).toBe('SKIPPED_DUPLICATE');
    expect(res2.outboundMessageCount).toBe(0);

    // Outbound messages count remains exactly 1 (no duplicate sent)
    expect(adapter.sentMessages).toHaveLength(1);
  });

  it('handles concurrent duplicate updates with exactly ONE business execution', async () => {
    const { engineService, adapter, botIdA } = harness;

    const raw = {
      update_id: 302,
      message: {
        message_id: 2,
        from: { id: 200 },
        chat: { id: 200 },
        text: '/products',
      },
    };

    // Launch identical updates simultaneously
    const [res1, res2] = await Promise.all([
      engineService.processUpdate(botIdA, raw),
      engineService.processUpdate(botIdA, raw),
    ]);

    const statuses = [res1.status, res2.status];
    expect(statuses).toContain('PROCESSED');
    expect(statuses).toContain('SKIPPED_DUPLICATE');

    // Exactly one outbound message should have been delivered
    expect(adapter.sentMessages).toHaveLength(1);
  });

  it('allows retry after a retryable failure occurred', async () => {
    const { engineService, adapter, updateRepo, botIdA } = harness;

    // Simulate adapter failure on first attempt
    adapter.simulateSendFailure(new Error('Transient network glitch'));

    const raw = {
      update_id: 303,
      message: {
        message_id: 3,
        from: { id: 300 },
        chat: { id: 300 },
        text: '/help',
      },
    };

    const res1 = await engineService.processUpdate(botIdA, raw);
    expect(res1.status).toBe('FAILED');

    // Verify record in repo is marked failed and retryable
    const rec = await updateRepo.find(botIdA, 303);
    expect(rec?.status).toBe('FAILED');
    expect(rec?.retryable).toBe(true);

    // Second delivery (retry) succeeds
    const res2 = await engineService.processUpdate(botIdA, raw);
    expect(res2.status).toBe('PROCESSED');
    expect(res2.action).toBe('CMD_HELP_SUCCESS');
  });
});

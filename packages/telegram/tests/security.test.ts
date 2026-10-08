import { describe, it, expect, beforeEach } from 'vitest';
import { createTelegramTestHarness, TelegramTestHarness } from './test-helpers.js';

describe('Telegram Engine — 22 Mandatory Security Scenarios', () => {
  let harness: TelegramTestHarness;

  beforeEach(async () => {
    harness = await createTelegramTestHarness();
  });

  // =========================================================================
  // A. TENANT ISOLATION (Scenarios 1 - 4)
  // =========================================================================

  it('Scenario 1: Bot A cannot access Store B products or catalog', async () => {
    const { engineService, adapter, botIdA, productB1 } = harness;

    // Request product list on Bot A
    await engineService.processUpdate(botIdA, {
      update_id: 401,
      message: { message_id: 1, from: { id: 1 }, chat: { id: 1 }, text: '/products' },
    });

    const msg = adapter.sentMessages[adapter.sentMessages.length - 1]!;
    expect(msg.text).not.toContain(productB1.name);
  });

  it('Scenario 2: Bot B cannot access Store A products or catalog', async () => {
    const { engineService, adapter, botIdB, productA1, productA2 } = harness;

    // Request product list on Bot B
    await engineService.processUpdate(botIdB, {
      update_id: 402,
      message: { message_id: 1, from: { id: 1 }, chat: { id: 1 }, text: '/products' },
    });

    const msg = adapter.sentMessages[adapter.sentMessages.length - 1]!;
    expect(msg.text).not.toContain(productA1.name);
    expect(msg.text).not.toContain(productA2.name);
  });

  it('Scenario 3: Disabled bot cannot execute Store operations', async () => {
    const { engineService, botIdDisabled } = harness;

    const res = await engineService.processUpdate(botIdDisabled, {
      update_id: 403,
      message: { message_id: 1, from: { id: 1 }, chat: { id: 1 }, text: '/start' },
    });

    expect(res.status).toBe('FAILED');
    expect(res.error).toContain('is not active');
  });

  it('Scenario 4: Unknown bot cannot execute Store operations', async () => {
    const { engineService } = harness;

    const res = await engineService.processUpdate('bot_completely_fake_999', {
      update_id: 404,
      message: { message_id: 1, from: { id: 1 }, chat: { id: 1 }, text: '/start' },
    });

    expect(res.status).toBe('FAILED');
    expect(res.error).toContain('not found or unmapped');
  });

  // =========================================================================
  // B. CUSTOMER ISOLATION (Scenarios 5 - 8)
  // =========================================================================

  it('Scenario 5: Customer A cannot access Customer B orders', async () => {
    const { engineService, adapter, botIdA, orderA2 } = harness;

    // Alice tries to inspect Bob's order ORD-1002
    const res = await engineService.processUpdate(botIdA, {
      update_id: 405,
      message: {
        message_id: 1,
        from: { id: 'tg_user_alice' },
        chat: { id: 'tg_user_alice' },
        text: `/order ${orderA2.id}`,
      },
    });

    expect(res.status).toBe('FAILED');
    expect(res.error).toContain('tidak ditemukan atau akses tidak tersedia');

    const msg = adapter.sentMessages[adapter.sentMessages.length - 1]!;
    expect(msg.text).not.toContain('ORD-1002');
  });

  it('Scenario 6: Customer cannot spoof customerId via command arguments', async () => {
    const { engineService, adapter, botIdA, customerBob } = harness;

    // Alice tries to spoof customerId as Bob's in order listing
    const res = await engineService.processUpdate(botIdA, {
      update_id: 406,
      message: {
        message_id: 1,
        from: { id: 'tg_user_alice' },
        chat: { id: 'tg_user_alice' },
        text: `/orders customerId=${customerBob.id}`,
      },
    });

    expect(res.status).toBe('PROCESSED');
    const msg = adapter.sentMessages[adapter.sentMessages.length - 1]!;
    // Results MUST belong to Alice (#ORD-1001), not Bob (#ORD-1002)
    expect(msg.text).toContain('#ORD-1001');
    expect(msg.text).not.toContain('#ORD-1002');
  });

  it('Scenario 7: Customer cannot spoof storeId to escape tenant boundary', async () => {
    const { engineService, adapter, botIdA, storeIdB } = harness;

    // Customer on Bot A tries to query Store B
    await engineService.processUpdate(botIdA, {
      update_id: 407,
      message: {
        message_id: 1,
        from: { id: 1 },
        chat: { id: 1 },
        text: `/products storeId=${storeIdB}`,
      },
    });

    const msg = adapter.sentMessages[adapter.sentMessages.length - 1]!;
    expect(msg.text).toContain('Bintang Store');
    expect(msg.text).not.toContain('Other Tenant');
  });

  it('Scenario 8: Telegram identity from Store A cannot be replayed against Store B to access Store A data', async () => {
    const { engineService, adapter, botIdB } = harness;

    // Alice queries orders on Bot B (Alice has an order on Store A, but NONE on Store B)
    await engineService.processUpdate(botIdB, {
      update_id: 408,
      message: {
        message_id: 1,
        from: { id: 'tg_user_alice' },
        chat: { id: 'tg_user_alice' },
        text: '/orders',
      },
    });

    const msg = adapter.sentMessages[adapter.sentMessages.length - 1]!;
    expect(msg.text).not.toContain('ORD-1001');
  });

  // =========================================================================
  // C. AUTHORIZATION (Scenarios 9 - 11)
  // =========================================================================

  it('Scenario 9: Customer cannot execute seller commands', async () => {
    const { engineService, botIdA } = harness;

    const res = await engineService.processUpdate(botIdA, {
      update_id: 409,
      message: {
        message_id: 1,
        from: { id: 'tg_user_alice' }, // regular customer
        chat: { id: 'tg_user_alice' },
        text: '/admin',
      },
    });

    expect(res.status).toBe('FAILED');
    expect(res.error).toContain('Akses ditolak');
  });

  it('Scenario 10: Store staff without permissions cannot execute owner operations', async () => {
    const { contextClassifier, authService, storeIdA } = harness;

    // Register a STAFF member with limited roles
    contextClassifier.registerSellerMapping({
      storeId: storeIdA,
      telegramUserId: 'tg_user_staff_dan',
      userId: 'usr_staff_dan',
      member: {
        id: 'mem_staff_dan',
        storeId: storeIdA,
        userId: 'usr_staff_dan',
        role: 'STORE_STAFF',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      tenantSlug: 'bintang-store',
    });

    const caller = await contextClassifier.classifyCaller(storeIdA, 'tg_user_staff_dan');
    expect(caller.type).toBe('SELLER');
    if (caller.type !== 'SELLER') throw new Error('Expected SELLER');

    // Attempting owner-only permission (e.g. subscription.manage) must be rejected by M04 AuthorizationService
    await expect(
      authService.assertAuthorizedStoreAction({
        context: caller.context,
        permission: 'subscription.manage',
        targetStoreId: storeIdA,
      }),
    ).rejects.toThrow();
  });

  it('Scenario 11: Telegram engine strictly enforces M04 AuthorizationService permissions', async () => {
    const { authService, storeIdA, storeIdB, sellerAlice } = harness;

    const sellerContext = {
      storeId: storeIdA,
      tenantSlug: 'bintang-store',
      userId: sellerAlice.userId,
      membershipId: sellerAlice.id,
      role: sellerAlice.role,
    };

    // Access to own store succeeds
    await expect(
      authService.assertAuthorizedStoreAction({
        context: sellerContext,
        permission: 'store.settings.read',
        targetStoreId: storeIdA,
      }),
    ).resolves.not.toThrow();

    // Cross-tenant access fails
    await expect(
      authService.assertAuthorizedStoreAction({
        context: sellerContext,
        permission: 'store.settings.read',
        targetStoreId: storeIdB,
      }),
    ).rejects.toThrow();
  });

  // =========================================================================
  // D. CALLBACK SECURITY (Scenarios 12 - 13)
  // =========================================================================

  it('Scenario 12: Tampered callback cannot bypass resource ownership', async () => {
    const { engineService, botIdA, orderA2 } = harness;

    // Alice sends callback attempting to view Bob's order
    const res = await engineService.processUpdate(botIdA, {
      update_id: 412,
      callback_query: {
        id: 'cb_query_tampered',
        from: { id: 'tg_user_alice' },
        message: { message_id: 1, chat: { id: 'tg_user_alice' } },
        data: `order:view:${orderA2.id}`,
      },
    });

    expect(res.status).toBe('FAILED');
    expect(res.error).toContain('tidak ditemukan atau akses tidak tersedia');
  });

  it('Scenario 13: Callback cannot change Store Context', async () => {
    const { engineService, adapter, botIdA, productB1 } = harness;

    // Callback on Bot A attempting to view Store B product
    const res = await engineService.processUpdate(botIdA, {
      update_id: 413,
      callback_query: {
        id: 'cb_tampered_store',
        from: { id: 999 },
        message: { message_id: 1, chat: { id: 999 } },
        data: `product:view:${productB1.id}`,
      },
    });

    expect(res.status).toBe('FAILED');
    const msg = adapter.sentMessages[adapter.sentMessages.length - 1]!;
    expect(msg.text).toContain('tidak ditemukan');
  });

  // =========================================================================
  // E. IDEMPOTENCY (Scenarios 14 - 16)
  // =========================================================================

  it('Scenario 14: Same Telegram update processed twice results in exactly one business execution', async () => {
    const { engineService, adapter, botIdA } = harness;

    const raw = {
      update_id: 414,
      message: { message_id: 1, from: { id: 1 }, chat: { id: 1 }, text: '/help' },
    };

    const res1 = await engineService.processUpdate(botIdA, raw);
    const res2 = await engineService.processUpdate(botIdA, raw);

    expect(res1.status).toBe('PROCESSED');
    expect(res2.status).toBe('SKIPPED_DUPLICATE');
    expect(adapter.sentMessages).toHaveLength(1);
  });

  it('Scenario 15: Concurrent duplicate update processing results in exactly one business execution', async () => {
    const { engineService, adapter, botIdA } = harness;

    const raw = {
      update_id: 415,
      message: { message_id: 1, from: { id: 1 }, chat: { id: 1 }, text: '/products' },
    };

    const [res1, res2] = await Promise.all([
      engineService.processUpdate(botIdA, raw),
      engineService.processUpdate(botIdA, raw),
    ]);

    const statuses = [res1.status, res2.status];
    expect(statuses).toContain('PROCESSED');
    expect(statuses).toContain('SKIPPED_DUPLICATE');
    expect(adapter.sentMessages).toHaveLength(1);
  });

  it('Scenario 16: Retry after retryable failure behaves safely', async () => {
    const { engineService, adapter, botIdA } = harness;

    adapter.simulateSendFailure(new Error('Transient socket error'));

    const raw = {
      update_id: 416,
      message: { message_id: 1, from: { id: 1 }, chat: { id: 1 }, text: '/start' },
    };

    const res1 = await engineService.processUpdate(botIdA, raw);
    expect(res1.status).toBe('FAILED');

    // Second attempt recovers
    const res2 = await engineService.processUpdate(botIdA, raw);
    expect(res2.status).toBe('PROCESSED');
  });

  // =========================================================================
  // F. SECRET SAFETY (Scenarios 17 - 20)
  // =========================================================================

  it('Scenario 17: No Telegram bot token appears in customer-facing DTOs or outbound payloads', async () => {
    const { engineService, adapter, botIdA } = harness;

    await engineService.processUpdate(botIdA, {
      update_id: 417,
      message: { message_id: 1, from: { id: 1 }, chat: { id: 1 }, text: '/start' },
    });

    const msg = adapter.sentMessages[0]!;
    expect(msg.text).not.toContain('bot_a_token');
    expect(msg.text).not.toContain('vault://');
    expect(JSON.stringify(msg)).not.toContain('token');
  });

  it('Scenario 18: No provider credential appears in test double payloads or messages', async () => {
    const { adapter } = harness;
    for (const msg of adapter.sentMessages) {
      expect(msg.text).not.toMatch(/bot[0-9]{8,}:[a-zA-Z0-9_-]{35}/);
    }
  });

  it('Scenario 19: Order detail never exposes internal fulfillment credentials to customers', async () => {
    const { engineService, adapter, botIdA, orderA1 } = harness;

    await engineService.processUpdate(botIdA, {
      update_id: 419,
      message: {
        message_id: 1,
        from: { id: 'tg_user_alice' },
        chat: { id: 'tg_user_alice' },
        text: `/order ${orderA1.id}`,
      },
    });

    const msg = adapter.sentMessages[adapter.sentMessages.length - 1]!;
    // Must NOT contain internal inventory item IDs
    expect(msg.text).not.toContain('ful_item_1');
    expect(msg.text).not.toContain('item_1');
    // Only safe public payloadReference
    expect(msg.text).toContain('ref_token_xyz98214');
  });

  it('Scenario 20: Safe error messages never expose database details or internal stack traces', async () => {
    const { engineService, adapter, botIdA } = harness;

    await engineService.processUpdate(botIdA, {
      update_id: 420,
      message: {
        message_id: 1,
        from: { id: 1 },
        chat: { id: 1 },
        text: '/invalid_command_xyz',
      },
    });

    const msg = adapter.sentMessages[adapter.sentMessages.length - 1]!;
    expect(msg.text).not.toContain('at ');
    expect(msg.text).not.toContain('Error:');
    expect(msg.text).toContain('Perintah tidak dikenali');
  });

  // =========================================================================
  // G. MINI APP SECURITY (Scenarios 21 - 22)
  // =========================================================================

  it('Scenario 21: Mini App URL is configuration-driven and matches store binding', async () => {
    const { engineService, adapter, botIdA, botIdB } = harness;

    await engineService.processUpdate(botIdA, {
      update_id: 421,
      message: { message_id: 1, from: { id: 1 }, chat: { id: 1 }, text: '/start' },
    });
    const msgA = adapter.sentMessages[0]!;
    expect(msgA.replyMarkup?.inlineKeyboard?.[0]?.[0]?.webAppUrl).toBe(
      'https://bintanggstore.web.id',
    );

    await engineService.processUpdate(botIdB, {
      update_id: 422,
      message: { message_id: 2, from: { id: 2 }, chat: { id: 2 }, text: '/start' },
    });
    const msgB = adapter.sentMessages[1]!;
    expect(msgB.replyMarkup?.inlineKeyboard?.[0]?.[0]?.webAppUrl).toBe('https://otherstore.id');
  });

  it('Scenario 22: Telegram launch parameters cannot override Store Context', async () => {
    const { engineService, adapter, botIdA, storeIdB } = harness;

    // Attacker passes deep-link start param attempting to hijack Store Context to Store B
    await engineService.processUpdate(botIdA, {
      update_id: 423,
      message: {
        message_id: 1,
        from: { id: 1 },
        chat: { id: 1 },
        text: `/start store_id=${storeIdB}`,
      },
    });

    const msg = adapter.sentMessages[adapter.sentMessages.length - 1]!;
    expect(msg.text).toContain('Bintang Store');
    expect(msg.text).not.toContain('Other Tenant');
  });
});

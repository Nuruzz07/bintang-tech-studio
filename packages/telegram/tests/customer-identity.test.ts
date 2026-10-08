import { describe, it, expect, beforeEach } from 'vitest';
import { createTelegramTestHarness, TelegramTestHarness } from './test-helpers.js';

describe('Telegram Engine — Customer Identity Resolution', () => {
  let harness: TelegramTestHarness;

  beforeEach(async () => {
    harness = await createTelegramTestHarness();
  });

  it('resolves existing customer by telegramId within store boundary', async () => {
    const { customerIdentityManager, storeIdA, customerAlice } = harness;

    const res = await customerIdentityManager.resolveCustomer(storeIdA, 'tg_user_alice', {
      id: 'tg_user_alice',
      username: 'alice_wonder',
    });

    expect(res.customer.id).toBe(customerAlice.id);
    expect(res.identity.customerId).toBe(customerAlice.id);
    expect(res.customerContext.customerId).toBe(customerAlice.id);
  });

  it('auto-provisions new store-scoped customer if telegramId is not registered', async () => {
    const { customerIdentityManager, customerRepo, storeIdA } = harness;

    const res = await customerIdentityManager.resolveCustomer(storeIdA, 'tg_user_newbie_99', {
      id: 'tg_user_newbie_99',
      firstName: 'Newbie',
      username: 'newbie99',
    });

    expect(res.customer.id).toContain('cust_tg_');
    expect(res.customer.name).toBe('Newbie');
    expect(res.customer.telegramId).toBe('tg_user_newbie_99');

    // Verify persisted in customer repository
    const stored = await customerRepo.findById(storeIdA, res.customer.id);
    expect(stored).not.toBeNull();
    expect(stored?.name).toBe('Newbie');
  });

  it('enforces store boundary: same telegram user in Store A and Store B has distinct customer profiles', async () => {
    const { customerIdentityManager, storeIdA, storeIdB } = harness;

    const resA = await customerIdentityManager.resolveCustomer(storeIdA, 'tg_user_alice');
    const resB = await customerIdentityManager.resolveCustomer(storeIdB, 'tg_user_alice');

    expect(resA.customer.storeId).toBe(storeIdA);
    expect(resB.customer.storeId).toBe(storeIdB);
    expect(resA.customer.id).not.toBe(resB.customer.id);
  });
});

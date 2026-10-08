/**
 * Bintang Tech Studio — Seller Dashboard Payments & Channels Test Suite.
 * Baseline: Milestone M12 Seller Dashboard Foundation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSellerDashboardTestHarness, SellerDashboardTestHarness } from './test-helpers.js';
import { ChannelFeatureDisabledError } from '../src/errors.js';
import { PermissionDeniedError } from '@bintang/authorization';

describe('Seller Dashboard — Payments & Channels Section', () => {
  let harness: SellerDashboardTestHarness;

  beforeEach(async () => {
    harness = await createSellerDashboardTestHarness();
  });

  describe('Payments Section & Secret Shielding', () => {
    it('lists payment accounts for active store and strictly shields secret keys', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const accounts = await harness.dashboardService.listPaymentAccounts(session.sessionToken);

      expect(accounts.length).toBe(1);
      const acc = accounts[0]!;
      expect(acc.id).toBe(harness.paymentAccountA.id);
      expect(acc.provider).toBe('MANUAL_TRANSFER');
      expect(acc.accountIdentifier).toBe('Bank Mandiri Store Alpha');
      expect(acc.isActive).toBe(true);

      // CRITICAL SECURITY INVARIANT: Zero payment secrets leaked in view
      const serialized = JSON.stringify(acc);
      expect(serialized).not.toContain('super_secret_pay_key_99999');
      expect(serialized).not.toContain('whsec_alpha_private_xyz');
      expect(serialized).not.toContain('credentialsPayload');
      expect(serialized).not.toContain('secretApiKey');
    });

    it('configures new payment account without leaking credentials', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const configured = await harness.dashboardService.configurePaymentAccount(
        session.sessionToken,
        {
          provider: 'QRIS',
          accountIdentifier: 'QRIS Dinamis Alpha',
          configData: {
            mid: 'MID-ALPHA-999',
            apiKey: 'secret_live_key_xyz',
          },
        },
      );

      expect(configured.id).toBeDefined();
      expect(configured.provider).toBe('QRIS');
      expect(configured.accountIdentifier).toBe('QRIS Dinamis Alpha');

      // CRITICAL SECURITY INVARIANT:
      const serialized = JSON.stringify(configured);
      expect(serialized).not.toContain('secret_live_key_xyz');
    });

    it('allows STORE_ADMIN to manage payments but denies STORE_STAFF completely', async () => {
      const sessionAdmin = await harness.loginAs(harness.userBob, harness.storeA.id);
      const accounts = await harness.dashboardService.listPaymentAccounts(
        sessionAdmin.sessionToken,
      );
      expect(accounts.length).toBe(1);

      const sessionStaff = await harness.loginAs(harness.userDan, harness.storeA.id);

      // Staff CANNOT read payments (RBAC payments.read denied)
      await expect(
        harness.dashboardService.listPaymentAccounts(sessionStaff.sessionToken),
      ).rejects.toThrow(PermissionDeniedError);

      // Staff CANNOT configure account
      await expect(
        harness.dashboardService.configurePaymentAccount(sessionStaff.sessionToken, {
          provider: 'QRIS',
          accountIdentifier: 'Staff Illegal QRIS',
        }),
      ).rejects.toThrow(PermissionDeniedError);
    });
  });

  describe('Channels & Telegram Bot Binding', () => {
    it('lists channels connected to active store', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const channels = await harness.dashboardService.listChannels(session.sessionToken);

      expect(channels.length).toBe(1);
      const ch = channels[0]!;
      expect(ch.channelType).toBe('TELEGRAM');
      expect(ch.botUsername).toBe('BintangAlphaStoreBot');
      expect(ch.isActive).toBe(true);
    });

    it('retrieves Telegram bot binding and shields bot token and webhook secret', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      const botBinding = await harness.dashboardService.getTelegramBotBinding(session.sessionToken);

      expect(botBinding).toBeDefined();
      expect(botBinding?.botUsername).toBe('BintangAlphaStoreBot');
      expect(botBinding?.botId).toBe('bot_alpha_123');
      expect(botBinding?.isActive).toBe(true);
      expect(botBinding?.miniAppUrl).toBe('https://alpha.store.bintang.tech');

      // CRITICAL SECURITY INVARIANT: Zero bot token or webhook secret leakage
      const serialized = JSON.stringify(botBinding);
      expect(serialized).not.toContain('NEVER_LEAK_THIS_TOKEN');
      expect(serialized).not.toContain('whsec_telegram_internal_hash_xyz');
      expect(serialized).not.toContain('botToken');
      expect(serialized).not.toContain('webhookSecret');
    });

    it('rejects Telegram channel access when plan does not have telegram entitlement', async () => {
      // Store D has channels.telegram: false
      const session = await harness.loginAs(harness.userAlice, harness.storeD.id);

      await expect(
        harness.dashboardService.getTelegramBotBinding(session.sessionToken),
      ).rejects.toThrow(ChannelFeatureDisabledError);
    });

    it('allows STORE_ADMIN to view channels but denies STORE_STAFF (channels.read)', async () => {
      const sessionAdmin = await harness.loginAs(harness.userBob, harness.storeA.id);
      const channels = await harness.dashboardService.listChannels(sessionAdmin.sessionToken);
      expect(channels.length).toBe(1);

      const sessionStaff = await harness.loginAs(harness.userDan, harness.storeA.id);

      // Staff CANNOT list channels
      await expect(
        harness.dashboardService.listChannels(sessionStaff.sessionToken),
      ).rejects.toThrow(PermissionDeniedError);

      // Staff CANNOT get bot binding
      await expect(
        harness.dashboardService.getTelegramBotBinding(sessionStaff.sessionToken),
      ).rejects.toThrow(PermissionDeniedError);
    });
  });
});

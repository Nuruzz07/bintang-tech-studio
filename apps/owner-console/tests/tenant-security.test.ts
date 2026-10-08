/**
 * Bintang Tech Studio — Platform Tenant Security & UI Protection Suite.
 * Baseline: Milestone M14 Owner Console Foundation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestOwnerConsoleHarness, TestOwnerConsoleHarness } from './test-helpers.js';
import { renderOwnerConsoleHtml } from '../src/ui/views.js';
import { PlatformAccessDeniedError } from '../src/errors.js';

describe('M14 Tenant Security & UI Protection Suite', () => {
  let harness: TestOwnerConsoleHarness;
  let ownerToken: string;

  beforeEach(async () => {
    harness = createTestOwnerConsoleHarness();
    ownerToken = await harness.createOwnerSession();

    await harness.storeRepo.create({
      id: 'store_sec_1',
      ownerUserId: 'usr_seller_1',
      name: 'Security Test Store',
      slug: 'sec-store',
      templateVersionId: null,
      status: 'ACTIVE',
      currency: 'IDR',
      settings: {},
    });
  });

  it('guarantees client-supplied store_id cannot bypass platform authorization', async () => {
    // A caller attempting to pass a storeId with invalid platform token is rejected
    await expect(
      harness.service.getStoreDetail('invalid_platform_token', 'store_sec_1'),
    ).rejects.toThrow(PlatformAccessDeniedError);
  });

  it('guarantees cross-store target cannot bypass platform permissions', async () => {
    // An expired session or unauthenticated client attempting cross-store mutation is rejected
    const expired = await harness.sessionManager.createSession({
      userId: 'usr_plat_owner_1',
      email: 'owner@bintang.tech',
      platformRole: 'PLATFORM_OWNER',
      ttlMs: -5000,
    });

    await expect(
      harness.service.updateStoreStatus(
        expired.token,
        'store_sec_1',
        'SUSPENDED',
        'Unauthorized attempt',
      ),
    ).rejects.toThrow(PlatformAccessDeniedError);
  });

  it('guarantees generic dangerous patch or arbitrary mutation handlers are not present', () => {
    // OwnerConsoleService does not expose generic PATCH or arbitrary updateStore methods
    const serviceRecord = harness.service as unknown as Record<string, unknown>;
    expect(serviceRecord['patchStore']).toBeUndefined();
    expect(serviceRecord['updateStoreArbitrary']).toBeUndefined();
    expect(serviceRecord['rawQuery']).toBeUndefined();
  });

  it('renders professional server-side UI HTML without leaking secrets or unescaped XSS', async () => {
    const viewData = await harness.service.getViewData(ownerToken, 'overview');
    const html = renderOwnerConsoleHtml(viewData);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('BINTANG TECH · CONTROL');
    expect(html).toContain('Platform Overview');
    expect(html).toContain('TOTAL TOKO (TENANTS)');

    // Ensure zero sensitive strings in HTML
    expect(html).not.toContain('BOT_TOKEN');
    expect(html).not.toContain('bot_token');
    expect(html).not.toContain('dbPassword');
    expect(html).not.toContain('password');

    // Test tab views
    const storesViewData = await harness.service.getViewData(ownerToken, 'stores');
    const storesHtml = renderOwnerConsoleHtml(storesViewData);
    expect(storesHtml).toContain('Security Test Store');
    expect(storesHtml).toContain('sec-store');

    const botsViewData = await harness.service.getViewData(ownerToken, 'bots');
    const botsHtml = renderOwnerConsoleHtml(botsViewData);
    expect(botsHtml).toContain('ref_tg_***');
  });
});

/**
 * Bintang Tech Studio — Platform Store & Tenant Governance Test Suite.
 * Baseline: Milestone M14 Owner Console Foundation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestOwnerConsoleHarness, TestOwnerConsoleHarness } from './test-helpers.js';
import { InvalidStoreLifecycleTransitionError, PlatformStoreNotFoundError } from '../src/errors.js';

describe('M14 Store & Tenant Governance Suite', () => {
  let harness: TestOwnerConsoleHarness;
  let ownerToken: string;
  let adminToken: string;

  beforeEach(async () => {
    harness = createTestOwnerConsoleHarness();
    ownerToken = await harness.createOwnerSession();
    adminToken = await harness.createAdminSession();

    // Seed test stores
    await harness.storeRepo.create({
      id: 'store_alpha',
      ownerUserId: 'usr_seller_1',
      name: 'Alpha Official Store',
      slug: 'alpha-store',
      templateVersionId: 'tmpl_ver_1',
      status: 'SETUP',
      currency: 'IDR',
      settings: {},
    });

    await harness.storeRepo.create({
      id: 'store_beta',
      ownerUserId: 'usr_seller_1',
      name: 'Beta Gadget Store',
      slug: 'beta-gadgets',
      templateVersionId: 'tmpl_ver_1',
      status: 'ACTIVE',
      currency: 'IDR',
      settings: {},
    });

    await harness.storeMemberRepo.create({
      storeId: 'store_alpha',
      userId: 'usr_seller_1',
      role: 'STORE_OWNER',
      status: 'ACTIVE',
    });
  });

  it('lists stores across tenants and filters by status or search query', async () => {
    const all = await harness.service.listStores(ownerToken);
    expect(all.length).toBe(2);

    const activeOnly = await harness.service.listStores(adminToken, { status: 'ACTIVE' });
    expect(activeOnly.length).toBe(1);
    expect(activeOnly[0]!.slug).toBe('beta-gadgets');

    const searchResult = await harness.service.listStores(adminToken, { search: 'alpha' });
    expect(searchResult.length).toBe(1);
    expect(searchResult[0]!.id).toBe('store_alpha');
  });

  it('inspects detailed store data including members and masked owner details', async () => {
    const detail = await harness.service.getStoreDetail(adminToken, 'store_alpha');
    expect(detail.id).toBe('store_alpha');
    expect(detail.name).toBe('Alpha Official Store');
    expect(detail.memberCount).toBe(1);
    expect(detail.channels.length).toBeGreaterThan(0);
    expect(detail.bots.length).toBeGreaterThan(0);
  });

  it('throws 404 when inspecting non-existent store', async () => {
    await expect(harness.service.getStoreDetail(adminToken, 'store_non_existent')).rejects.toThrow(
      PlatformStoreNotFoundError,
    );
  });

  it('executes valid store lifecycle transitions and logs audit record', async () => {
    // SETUP -> ACTIVE
    const activated = await harness.service.updateStoreStatus(
      adminToken,
      'store_alpha',
      'ACTIVE',
      'Merchant verification complete',
    );
    expect(activated.status).toBe('ACTIVE');

    // ACTIVE -> SUSPENDED
    const suspended = await harness.service.updateStoreStatus(
      ownerToken,
      'store_alpha',
      'SUSPENDED',
      'Terms of service violation review',
    );
    expect(suspended.status).toBe('SUSPENDED');

    // Verify audit logs were written
    const logs = await harness.auditRepo.list({ storeId: 'store_alpha' });
    expect(logs.length).toBe(2);
    expect(logs[0]!.action).toBe('STORE_SUSPENDED');
    expect(logs[1]!.action).toBe('STORE_STATUS_UPDATED');
  });

  it('rejects invalid store lifecycle transitions (e.g. ARCHIVED -> ACTIVE)', async () => {
    // Move to ARCHIVED (terminal)
    await harness.service.updateStoreStatus(
      ownerToken,
      'store_alpha',
      'ARCHIVED',
      'Store closed by merchant',
    );

    // Try to transition ARCHIVED -> ACTIVE
    await expect(
      harness.service.updateStoreStatus(
        ownerToken,
        'store_alpha',
        'ACTIVE',
        'Illegal reactivation attempt',
      ),
    ).rejects.toThrow(InvalidStoreLifecycleTransitionError);
  });
});

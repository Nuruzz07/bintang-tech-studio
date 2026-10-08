/**
 * Bintang Tech Studio — Platform Owner Console Authorization & Privilege Separation Suite.
 * Baseline: Milestone M14 Owner Console Foundation.
 */

import { describe, it, expect } from 'vitest';
import { createTestOwnerConsoleHarness } from './test-helpers.js';
import { PlatformAccessDeniedError } from '../src/errors.js';
import { PermissionDeniedError } from '@bintang/authorization';

describe('M14 Owner Console Authorization & Role Separation', () => {
  it('REJECTS regular USER from authenticating into Owner Console', async () => {
    const harness = createTestOwnerConsoleHarness();

    await expect(
      harness.sessionManager.createSession({
        userId: 'usr_regular_1',
        email: 'user@example.com',
        platformRole: 'USER',
      }),
    ).rejects.toThrow(PlatformAccessDeniedError);
  });

  it('REJECTS STORE_OWNER without platform role from accessing Owner Console', async () => {
    const harness = createTestOwnerConsoleHarness();

    await expect(
      harness.sessionManager.createSession({
        userId: 'usr_merchant_owner',
        email: 'merchant@store.id',
        // @ts-expect-error Store role is not a platform role
        platformRole: 'STORE_OWNER',
      }),
    ).rejects.toThrow(PlatformAccessDeniedError);
  });

  it('REJECTS STORE_ADMIN without platform role from accessing Owner Console', async () => {
    const harness = createTestOwnerConsoleHarness();

    await expect(
      harness.sessionManager.createSession({
        userId: 'usr_merchant_admin',
        email: 'admin@store.id',
        // @ts-expect-error Store role is not a platform role
        platformRole: 'STORE_ADMIN',
      }),
    ).rejects.toThrow(PlatformAccessDeniedError);
  });

  it('REJECTS STORE_STAFF without platform role from accessing Owner Console', async () => {
    const harness = createTestOwnerConsoleHarness();

    await expect(
      harness.sessionManager.createSession({
        userId: 'usr_merchant_staff',
        email: 'staff@store.id',
        // @ts-expect-error Store role is not a platform role
        platformRole: 'STORE_STAFF',
      }),
    ).rejects.toThrow(PlatformAccessDeniedError);
  });

  it('REJECTS invalid or expired session tokens', async () => {
    const harness = createTestOwnerConsoleHarness();

    await expect(harness.service.getOverview('invalid_token')).rejects.toThrow(
      PlatformAccessDeniedError,
    );
    await expect(harness.service.getOverview('pos_non_existent')).rejects.toThrow(
      PlatformAccessDeniedError,
    );

    // Create expired session
    const expired = await harness.sessionManager.createSession({
      userId: 'usr_plat_owner_1',
      email: 'owner@bintang.tech',
      platformRole: 'PLATFORM_OWNER',
      ttlMs: -1000, // expired 1s ago
    });

    await expect(harness.service.getOverview(expired.token)).rejects.toThrow(
      PlatformAccessDeniedError,
    );
  });

  it('AUTHORIZES PLATFORM_ADMIN for operational read and manage endpoints', async () => {
    const harness = createTestOwnerConsoleHarness();
    const adminToken = await harness.createAdminSession();

    // Can read overview
    const overview = await harness.service.getOverview(adminToken);
    expect(overview).toBeDefined();

    // Can list stores
    const stores = await harness.service.listStores(adminToken);
    expect(Array.isArray(stores)).toBe(true);

    // Can list users
    const users = await harness.service.listUsers(adminToken);
    expect(Array.isArray(users)).toBe(true);
  });

  it('STRICTLY DENIES PLATFORM_ADMIN from performing PLATFORM_OWNER sensitive operations', async () => {
    const harness = createTestOwnerConsoleHarness();
    const adminToken = await harness.createAdminSession();

    // Attempting to mutate platform user roles requires platform.system.manage (Owner only)
    await expect(
      harness.service.updateUserPlatformRole(adminToken, {
        targetUserId: 'usr_seller_1',
        newPlatformRole: 'PLATFORM_ADMIN',
        reason: 'Unauthorized escalation attempt',
      }),
    ).rejects.toThrow(PermissionDeniedError);

    // Attempting to update platform policies requires platform.system.manage
    await expect(
      harness.service.updatePolicy(adminToken, {
        key: 'platform.maintenance_mode',
        value: true,
        reason: 'Unauthorized toggle',
      }),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('AUTHORIZES PLATFORM_OWNER for root management and system policy operations', async () => {
    const harness = createTestOwnerConsoleHarness();
    const ownerToken = await harness.createOwnerSession();

    // Owner can view overview
    const overview = await harness.service.getOverview(ownerToken);
    expect(overview.systemHealthStatus).toBe('HEALTHY');

    // Owner can update policies
    const updatedPolicy = await harness.service.updatePolicy(ownerToken, {
      key: 'platform.maintenance_mode',
      value: true,
      reason: 'Scheduled platform maintenance',
    });
    expect(updatedPolicy.value).toBe(true);
  });
});

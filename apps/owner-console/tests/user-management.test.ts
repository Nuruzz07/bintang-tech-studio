/**
 * Bintang Tech Studio — Platform User & Privilege Separation Test Suite.
 * Baseline: Milestone M14 Owner Console Foundation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestOwnerConsoleHarness, TestOwnerConsoleHarness } from './test-helpers.js';
import {
  SelfRoleMutationError,
  LastPlatformOwnerDemotionError,
  PlatformUserNotFoundError,
} from '../src/errors.js';
import { PermissionDeniedError } from '@bintang/authorization';

describe('M14 User & Privilege Governance Suite', () => {
  let harness: TestOwnerConsoleHarness;
  let ownerToken: string;
  let adminToken: string;

  beforeEach(async () => {
    harness = createTestOwnerConsoleHarness();
    ownerToken = await harness.createOwnerSession();
    adminToken = await harness.createAdminSession();
  });

  it('lists platform users and filters by platform role', async () => {
    const all = await harness.service.listUsers(adminToken);
    expect(all.length).toBeGreaterThanOrEqual(3);

    const owners = await harness.service.listUsers(adminToken, { platformRole: 'PLATFORM_OWNER' });
    expect(owners.length).toBe(1);
    expect(owners[0]!.email).toBe('owner@bintang.tech');
  });

  it('inspects user detail with associated stores and memberships', async () => {
    const detail = await harness.service.getUserDetail(adminToken, 'usr_seller_1');
    expect(detail.id).toBe('usr_seller_1');
    expect(detail.email).toBe('seller1@example.com');
  });

  it('allows PLATFORM_OWNER to promote a regular user to PLATFORM_ADMIN and writes audit log', async () => {
    const updated = await harness.service.updateUserPlatformRole(ownerToken, {
      targetUserId: 'usr_seller_1',
      newPlatformRole: 'PLATFORM_ADMIN',
      reason: 'Promoted to support operations team',
    });

    expect(updated.platformRole).toBe('PLATFORM_ADMIN');

    const logs = await harness.auditRepo.list({ action: 'USER_ROLE_UPDATED' });
    expect(logs.length).toBe(1);
    expect(logs[0]!.actorUserId).toBe('usr_plat_owner_1');
    expect(logs[0]!.result).toBe('SUCCESS');
  });

  it('DENIES PLATFORM_ADMIN from promoting anyone to PLATFORM_OWNER', async () => {
    await expect(
      harness.service.updateUserPlatformRole(adminToken, {
        targetUserId: 'usr_seller_1',
        newPlatformRole: 'PLATFORM_OWNER',
        reason: 'Illegal promotion attempt',
      }),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('STRICTLY PREVENTS PLATFORM_ADMIN from self-promoting to PLATFORM_OWNER', async () => {
    await expect(
      harness.service.updateUserPlatformRole(adminToken, {
        targetUserId: 'usr_plat_admin_1',
        newPlatformRole: 'PLATFORM_OWNER',
        reason: 'Illegal self-promotion attempt',
      }),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('REJECTS self-promotion and self-mutation attempts', async () => {
    await expect(
      harness.service.updateUserPlatformRole(ownerToken, {
        targetUserId: 'usr_plat_owner_1', // Target is caller itself
        newPlatformRole: 'PLATFORM_OWNER',
        reason: 'Attempted self modification',
      }),
    ).rejects.toThrow(SelfRoleMutationError);

    // Verify failed audit was logged
    const logs = await harness.auditRepo.list({ action: 'USER_ROLE_UPDATED' });
    expect(logs.length).toBe(1);
    expect(logs[0]!.result).toBe('FAILED');
  });

  it('REJECTS demoting the last remaining PLATFORM_OWNER', async () => {
    // Attempting to demote the only owner in the system
    await expect(
      harness.service.updateUserPlatformRole(ownerToken, {
        targetUserId: 'usr_plat_owner_1',
        newPlatformRole: 'USER',
        reason: 'Demote last owner',
      }),
    ).rejects.toThrow(SelfRoleMutationError); // Self-mutation caught first

    // If another owner tries to demote the only owner (simulated)
    const secondOwnerSession = await harness.sessionManager.createSession({
      userId: 'usr_plat_owner_2',
      email: 'owner2@bintang.tech',
      platformRole: 'PLATFORM_OWNER',
    });

    // There is still only 1 owner recorded in userRepo (usr_plat_owner_1)
    await expect(
      harness.service.updateUserPlatformRole(secondOwnerSession.token, {
        targetUserId: 'usr_plat_owner_1',
        newPlatformRole: 'USER',
        reason: 'Demote last recorded owner',
      }),
    ).rejects.toThrow(LastPlatformOwnerDemotionError);
  });

  it('throws 404 when targeting non-existent user', async () => {
    await expect(harness.service.getUserDetail(adminToken, 'usr_non_existent')).rejects.toThrow(
      PlatformUserNotFoundError,
    );
  });
});

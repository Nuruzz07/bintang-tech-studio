/**
 * Bintang Tech Studio — Platform Policies & Settings Test Suite.
 * Baseline: Milestone M14 Owner Console Foundation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestOwnerConsoleHarness, TestOwnerConsoleHarness } from './test-helpers.js';
import { PlatformPolicyNotFoundError } from '../src/errors.js';
import { PermissionDeniedError } from '@bintang/authorization';

describe('M14 Platform Policies & Governance Suite', () => {
  let harness: TestOwnerConsoleHarness;
  let ownerToken: string;
  let adminToken: string;

  beforeEach(async () => {
    harness = createTestOwnerConsoleHarness();
    ownerToken = await harness.createOwnerSession();
    adminToken = await harness.createAdminSession();
  });

  it('lists existing platform policies', async () => {
    const policies = await harness.service.listPolicies(adminToken);
    expect(policies.length).toBeGreaterThanOrEqual(3);

    const maint = policies.find((p) => p.key === 'platform.maintenance_mode');
    expect(maint).toBeDefined();
    expect(maint!.isOwnerOnly).toBe(true);
  });

  it('allows PLATFORM_OWNER to update sensitive maintenance mode policy', async () => {
    const updated = await harness.service.updatePolicy(ownerToken, {
      key: 'platform.maintenance_mode',
      value: true,
      reason: 'Scheduled infrastructure update',
    });

    expect(updated.value).toBe(true);

    const logs = await harness.auditRepo.list({ action: 'PLATFORM_POLICY_UPDATED' });
    expect(logs.length).toBe(1);
    expect(logs[0]!.result).toBe('SUCCESS');
  });

  it('DENIES PLATFORM_ADMIN from updating sensitive owner-only policies', async () => {
    // Requires platform.system.manage which PLATFORM_ADMIN does not possess
    await expect(
      harness.service.updatePolicy(adminToken, {
        key: 'platform.maintenance_mode',
        value: true,
        reason: 'Unauthorized toggle',
      }),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('throws 404 when updating non-existent policy key', async () => {
    await expect(
      harness.service.updatePolicy(ownerToken, {
        key: 'platform.fake_non_existent',
        value: 'any',
        reason: 'Testing 404',
      }),
    ).rejects.toThrow(PlatformPolicyNotFoundError);
  });
});

/**
 * Bintang Tech Studio — Platform Audit Logging & System Health Test Suite.
 * Baseline: Milestone M14 Owner Console Foundation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestOwnerConsoleHarness, TestOwnerConsoleHarness } from './test-helpers.js';

describe('M14 Audit Logging & System Health Suite', () => {
  let harness: TestOwnerConsoleHarness;
  let ownerToken: string;
  let adminToken: string;

  beforeEach(async () => {
    harness = createTestOwnerConsoleHarness();
    ownerToken = await harness.createOwnerSession();
    adminToken = await harness.createAdminSession();
  });

  it('records append-only audit logs for privileged operations and filters them', async () => {
    // Perform audit-logged action
    await harness.service.updatePolicy(ownerToken, {
      key: 'platform.onboarding_enabled',
      value: false,
      reason: 'Temporary pause during maintenance',
    });

    const logs = await harness.service.listAuditLogs(adminToken, {
      action: 'PLATFORM_POLICY_UPDATED',
    });
    expect(logs.length).toBe(1);
    expect(logs[0]!.actorEmail).toBe('owner@bintang.tech');
    expect(logs[0]!.resourceType).toBe('platform_policy');
    expect(logs[0]!.result).toBe('SUCCESS');
  });

  it('SCRUBS sensitive keys (passwords, tokens, secrets) before writing to audit logs', async () => {
    const caller = await harness.sessionManager.resolveCaller(ownerToken);

    // Explicitly attempt to log an action with sensitive payload
    await harness.auditService.logAction({
      caller,
      action: 'SUSPICIOUS_PAYLOAD_TEST',
      resourceType: 'system',
      resourceId: 'test_1',
      details: {
        normalField: 'acceptable_data',
        api_token: 'secret_live_bearer_token_12345',
        dbPassword: 'super_secret_db_pass',
        webhook_secret: 'whsec_998877',
      },
      result: 'SUCCESS',
    });

    const logs = await harness.auditRepo.list({ action: 'SUSPICIOUS_PAYLOAD_TEST' });
    expect(logs.length).toBe(1);

    const details = logs[0]!.details;
    expect(details['normalField']).toBe('acceptable_data');
    expect(details['api_token']).toBe('[REDACTED_SECRET]');
    expect(details['dbPassword']).toBe('[REDACTED_SECRET]');
    expect(details['webhook_secret']).toBe('[REDACTED_SECRET]');

    // Raw secrets must not exist anywhere in stringified log
    const raw = JSON.stringify(logs[0]);
    expect(raw).not.toContain('secret_live_bearer_token_12345');
    expect(raw).not.toContain('super_secret_db_pass');
    expect(raw).not.toContain('whsec_998877');
  });

  it('provides system health telemetry labeled explicitly as foundation abstraction', async () => {
    const health = await harness.service.getSystemHealth(adminToken);
    expect(health.overallStatus).toBe('HEALTHY');
    expect(health.classification).toBe('FOUNDATION_ABSTRACTION');
    expect(health.components.length).toBeGreaterThanOrEqual(5);

    const dbComponent = health.components.find((c) => c.name.includes('PostgreSQL'));
    expect(dbComponent).toBeDefined();
    expect(dbComponent!.isSimulation).toBe(true);
  });
});

/**
 * Bintang Tech Studio — Platform Policies & Settings Service.
 * Baseline: Milestone M14 Owner Console Foundation.
 *
 * Implements platform-level governance settings (maintenance mode, onboarding availability).
 * Requires PLATFORM_OWNER role for sensitive platform toggles and logs all mutations.
 */

import { PlatformPolicy, UpdatePlatformPolicyInput, PlatformCaller } from '../types.js';
import { PlatformSettingsRepository } from './interfaces.js';
import { PlatformAuditService } from './audit-service.js';
import { PlatformPolicyNotFoundError, PlatformOwnerPrivilegeRequiredError } from '../errors.js';

export interface PlatformSettingsServiceDeps {
  readonly settingsRepository: PlatformSettingsRepository;
  readonly auditService: PlatformAuditService;
}

export class PlatformSettingsService {
  constructor(private readonly deps: PlatformSettingsServiceDeps) {}

  public async listPolicies(): Promise<readonly PlatformPolicy[]> {
    return this.deps.settingsRepository.listPolicies();
  }

  public async getPolicy(key: string): Promise<PlatformPolicy | null> {
    return this.deps.settingsRepository.getPolicyByKey(key);
  }

  public async updatePolicy(
    caller: PlatformCaller,
    input: UpdatePlatformPolicyInput,
  ): Promise<PlatformPolicy> {
    const policy = await this.deps.settingsRepository.getPolicyByKey(input.key);
    if (!policy) {
      throw new PlatformPolicyNotFoundError(input.key);
    }

    // Owner-only check for sensitive policies
    if (policy.isOwnerOnly && caller.platformRole !== 'PLATFORM_OWNER') {
      const err = new PlatformOwnerPrivilegeRequiredError(`Pengaturan kebijakan "${input.key}"`);
      await this.deps.auditService.logAction({
        caller,
        action: 'PLATFORM_POLICY_UPDATED',
        resourceType: 'platform_policy',
        resourceId: input.key,
        details: { targetKey: input.key, reason: input.reason },
        result: 'FAILED',
        errorMessage: err.message,
      });
      throw err;
    }

    const previousValue = policy.value;
    const updated = await this.deps.settingsRepository.setPolicy(
      input.key,
      input.value,
      caller.userId,
    );

    await this.deps.auditService.logAction({
      caller,
      action: 'PLATFORM_POLICY_UPDATED',
      resourceType: 'platform_policy',
      resourceId: input.key,
      details: {
        key: input.key,
        previousValue,
        newValue: input.value,
        reason: input.reason,
      },
      result: 'SUCCESS',
    });

    return updated;
  }
}

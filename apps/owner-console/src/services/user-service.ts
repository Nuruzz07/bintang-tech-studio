/**
 * Bintang Tech Studio — Platform User & Privilege Management Service.
 * Baseline: Milestone M14 Owner Console Foundation.
 *
 * Implements platform user inspection and strict role guardrails:
 * - PLATFORM_ADMIN cannot promote any user to PLATFORM_OWNER.
 * - Self-promotion / self-mutation is strictly rejected.
 * - Demoting the last remaining PLATFORM_OWNER is blocked.
 * - All mutations produce detailed append-only audit records.
 */

import {
  PlatformUserSummary,
  PlatformUserDetail,
  UserListFilter,
  PlatformCaller,
  UpdateUserPlatformRoleInput,
  StoreLifecycleStatus,
} from '../types.js';
import { PlatformUserRepository, PlatformStoreRepository } from './interfaces.js';
import { PlatformAuditService } from './audit-service.js';
import { StoreRole, StoreMemberRepository } from '@bintang/tenancy';
import {
  PlatformUserNotFoundError,
  PlatformOwnerPrivilegeRequiredError,
  SelfRoleMutationError,
  LastPlatformOwnerDemotionError,
} from '../errors.js';

export interface PlatformUserServiceDeps {
  readonly userRepository: PlatformUserRepository;
  readonly storeRepository?: PlatformStoreRepository | undefined;
  readonly storeMemberRepository?: StoreMemberRepository | undefined;
  readonly auditService: PlatformAuditService;
}

export class PlatformUserService {
  constructor(private readonly deps: PlatformUserServiceDeps) {}

  public async listUsers(filter?: UserListFilter): Promise<readonly PlatformUserSummary[]> {
    return this.deps.userRepository.list(filter);
  }

  public async getUserDetail(userId: string): Promise<PlatformUserDetail> {
    const user = await this.deps.userRepository.findById(userId);
    if (!user) {
      throw new PlatformUserNotFoundError(userId);
    }

    let storesOwned: Array<{
      storeId: string;
      storeName: string;
      storeSlug: string;
      status: StoreLifecycleStatus;
    }> = [];
    const memberships: Array<{
      storeId: string;
      storeName: string;
      role: StoreRole;
      status: string;
    }> = [];

    if (this.deps.storeRepository) {
      const allStores = await this.deps.storeRepository.list();
      storesOwned = allStores
        .filter((s) => s.ownerUserId === userId)
        .map((s) => ({
          storeId: s.id,
          storeName: s.name,
          storeSlug: s.slug,
          status: s.status,
        }));
    }

    if (this.deps.storeMemberRepository && this.deps.storeRepository) {
      const allStores = await this.deps.storeRepository.list();
      for (const s of allStores) {
        const members = await this.deps.storeMemberRepository.findByStoreId(s.id);
        const mem = members.find((m) => m.userId === userId);
        if (mem) {
          memberships.push({
            storeId: s.id,
            storeName: s.name,
            role: mem.role,
            status: mem.status,
          });
        }
      }
    }

    return {
      ...user,
      storesOwned,
      memberships,
    };
  }

  /**
   * Promotes or demotes platform role with ironclad security guardrails.
   */
  public async updateUserPlatformRole(
    caller: PlatformCaller,
    input: UpdateUserPlatformRoleInput,
  ): Promise<PlatformUserSummary> {
    // GUARDRAIL 1: Only PLATFORM_OWNER can alter platform roles
    if (caller.platformRole !== 'PLATFORM_OWNER') {
      const err = new PlatformOwnerPrivilegeRequiredError('Pengubahan peran platform');
      await this.deps.auditService.logAction({
        caller,
        action: 'USER_ROLE_UPDATED',
        resourceType: 'user',
        resourceId: input.targetUserId,
        details: { targetRole: input.newPlatformRole, reason: input.reason },
        result: 'FAILED',
        errorMessage: err.message,
      });
      throw err;
    }

    // GUARDRAIL 2: Self-mutation / self-promotion is strictly rejected
    if (caller.userId === input.targetUserId) {
      const err = new SelfRoleMutationError();
      await this.deps.auditService.logAction({
        caller,
        action: 'USER_ROLE_UPDATED',
        resourceType: 'user',
        resourceId: input.targetUserId,
        details: { targetRole: input.newPlatformRole, reason: input.reason },
        result: 'FAILED',
        errorMessage: err.message,
      });
      throw err;
    }

    const targetUser = await this.deps.userRepository.findById(input.targetUserId);
    if (!targetUser) {
      const err = new PlatformUserNotFoundError(input.targetUserId);
      await this.deps.auditService.logAction({
        caller,
        action: 'USER_ROLE_UPDATED',
        resourceType: 'user',
        resourceId: input.targetUserId,
        details: { targetRole: input.newPlatformRole, reason: input.reason },
        result: 'FAILED',
        errorMessage: err.message,
      });
      throw err;
    }

    // GUARDRAIL 3: Demoting the last PLATFORM_OWNER is blocked
    if (
      targetUser.platformRole === 'PLATFORM_OWNER' &&
      input.newPlatformRole !== 'PLATFORM_OWNER'
    ) {
      const ownerCount = await this.deps.userRepository.countByRole('PLATFORM_OWNER');
      if (ownerCount <= 1) {
        const err = new LastPlatformOwnerDemotionError();
        await this.deps.auditService.logAction({
          caller,
          action: 'USER_ROLE_UPDATED',
          resourceType: 'user',
          resourceId: input.targetUserId,
          details: {
            previousRole: targetUser.platformRole,
            targetRole: input.newPlatformRole,
            reason: input.reason,
          },
          result: 'FAILED',
          errorMessage: err.message,
        });
        throw err;
      }
    }

    const updated = await this.deps.userRepository.updatePlatformRole(
      input.targetUserId,
      input.newPlatformRole,
    );

    await this.deps.auditService.logAction({
      caller,
      action: 'USER_ROLE_UPDATED',
      resourceType: 'user',
      resourceId: input.targetUserId,
      details: {
        previousRole: targetUser.platformRole,
        newRole: input.newPlatformRole,
        reason: input.reason,
      },
      result: 'SUCCESS',
    });

    return updated;
  }
}

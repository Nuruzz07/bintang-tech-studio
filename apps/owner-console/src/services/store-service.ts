/**
 * Bintang Tech Studio — Platform Store & Tenant Management Service.
 * Baseline: Milestone M14 Owner Console Foundation.
 *
 * Implements platform-level store inspection and controlled lifecycle transitions.
 * Prohibits generic arbitrary table mutations; requires explicit domain operations with auditing.
 */

import {
  PlatformStoreSummary,
  PlatformStoreDetail,
  StoreListFilter,
  StoreLifecycleStatus,
  PlatformCaller,
} from '../types.js';
import { StoreMemberRepository } from '@bintang/tenancy';
import { SubscriptionRepository } from '@bintang/billing';
import { PlatformStoreRepository, PlatformUserRepository } from './interfaces.js';
import { PlatformAuditService } from './audit-service.js';
import { PlatformStoreNotFoundError, InvalidStoreLifecycleTransitionError } from '../errors.js';

export interface PlatformStoreServiceDeps {
  readonly storeRepository: PlatformStoreRepository;
  readonly storeMemberRepository: StoreMemberRepository;
  readonly userRepository?: PlatformUserRepository | undefined;
  readonly subscriptionRepository?: SubscriptionRepository | undefined;
  readonly auditService: PlatformAuditService;
}

const VALID_LIFECYCLE_TRANSITIONS: Record<
  StoreLifecycleStatus,
  ReadonlySet<StoreLifecycleStatus>
> = {
  SETUP: new Set(['ACTIVE', 'SUSPENDED', 'ARCHIVED']),
  ACTIVE: new Set(['SUSPENDED', 'ARCHIVED']),
  SUSPENDED: new Set(['ACTIVE', 'ARCHIVED']),
  ARCHIVED: new Set([]), // Terminal state
};

export class PlatformStoreService {
  constructor(private readonly deps: PlatformStoreServiceDeps) {}

  /**
   * Lists stores across the platform with filtering and search.
   */
  public async listStores(filter?: StoreListFilter): Promise<readonly PlatformStoreSummary[]> {
    const all = await this.deps.storeRepository.list();
    let result: PlatformStoreSummary[] = [];

    for (const s of all) {
      if (filter?.status && s.status !== filter.status) {
        continue;
      }
      if (filter?.search) {
        const q = filter.search.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.slug.toLowerCase().includes(q)) {
          continue;
        }
      }

      const members = await this.deps.storeMemberRepository.findByStoreId(s.id);
      const sub = this.deps.subscriptionRepository
        ? await this.deps.subscriptionRepository.findByStoreId(s.id)
        : null;

      result.push({
        id: s.id,
        name: s.name,
        slug: s.slug,
        status: s.status as StoreLifecycleStatus,
        ownerUserId: s.ownerUserId,
        templateVersionId: s.templateVersionId,
        currency: s.currency,
        memberCount: members.length,
        subscriptionStatus: sub?.status,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      });
    }

    if (filter?.offset) {
      result = result.slice(filter.offset);
    }
    if (filter?.limit) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  /**
   * Inspects detailed store record including channels and members.
   */
  public async getStoreDetail(storeId: string): Promise<PlatformStoreDetail> {
    const store = await this.deps.storeRepository.findById(storeId);
    if (!store) {
      throw new PlatformStoreNotFoundError(storeId);
    }

    const members = await this.deps.storeMemberRepository.findByStoreId(storeId);
    const sub = this.deps.subscriptionRepository
      ? await this.deps.subscriptionRepository.findByStoreId(storeId)
      : null;

    let ownerEmail: string | undefined;
    if (this.deps.userRepository) {
      const ownerUser = await this.deps.userRepository.findById(store.ownerUserId);
      ownerEmail = ownerUser?.email;
    }

    return {
      id: store.id,
      name: store.name,
      slug: store.slug,
      status: store.status as StoreLifecycleStatus,
      ownerUserId: store.ownerUserId,
      ownerEmail,
      templateVersionId: store.templateVersionId,
      currency: store.currency,
      memberCount: members.length,
      subscriptionStatus: sub?.status,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
      settings: store.settings,
      channels: [{ channel: 'TELEGRAM', status: 'ACTIVE' }],
      bots: [
        {
          id: `bot_${store.id}`,
          displayName: `${store.name} Bot`,
          username: `${store.slug}_bot`,
          status: 'CONNECTED',
          channel: 'TELEGRAM',
        },
      ],
    };
  }

  /**
   * Executes controlled store lifecycle transition.
   */
  public async updateStoreStatus(
    caller: PlatformCaller,
    storeId: string,
    newStatus: StoreLifecycleStatus,
    reason: string,
  ): Promise<PlatformStoreSummary> {
    const store = await this.deps.storeRepository.findById(storeId);
    if (!store) {
      await this.deps.auditService.logAction({
        caller,
        action: 'STORE_STATUS_UPDATED',
        resourceType: 'store',
        resourceId: storeId,
        storeId,
        details: { targetStatus: newStatus, reason },
        result: 'FAILED',
        errorMessage: `Store ${storeId} not found`,
      });
      throw new PlatformStoreNotFoundError(storeId);
    }

    const currentStatus = store.status as StoreLifecycleStatus;
    if (currentStatus === newStatus) {
      return this.toSummary(
        store,
        (await this.deps.storeMemberRepository.findByStoreId(storeId)).length,
      );
    }

    const allowed = VALID_LIFECYCLE_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.has(newStatus)) {
      const err = new InvalidStoreLifecycleTransitionError(currentStatus, newStatus);
      await this.deps.auditService.logAction({
        caller,
        action: 'STORE_STATUS_UPDATED',
        resourceType: 'store',
        resourceId: storeId,
        storeId,
        details: { fromStatus: currentStatus, toStatus: newStatus, reason },
        result: 'FAILED',
        errorMessage: err.message,
      });
      throw err;
    }

    const updated = await this.deps.storeRepository.update(storeId, {
      status: newStatus,
    });

    const members = await this.deps.storeMemberRepository.findByStoreId(storeId);

    await this.deps.auditService.logAction({
      caller,
      action: newStatus === 'SUSPENDED' ? 'STORE_SUSPENDED' : 'STORE_STATUS_UPDATED',
      resourceType: 'store',
      resourceId: storeId,
      storeId,
      details: {
        previousStatus: currentStatus,
        newStatus,
        reason,
      },
      result: 'SUCCESS',
    });

    return this.toSummary(updated, members.length);
  }

  private toSummary(
    store: {
      id: string;
      name: string;
      slug: string;
      status: string;
      ownerUserId: string;
      templateVersionId: string | null;
      currency: string;
      createdAt: string;
      updatedAt: string;
    },
    memberCount: number,
  ): PlatformStoreSummary {
    return {
      id: store.id,
      name: store.name,
      slug: store.slug,
      status: store.status as StoreLifecycleStatus,
      ownerUserId: store.ownerUserId,
      templateVersionId: store.templateVersionId,
      currency: store.currency,
      memberCount,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
    };
  }
}

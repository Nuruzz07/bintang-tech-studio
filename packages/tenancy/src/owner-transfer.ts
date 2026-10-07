import {
  TransferOwnershipInput,
  Store,
  StoreMember,
  StoreRepository,
  StoreMemberRepository,
  ProfileRepository,
} from './types.js';
import { OwnerInvariantViolationError, TenantNotFoundError } from './errors.js';
import { NotFoundError, ValidationError, ForbiddenError } from '@bintang/shared';

export interface TransferOwnershipResult {
  readonly store: Store;
  readonly newOwnerMembership: StoreMember;
  readonly previousOwnerMembership: StoreMember;
}

/**
 * Dedicated domain service executing Store Owner Transfer.
 * Bypasses generic store PATCH and enforces transactional owner swap invariants.
 */
export class OwnerTransferService {
  constructor(
    private readonly storeRepo: StoreRepository,
    private readonly memberRepo: StoreMemberRepository,
    private readonly profileRepo: ProfileRepository,
  ) {}

  /**
   * Executes atomic transfer of store business ownership.
   */
  async transferOwnership(input: TransferOwnershipInput): Promise<TransferOwnershipResult> {
    const storeId = input.storeId?.trim();
    const currentOwnerUserId = input.currentOwnerUserId?.trim();
    const targetUserId = input.targetUserId?.trim();

    if (!storeId || !currentOwnerUserId || !targetUserId) {
      throw new ValidationError(
        'storeId, currentOwnerUserId, and targetUserId are all required for owner transfer',
      );
    }

    if (currentOwnerUserId === targetUserId) {
      throw new OwnerInvariantViolationError('Cannot transfer ownership to the existing owner');
    }

    // 1. Verify store exists and caller is indeed the recorded business owner
    const store = await this.storeRepo.findById(storeId);
    if (!store) {
      throw new TenantNotFoundError(`Store ${storeId} not found`);
    }

    if (store.ownerUserId !== currentOwnerUserId) {
      throw new ForbiddenError(
        `User ${currentOwnerUserId} is not the current business owner of store ${storeId}`,
      );
    }

    // 2. Verify target user exists and profile is ACTIVE
    const targetProfile = await this.profileRepo.findById(targetUserId);
    if (!targetProfile) {
      throw new NotFoundError(`Target user ${targetUserId} profile not found`);
    }
    if (targetProfile.status !== 'ACTIVE') {
      throw new ValidationError(
        `Target user ${targetUserId} is not ACTIVE (status: ${targetProfile.status})`,
      );
    }

    // 3. Atomically update store owner in storage
    const updatedStore = await this.storeRepo.updateOwner(storeId, targetUserId);

    // 4. Update or create target user's membership as STORE_OWNER / ACTIVE
    let targetMember = await this.memberRepo.findByStoreAndUser(storeId, targetUserId);
    if (!targetMember) {
      targetMember = await this.memberRepo.create({
        storeId,
        userId: targetUserId,
        role: 'STORE_OWNER',
        status: 'ACTIVE',
      });
    } else {
      targetMember = await this.memberRepo.update(targetMember.id, {
        role: 'STORE_OWNER',
        status: 'ACTIVE',
      });
    }

    // 5. Demote previous owner to STORE_ADMIN / ACTIVE so they retain management access
    let prevOwnerMember = await this.memberRepo.findByStoreAndUser(storeId, currentOwnerUserId);
    if (prevOwnerMember) {
      prevOwnerMember = await this.memberRepo.update(prevOwnerMember.id, {
        role: 'STORE_ADMIN',
        status: 'ACTIVE',
      });
    } else {
      prevOwnerMember = await this.memberRepo.create({
        storeId,
        userId: currentOwnerUserId,
        role: 'STORE_ADMIN',
        status: 'ACTIVE',
      });
    }

    return {
      store: updatedStore,
      newOwnerMembership: targetMember,
      previousOwnerMembership: prevOwnerMember,
    };
  }
}

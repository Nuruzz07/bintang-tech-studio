import { describe, it, expect, beforeEach } from 'vitest';
import { OwnerTransferService } from '../src/owner-transfer.js';
import { StoreService } from '../src/store-service.js';
import {
  InMemoryProfileRepository,
  InMemoryStoreRepository,
  InMemoryStoreMemberRepository,
} from '../src/memory-repository.js';
import { OwnerInvariantViolationError, TenantNotFoundError } from '../src/errors.js';
import { ForbiddenError, NotFoundError, ValidationError } from '@bintang/shared';

describe('Dedicated Store Owner Transfer', () => {
  let profileRepo: InMemoryProfileRepository;
  let storeRepo: InMemoryStoreRepository;
  let memberRepo: InMemoryStoreMemberRepository;
  let storeService: StoreService;
  let transferService: OwnerTransferService;

  const originalOwnerId = 'user_original_owner';
  const newOwnerId = 'user_new_owner';
  const thirdUserId = 'user_third';
  let storeId: string;

  beforeEach(async () => {
    profileRepo = new InMemoryProfileRepository();
    storeRepo = new InMemoryStoreRepository();
    memberRepo = new InMemoryStoreMemberRepository();
    storeService = new StoreService(storeRepo, memberRepo, profileRepo);
    transferService = new OwnerTransferService(storeRepo, memberRepo, profileRepo);

    await profileRepo.create({
      id: originalOwnerId,
      fullName: 'Original Owner',
      avatarUrl: null,
      platformRole: 'USER',
      status: 'ACTIVE',
    });

    await profileRepo.create({
      id: newOwnerId,
      fullName: 'New Owner Candidate',
      avatarUrl: null,
      platformRole: 'USER',
      status: 'ACTIVE',
    });

    await profileRepo.create({
      id: thirdUserId,
      fullName: 'Third Party User',
      avatarUrl: null,
      platformRole: 'USER',
      status: 'ACTIVE',
    });

    const created = await storeService.createStore({
      ownerUserId: originalOwnerId,
      name: 'Transfer Test Store',
      slug: 'transfer-store',
    });
    storeId = created.store.id;
  });

  it('successfully executes atomic ownership transfer to new owner', async () => {
    const result = await transferService.transferOwnership({
      storeId,
      currentOwnerUserId: originalOwnerId,
      targetUserId: newOwnerId,
    });

    // 1. Store ownerUserId is updated
    expect(result.store.ownerUserId).toBe(newOwnerId);

    // 2. New owner has active STORE_OWNER membership
    expect(result.newOwnerMembership.userId).toBe(newOwnerId);
    expect(result.newOwnerMembership.role).toBe('STORE_OWNER');
    expect(result.newOwnerMembership.status).toBe('ACTIVE');

    // 3. Previous owner is transitioned to STORE_ADMIN
    expect(result.previousOwnerMembership.userId).toBe(originalOwnerId);
    expect(result.previousOwnerMembership.role).toBe('STORE_ADMIN');
    expect(result.previousOwnerMembership.status).toBe('ACTIVE');

    // 4. Verify in repositories
    const updatedStore = await storeRepo.findById(storeId);
    expect(updatedStore?.ownerUserId).toBe(newOwnerId);

    const newOwnerMember = await memberRepo.findByStoreAndUser(storeId, newOwnerId);
    expect(newOwnerMember?.role).toBe('STORE_OWNER');

    const prevOwnerMember = await memberRepo.findByStoreAndUser(storeId, originalOwnerId);
    expect(prevOwnerMember?.role).toBe('STORE_ADMIN');

    // 5. Invariant: exactly one STORE_OWNER membership exists
    const allMembers = await memberRepo.findByStoreId(storeId);
    const ownerMembers = allMembers.filter((m) => m.role === 'STORE_OWNER');
    expect(ownerMembers).toHaveLength(1);
    expect(ownerMembers[0].userId).toBe(newOwnerId);
  });

  it('rejects transfer if caller is not the recorded business owner', async () => {
    await expect(
      transferService.transferOwnership({
        storeId,
        currentOwnerUserId: thirdUserId, // Unauthorized user
        targetUserId: newOwnerId,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('rejects transfer if target user is the existing owner', async () => {
    await expect(
      transferService.transferOwnership({
        storeId,
        currentOwnerUserId: originalOwnerId,
        targetUserId: originalOwnerId, // Self transfer
      }),
    ).rejects.toThrow(OwnerInvariantViolationError);
  });

  it('rejects transfer if target user profile does not exist', async () => {
    await expect(
      transferService.transferOwnership({
        storeId,
        currentOwnerUserId: originalOwnerId,
        targetUserId: 'non_existent_target',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('rejects transfer if target user is not ACTIVE', async () => {
    await profileRepo.create({
      id: 'suspended_candidate',
      fullName: 'Suspended Candidate',
      avatarUrl: null,
      platformRole: 'USER',
      status: 'SUSPENDED',
    });

    await expect(
      transferService.transferOwnership({
        storeId,
        currentOwnerUserId: originalOwnerId,
        targetUserId: 'suspended_candidate',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects transfer for non-existent store', async () => {
    await expect(
      transferService.transferOwnership({
        storeId: 'invalid_store',
        currentOwnerUserId: originalOwnerId,
        targetUserId: newOwnerId,
      }),
    ).rejects.toThrow(TenantNotFoundError);
  });
});

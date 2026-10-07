import { describe, it, expect, beforeEach } from 'vitest';
import { MembershipService } from '../src/membership-service.js';
import { StoreService } from '../src/store-service.js';
import {
  InMemoryProfileRepository,
  InMemoryStoreRepository,
  InMemoryStoreMemberRepository,
} from '../src/memory-repository.js';
import { OwnerInvariantViolationError, TenantMutationForbiddenError } from '../src/errors.js';
import { ConflictError } from '@bintang/shared';

describe('Membership Service & Lifecycle Invariants', () => {
  let profileRepo: InMemoryProfileRepository;
  let storeRepo: InMemoryStoreRepository;
  let memberRepo: InMemoryStoreMemberRepository;
  let storeService: StoreService;
  let membershipService: MembershipService;

  const ownerId = 'user_owner';
  const staffId = 'user_staff';
  const adminId = 'user_admin';
  let storeId: string;

  beforeEach(async () => {
    profileRepo = new InMemoryProfileRepository();
    storeRepo = new InMemoryStoreRepository();
    memberRepo = new InMemoryStoreMemberRepository();
    storeService = new StoreService(storeRepo, memberRepo, profileRepo);
    membershipService = new MembershipService(memberRepo, storeRepo, profileRepo);

    await profileRepo.create({
      id: ownerId,
      fullName: 'Store Owner',
      avatarUrl: null,
      platformRole: 'USER',
      status: 'ACTIVE',
    });

    await profileRepo.create({
      id: staffId,
      fullName: 'Store Staff',
      avatarUrl: null,
      platformRole: 'USER',
      status: 'ACTIVE',
    });

    await profileRepo.create({
      id: adminId,
      fullName: 'Store Admin',
      avatarUrl: null,
      platformRole: 'USER',
      status: 'ACTIVE',
    });

    const created = await storeService.createStore({
      ownerUserId: ownerId,
      name: 'Test Store',
      slug: 'test-store',
    });
    storeId = created.store.id;
  });

  it('invites a new member with status "INVITED"', async () => {
    const member = await membershipService.inviteMember({
      storeId,
      userId: staffId,
      role: 'STORE_STAFF',
      actorUserId: ownerId,
    });

    expect(member.storeId).toBe(storeId);
    expect(member.userId).toBe(staffId);
    expect(member.role).toBe('STORE_STAFF');
    expect(member.status).toBe('INVITED');
  });

  it('rejects inviting a member as STORE_OWNER', async () => {
    await expect(
      membershipService.inviteMember({
        storeId,
        userId: adminId,
        // @ts-expect-error Testing invalid invite role
        role: 'STORE_OWNER',
        actorUserId: ownerId,
      }),
    ).rejects.toThrow(OwnerInvariantViolationError);
  });

  it('enforces unique membership per store per user', async () => {
    await membershipService.inviteMember({
      storeId,
      userId: staffId,
      role: 'STORE_STAFF',
      actorUserId: ownerId,
    });

    await expect(
      membershipService.inviteMember({
        storeId,
        userId: staffId,
        role: 'STORE_ADMIN',
        actorUserId: ownerId,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('progresses member lifecycle from INVITED to ACTIVE to SUSPENDED to REMOVED', async () => {
    await membershipService.inviteMember({
      storeId,
      userId: staffId,
      role: 'STORE_STAFF',
      actorUserId: ownerId,
    });

    // 1. Activate
    const active = await membershipService.activateMember(storeId, staffId);
    expect(active.status).toBe('ACTIVE');

    // 2. Suspend
    const suspended = await membershipService.suspendMember(storeId, staffId);
    expect(suspended.status).toBe('SUSPENDED');

    // 3. Reactivate
    const reactivated = await membershipService.activateMember(storeId, staffId);
    expect(reactivated.status).toBe('ACTIVE');

    // 4. Remove
    const removed = await membershipService.removeMember(storeId, staffId);
    expect(removed.status).toBe('REMOVED');
  });

  it('strictly defends active STORE_OWNER against suspension', async () => {
    await expect(membershipService.suspendMember(storeId, ownerId)).rejects.toThrow(
      OwnerInvariantViolationError,
    );
  });

  it('strictly defends active STORE_OWNER against removal', async () => {
    await expect(membershipService.removeMember(storeId, ownerId)).rejects.toThrow(
      OwnerInvariantViolationError,
    );
  });

  it('strictly defends active STORE_OWNER against demotion', async () => {
    await expect(
      membershipService.updateMemberRole(storeId, ownerId, 'STORE_ADMIN'),
    ).rejects.toThrow(OwnerInvariantViolationError);

    await expect(
      membershipService.updateMemberRole(storeId, ownerId, 'STORE_STAFF'),
    ).rejects.toThrow(OwnerInvariantViolationError);
  });

  it('allows promoting/demoting staff and admin members', async () => {
    await membershipService.inviteMember({
      storeId,
      userId: staffId,
      role: 'STORE_STAFF',
      actorUserId: ownerId,
    });
    await membershipService.activateMember(storeId, staffId);

    const promoted = await membershipService.updateMemberRole(storeId, staffId, 'STORE_ADMIN');
    expect(promoted.role).toBe('STORE_ADMIN');

    const demoted = await membershipService.updateMemberRole(storeId, staffId, 'STORE_STAFF');
    expect(demoted.role).toBe('STORE_STAFF');
  });

  it('rejects promoting staff or admin to STORE_OWNER via updateMemberRole', async () => {
    await membershipService.inviteMember({
      storeId,
      userId: staffId,
      role: 'STORE_STAFF',
      actorUserId: ownerId,
    });

    await expect(
      membershipService.updateMemberRole(storeId, staffId, 'STORE_OWNER'),
    ).rejects.toThrow(OwnerInvariantViolationError);
  });

  it('strictly rejects tenant mutation on membership (changing storeId or userId)', async () => {
    const member = await membershipService.inviteMember({
      storeId,
      userId: staffId,
      role: 'STORE_STAFF',
      actorUserId: ownerId,
    });

    // Attempting to move member to a different store
    await expect(
      membershipService.assertNoTenantMutation(member.id, 'other_store_id', staffId),
    ).rejects.toThrow(TenantMutationForbiddenError);

    // Attempting to change user on membership
    await expect(
      membershipService.assertNoTenantMutation(member.id, storeId, 'other_user_id'),
    ).rejects.toThrow(TenantMutationForbiddenError);
  });
});

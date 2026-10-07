import { describe, it, expect, beforeEach } from 'vitest';
import { TenantResolver } from '../src/resolver.js';
import { StoreService } from '../src/store-service.js';
import { MembershipService } from '../src/membership-service.js';
import {
  InMemoryProfileRepository,
  InMemoryStoreRepository,
  InMemoryStoreMemberRepository,
} from '../src/memory-repository.js';
import {
  TenantAccessDeniedError,
  TenantNotFoundError,
  MembershipInactiveError,
  InvalidStoreContextError,
} from '../src/errors.js';
import { isOk, isErr } from '@bintang/shared';

describe('TenantResolver & Multi-Tenant Isolation', () => {
  let profileRepo: InMemoryProfileRepository;
  let storeRepo: InMemoryStoreRepository;
  let memberRepo: InMemoryStoreMemberRepository;
  let storeService: StoreService;
  let membershipService: MembershipService;
  let resolver: TenantResolver;

  const userA = 'user_alpha';
  const userB = 'user_beta';
  let storeA: string;
  let storeB: string;
  let storeC: string;

  beforeEach(async () => {
    profileRepo = new InMemoryProfileRepository();
    storeRepo = new InMemoryStoreRepository();
    memberRepo = new InMemoryStoreMemberRepository();
    storeService = new StoreService(storeRepo, memberRepo, profileRepo);
    membershipService = new MembershipService(memberRepo, storeRepo, profileRepo);
    resolver = new TenantResolver({
      profileRepo,
      storeRepo,
      memberRepo,
    });

    await profileRepo.create({
      id: userA,
      fullName: 'User Alpha',
      avatarUrl: null,
      platformRole: 'USER',
      status: 'ACTIVE',
    });

    await profileRepo.create({
      id: userB,
      fullName: 'User Beta',
      avatarUrl: null,
      platformRole: 'USER',
      status: 'ACTIVE',
    });

    // Store A owned by User A
    const resA = await storeService.createStore({
      ownerUserId: userA,
      name: 'Alpha Store',
      slug: 'alpha-store',
    });
    storeA = resA.store.id;

    // Store B owned by User B
    const resB = await storeService.createStore({
      ownerUserId: userB,
      name: 'Beta Store',
      slug: 'beta-store',
    });
    storeB = resB.store.id;

    // Store C also owned by User A (multi-store scenario)
    const resC = await storeService.createStore({
      ownerUserId: userA,
      name: 'Charlie Store',
      slug: 'charlie-store',
    });
    storeC = resC.store.id;
  });

  it('resolves valid StoreContext for member of target store', async () => {
    const result = await resolver.resolveStoreContext({
      userId: userA,
      storeId: storeA,
      requestId: 'req_101',
      correlationId: 'corr_202',
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.storeId).toBe(storeA);
      expect(result.value.userId).toBe(userA);
      expect(result.value.role).toBe('STORE_OWNER');
      expect(result.value.tenantSlug).toBe('alpha-store');
      expect(result.value.requestId).toBe('req_101');
      expect(result.value.correlationId).toBe('corr_202');
      expect(Object.isFrozen(result.value)).toBe(true);
    }
  });

  it('strictly isolates tenants: User A cannot resolve Store B', async () => {
    const result = await resolver.resolveStoreContext({
      userId: userA,
      storeId: storeB, // Store B belongs to User B
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toBeInstanceOf(TenantAccessDeniedError);
    }
  });

  it('strictly isolates tenants: User B cannot resolve Store A or Store C', async () => {
    const resA = await resolver.resolveStoreContext({
      userId: userB,
      storeId: storeA,
    });
    expect(isErr(resA)).toBe(true);
    if (isErr(resA)) {
      expect(resA.error).toBeInstanceOf(TenantAccessDeniedError);
    }

    const resC = await resolver.resolveStoreContext({
      userId: userB,
      storeId: storeC,
    });
    expect(isErr(resC)).toBe(true);
    if (isErr(resC)) {
      expect(resC.error).toBeInstanceOf(TenantAccessDeniedError);
    }
  });

  it('multi-store user: User A resolves Store A and Store C independently with zero cross-leak', async () => {
    const ctxA = await resolver.resolveStoreContext({
      userId: userA,
      storeId: storeA,
    });
    expect(isOk(ctxA)).toBe(true);
    if (isOk(ctxA)) {
      expect(ctxA.value.storeId).toBe(storeA);
      expect(ctxA.value.tenantSlug).toBe('alpha-store');
    }

    const ctxC = await resolver.resolveStoreContext({
      userId: userA,
      storeId: storeC,
    });
    expect(isOk(ctxC)).toBe(true);
    if (isOk(ctxC)) {
      expect(ctxC.value.storeId).toBe(storeC);
      expect(ctxC.value.tenantSlug).toBe('charlie-store');
    }
  });

  it('rejects StoreContext resolution if membership is INVITED', async () => {
    const invitedUser = 'user_invited';
    await profileRepo.create({
      id: invitedUser,
      fullName: 'Invited Staff',
      avatarUrl: null,
      platformRole: 'USER',
      status: 'ACTIVE',
    });

    await membershipService.inviteMember({
      storeId: storeA,
      userId: invitedUser,
      role: 'STORE_STAFF',
      actorUserId: userA,
    });

    const result = await resolver.resolveStoreContext({
      userId: invitedUser,
      storeId: storeA,
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toBeInstanceOf(MembershipInactiveError);
      expect((result.error as MembershipInactiveError).membershipStatus).toBe('INVITED');
    }
  });

  it('rejects StoreContext resolution if membership is SUSPENDED', async () => {
    const staffUser = 'user_staff_suspend';
    await profileRepo.create({
      id: staffUser,
      fullName: 'Suspended Staff',
      avatarUrl: null,
      platformRole: 'USER',
      status: 'ACTIVE',
    });

    await membershipService.inviteMember({
      storeId: storeA,
      userId: staffUser,
      role: 'STORE_STAFF',
      actorUserId: userA,
    });
    await membershipService.activateMember(storeA, staffUser);
    await membershipService.suspendMember(storeA, staffUser);

    const result = await resolver.resolveStoreContext({
      userId: staffUser,
      storeId: storeA,
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toBeInstanceOf(MembershipInactiveError);
      expect((result.error as MembershipInactiveError).membershipStatus).toBe('SUSPENDED');
    }
  });

  it('rejects StoreContext resolution if membership is REMOVED', async () => {
    const removedUser = 'user_removed';
    await profileRepo.create({
      id: removedUser,
      fullName: 'Removed Staff',
      avatarUrl: null,
      platformRole: 'USER',
      status: 'ACTIVE',
    });

    await membershipService.inviteMember({
      storeId: storeA,
      userId: removedUser,
      role: 'STORE_STAFF',
      actorUserId: userA,
    });
    await membershipService.activateMember(storeA, removedUser);
    await membershipService.removeMember(storeA, removedUser);

    const result = await resolver.resolveStoreContext({
      userId: removedUser,
      storeId: storeA,
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toBeInstanceOf(MembershipInactiveError);
      expect((result.error as MembershipInactiveError).membershipStatus).toBe('REMOVED');
    }
  });

  it('returns TenantNotFoundError when store does not exist', async () => {
    const result = await resolver.resolveStoreContext({
      userId: userA,
      storeId: 'non_existent_store',
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toBeInstanceOf(TenantNotFoundError);
    }
  });

  it('rejects resolution with missing or empty parameters', async () => {
    const resNoUser = await resolver.resolveStoreContext({
      userId: '',
      storeId: storeA,
    });
    expect(isErr(resNoUser)).toBe(true);
    if (isErr(resNoUser)) {
      expect(resNoUser.error).toBeInstanceOf(InvalidStoreContextError);
    }

    const resNoStore = await resolver.resolveStoreContext({
      userId: userA,
      storeId: '',
    });
    expect(isErr(resNoStore)).toBe(true);
    if (isErr(resNoStore)) {
      expect(resNoStore.error).toBeInstanceOf(InvalidStoreContextError);
    }
  });
});

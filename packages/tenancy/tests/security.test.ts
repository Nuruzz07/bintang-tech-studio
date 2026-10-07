import { describe, it, expect, beforeEach } from 'vitest';
import {
  TenantResolver,
  StoreService,
  MembershipService,
  IdentityService,
  OwnerTransferService,
  InMemoryProfileRepository,
  InMemoryStoreRepository,
  InMemoryStoreMemberRepository,
  resolveStoreContextMiddleware,
  extractStoreIdFromHeaders,
} from '../src/index.js';
import {
  PlatformRoleElevationError,
  OwnerInvariantViolationError,
  TenantMutationForbiddenError,
  MembershipInactiveError,
  TenantAccessDeniedError,
} from '../src/errors.js';
import { UnauthorizedError, ValidationError, isErr } from '@bintang/shared';

describe('Security & Tenant Boundary Matrix', () => {
  let profileRepo: InMemoryProfileRepository;
  let storeRepo: InMemoryStoreRepository;
  let memberRepo: InMemoryStoreMemberRepository;
  let storeService: StoreService;
  let membershipService: MembershipService;
  let identityService: IdentityService;
  let transferService: OwnerTransferService;
  let resolver: TenantResolver;

  const userA = 'user_sec_a';
  const userB = 'user_sec_b';
  let storeA: string;
  let storeB: string;

  beforeEach(async () => {
    profileRepo = new InMemoryProfileRepository();
    storeRepo = new InMemoryStoreRepository();
    memberRepo = new InMemoryStoreMemberRepository();

    identityService = new IdentityService(profileRepo);
    storeService = new StoreService(storeRepo, memberRepo, profileRepo);
    membershipService = new MembershipService(memberRepo, storeRepo, profileRepo);
    transferService = new OwnerTransferService(storeRepo, memberRepo, profileRepo);
    resolver = new TenantResolver({ profileRepo, storeRepo, memberRepo });

    await identityService.createProfile({
      id: userA,
      fullName: 'Security User A',
      platformRole: 'USER',
    });

    await identityService.createProfile({
      id: userB,
      fullName: 'Security User B',
      platformRole: 'USER',
    });

    const createdA = await storeService.createStore({
      ownerUserId: userA,
      name: 'Security Store A',
      slug: 'sec-store-a',
    });
    storeA = createdA.store.id;

    const createdB = await storeService.createStore({
      ownerUserId: userB,
      name: 'Security Store B',
      slug: 'sec-store-b',
    });
    storeB = createdB.store.id;
  });

  describe('Platform Identity Protections', () => {
    it('prevents user from self-promoting to PLATFORM_ADMIN or PLATFORM_OWNER', async () => {
      await expect(
        identityService.updateProfile(userA, { platformRole: 'PLATFORM_ADMIN' }, 'USER'),
      ).rejects.toThrow(PlatformRoleElevationError);

      await expect(
        identityService.updateProfile(userA, { platformRole: 'PLATFORM_OWNER' }, undefined),
      ).rejects.toThrow(PlatformRoleElevationError);
    });
  });

  describe('Store Owner Protections', () => {
    it('prevents direct mutation of store owner_user_id', async () => {
      await expect(
        storeService.updateStore(storeA, {
          ownerUserId: userB,
        }),
      ).rejects.toThrow(OwnerInvariantViolationError);
    });

    it('prevents unauthorized owner transfer by non-owner', async () => {
      await expect(
        transferService.transferOwnership({
          storeId: storeA,
          currentOwnerUserId: userB, // userB is NOT the owner of storeA
          targetUserId: userB,
        }),
      ).rejects.toThrow();
    });

    it('prevents active STORE_OWNER membership from being removed or suspended', async () => {
      await expect(membershipService.suspendMember(storeA, userA)).rejects.toThrow(
        OwnerInvariantViolationError,
      );

      await expect(membershipService.removeMember(storeA, userA)).rejects.toThrow(
        OwnerInvariantViolationError,
      );
    });
  });

  describe('Tenant Boundary & Mutation Protections', () => {
    it('prevents mutating storeId on an existing membership to jump tenants', async () => {
      const member = await memberRepo.findByStoreAndUser(storeA, userA);
      expect(member).toBeDefined();

      await expect(
        membershipService.assertNoTenantMutation(member!.id, storeB, userA),
      ).rejects.toThrow(TenantMutationForbiddenError);
    });

    it('blocks suspended or removed member from obtaining active StoreContext', async () => {
      const staffUser = 'user_sec_staff';
      await identityService.createProfile({
        id: staffUser,
        fullName: 'Staff User',
      });

      await membershipService.inviteMember({
        storeId: storeA,
        userId: staffUser,
        role: 'STORE_STAFF',
        actorUserId: userA,
      });
      await membershipService.activateMember(storeA, staffUser);
      await membershipService.suspendMember(storeA, staffUser);

      // Attempt to resolve context while suspended
      const resSuspended = await resolver.resolveStoreContext({
        userId: staffUser,
        storeId: storeA,
      });
      expect(isErr(resSuspended)).toBe(true);
      if (isErr(resSuspended)) {
        expect(resSuspended.error).toBeInstanceOf(MembershipInactiveError);
      }

      // Remove member and attempt again
      await membershipService.removeMember(storeA, staffUser);
      const resRemoved = await resolver.resolveStoreContext({
        userId: staffUser,
        storeId: storeA,
      });
      expect(isErr(resRemoved)).toBe(true);
      if (isErr(resRemoved)) {
        expect(resRemoved.error).toBeInstanceOf(MembershipInactiveError);
      }
    });

    it('prevents cross-tenant membership lookup: User A cannot access Store B', async () => {
      const res = await resolver.resolveStoreContext({
        userId: userA,
        storeId: storeB,
      });
      expect(isErr(res)).toBe(true);
      if (isErr(res)) {
        expect(res.error).toBeInstanceOf(TenantAccessDeniedError);
      }
    });
  });

  describe('HTTP Middleware Integration', () => {
    it('extracts storeId from case-insensitive x-store-id header', () => {
      expect(extractStoreIdFromHeaders({ 'x-store-id': 'store_123' })).toBe('store_123');
      expect(extractStoreIdFromHeaders({ 'X-Store-Id': 'store_456' })).toBe('store_456');
      expect(extractStoreIdFromHeaders({ other: 'value' })).toBeNull();
    });

    it('resolves StoreContext for valid authenticated HTTP request', async () => {
      const req = {
        headers: {
          'x-store-id': storeA,
          'x-request-id': 'req_http_1',
        },
        user: { id: userA },
      };

      const ctx = await resolveStoreContextMiddleware(req, resolver);
      expect(ctx.storeId).toBe(storeA);
      expect(ctx.userId).toBe(userA);
      expect(ctx.role).toBe('STORE_OWNER');
      expect(req.storeContext).toBe(ctx);
    });

    it('rejects unauthenticated request without user ID', async () => {
      const req = {
        headers: { 'x-store-id': storeA },
        user: null,
      };

      await expect(resolveStoreContextMiddleware(req, resolver)).rejects.toThrow(UnauthorizedError);
    });

    it('rejects request missing store ID header/params', async () => {
      const req = {
        headers: {},
        user: { id: userA },
      };

      await expect(resolveStoreContextMiddleware(req, resolver)).rejects.toThrow(ValidationError);
    });
  });
});

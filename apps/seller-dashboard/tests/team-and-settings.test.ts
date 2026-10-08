import { describe, it, expect, beforeEach } from 'vitest';
import { createSellerDashboardTestHarness, SellerDashboardTestHarness } from './test-helpers.js';
import {
  StaffLimitExceededError,
  OwnerDemotionForbiddenError,
  SellerResourceNotFoundError,
} from '../src/errors.js';
import { PermissionDeniedError } from '@bintang/authorization';

describe('Seller Dashboard — Team, Settings & Subscriptions', () => {
  let harness: SellerDashboardTestHarness;
  let aliceSession: string; // Store A Owner
  let bobSession: string; // Store A Admin
  let danSession: string; // Store A Staff
  let charlieSession: string; // Store B Owner

  beforeEach(async () => {
    harness = await createSellerDashboardTestHarness();

    const aliceRes = await harness.loginAs(harness.userAlice, harness.storeA.id);
    aliceSession = aliceRes.sessionToken;

    const bobRes = await harness.loginAs(harness.userBob, harness.storeA.id);
    bobSession = bobRes.sessionToken;

    const danRes = await harness.loginAs(harness.userDan, harness.storeA.id);
    danSession = danRes.sessionToken;

    const charlieRes = await harness.loginAs(harness.userCharlie, harness.storeB.id);
    charlieSession = charlieRes.sessionToken;
  });

  describe('Team Management', () => {
    it('allows owner and admin to list team members, enforces tenant isolation', async () => {
      const storeAMembersAlice = await harness.dashboardService.listTeamMembers(aliceSession);
      const storeAMembersBob = await harness.dashboardService.listTeamMembers(bobSession);

      expect(storeAMembersAlice).toHaveLength(3); // Alice, Bob, Dan
      expect(storeAMembersBob).toHaveLength(3);

      const roles = storeAMembersAlice.map((m) => m.role);
      expect(roles).toContain('STORE_OWNER');
      expect(roles).toContain('STORE_ADMIN');
      expect(roles).toContain('STORE_STAFF');

      // Cross-tenant: Store B members are isolated (Charlie Owner, Alice Staff)
      const storeBMembers = await harness.dashboardService.listTeamMembers(charlieSession);
      expect(storeBMembers).toHaveLength(2);
      expect(storeBMembers.map((m) => m.userId)).toContain(harness.userCharlie.id);
    });

    it('denies store staff from reading team members', async () => {
      await expect(harness.dashboardService.listTeamMembers(danSession)).rejects.toThrow(
        PermissionDeniedError,
      );
    });

    it('enforces staff quota limits based on subscription plan', async () => {
      // Store A has 3 members (Alice, Bob, Dan) and Starter plan max is 3
      await expect(
        harness.dashboardService.inviteMember(aliceSession, {
          email: 'newstaff@example.com',
          name: 'New Staff',
          role: 'STORE_STAFF',
        }),
      ).rejects.toThrow(StaffLimitExceededError);

      // Store B (Pro) has 2 members (Charlie, Alice) and limit 10 -> can invite
      const invited = await harness.dashboardService.inviteMember(charlieSession, {
        email: 'prostaff@example.com',
        name: 'Pro Staff 1',
        role: 'STORE_STAFF',
      });

      expect(invited.role).toBe('STORE_STAFF');
      expect(invited.userEmail).toBe('prostaff@example.com');

      const storeBMembers = await harness.dashboardService.listTeamMembers(charlieSession);
      expect(storeBMembers).toHaveLength(3);
    });

    it('allows updating role of non-owner members and denies staff', async () => {
      const membersA = await harness.dashboardService.listTeamMembers(aliceSession);
      const danMember = membersA.find((m) => m.userId === harness.userDan.id);
      expect(danMember).toBeDefined();

      // Staff Dan cannot update roles (while still STORE_STAFF)
      await expect(
        harness.dashboardService.updateMemberRole(danSession, {
          membershipId: danMember!.membershipId,
          role: 'STORE_ADMIN',
        }),
      ).rejects.toThrow(PermissionDeniedError);

      // Owner Alice can update Dan from STORE_STAFF to STORE_ADMIN
      const updated = await harness.dashboardService.updateMemberRole(aliceSession, {
        membershipId: danMember!.membershipId,
        role: 'STORE_ADMIN',
      });
      expect(updated.role).toBe('STORE_ADMIN');
    });

    it('strictly forbids demoting or removing the STORE_OWNER', async () => {
      const membersA = await harness.dashboardService.listTeamMembers(aliceSession);
      const aliceMember = membersA.find((m) => m.userId === harness.userAlice.id);
      expect(aliceMember).toBeDefined();

      // Attempt demoting Alice to STORE_ADMIN
      await expect(
        harness.dashboardService.updateMemberRole(aliceSession, {
          membershipId: aliceMember!.membershipId,
          role: 'STORE_ADMIN',
        }),
      ).rejects.toThrow(OwnerDemotionForbiddenError);

      // Attempt removing Alice
      await expect(
        harness.dashboardService.removeMember(aliceSession, aliceMember!.membershipId),
      ).rejects.toThrow(OwnerDemotionForbiddenError);
    });

    it('allows removing staff and protects cross-tenant membership modification', async () => {
      const membersA = await harness.dashboardService.listTeamMembers(aliceSession);
      const danMember = membersA.find((m) => m.userId === harness.userDan.id);
      expect(danMember).toBeDefined();

      // Charlie (Store B) cannot remove Dan (Store A)
      await expect(
        harness.dashboardService.removeMember(charlieSession, danMember!.membershipId),
      ).rejects.toThrow(SellerResourceNotFoundError);

      // Alice can remove Dan
      await harness.dashboardService.removeMember(aliceSession, danMember!.membershipId);

      const afterRemoval = await harness.dashboardService.listTeamMembers(aliceSession);
      expect(afterRemoval).toHaveLength(2);
      expect(afterRemoval.find((m) => m.userId === harness.userDan.id)).toBeUndefined();
    });
  });

  describe('Store Settings', () => {
    it('allows owner and admin to view and update store settings', async () => {
      const settings = await harness.dashboardService.getStoreSettings(aliceSession);
      expect(settings.name).toBe('Toko Bintang Alpha');
      expect(settings.currency).toBe('IDR');
      expect(settings.status).toBe('ACTIVE');

      const updated = await harness.dashboardService.updateStoreSettings(aliceSession, {
        name: 'Toko A Official',
        domain: 'toko-a.com',
      });
      expect(updated.name).toBe('Toko A Official');
      expect(updated.domain).toBe('toko-a.com');

      const fetchedBob = await harness.dashboardService.getStoreSettings(bobSession);
      expect(fetchedBob.name).toBe('Toko A Official');
      expect(fetchedBob.domain).toBe('toko-a.com');
    });

    it('denies staff from viewing or updating store settings', async () => {
      await expect(harness.dashboardService.getStoreSettings(danSession)).rejects.toThrow(
        PermissionDeniedError,
      );

      await expect(
        harness.dashboardService.updateStoreSettings(danSession, {
          name: 'Hacked Store',
        }),
      ).rejects.toThrow(PermissionDeniedError);
    });

    it('protects store settings across tenants', async () => {
      const storeASettings = await harness.dashboardService.getStoreSettings(aliceSession);
      const storeBSettings = await harness.dashboardService.getStoreSettings(charlieSession);

      expect(storeASettings.id).not.toBe(storeBSettings.id);
      expect(storeASettings.name).not.toBe(storeBSettings.name);
    });
  });

  describe('Subscription Visibility', () => {
    it('allows owner and admin to view subscription and plan entitlements', async () => {
      const subA = await harness.dashboardService.getSubscriptionVisibility(aliceSession);
      expect(subA.storeId).toBe(harness.storeA.id);
      expect(subA.planSlug).toBe('starter');
      expect(subA.productLimit).toBe(20);
      expect(subA.staffLimit).toBe(3);
      expect(subA.currentProducts).toBe(2);
      expect(subA.currentStaff).toBe(3);
      expect(subA.telegramAllowed).toBe(true);

      const subB = await harness.dashboardService.getSubscriptionVisibility(charlieSession);
      expect(subB.storeId).toBe(harness.storeB.id);
      expect(subB.productLimit).toBe(100);
      expect(subB.staffLimit).toBe(10);
      expect(subB.telegramAllowed).toBe(true);
    });

    it('denies staff from viewing subscription details', async () => {
      await expect(harness.dashboardService.getSubscriptionVisibility(danSession)).rejects.toThrow(
        PermissionDeniedError,
      );
    });
  });
});

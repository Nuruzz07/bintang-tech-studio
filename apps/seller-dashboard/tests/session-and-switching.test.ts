/**
 * Bintang Tech Studio — Seller Dashboard Session & Multi-Store Switching Tests.
 * Baseline: Milestone M12 Seller Dashboard Foundation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSellerDashboardTestHarness, SellerDashboardTestHarness } from './test-helpers.js';
import {
  SellerUnauthenticatedError,
  SellerStoreAccessDeniedError,
  StoreSuspendedError,
  StoreSwitchUnauthorizedError,
} from '../src/errors.js';

describe('Seller Dashboard — Session & Store Switching', () => {
  let harness: SellerDashboardTestHarness;

  beforeEach(async () => {
    harness = await createSellerDashboardTestHarness();
  });

  describe('Session Creation & Authentication', () => {
    it('creates a session for active user with store memberships', async () => {
      const session = await harness.loginAs(harness.userAlice);
      expect(session).toBeDefined();
      expect(session.sessionToken).toBeDefined();
      expect(session.userId).toBe(harness.userAlice.id);
      expect(session.activeStoreId).toBe(harness.storeA.id);
      expect(session.activeRole).toBe('STORE_OWNER');
      expect(session.availableStores.length).toBeGreaterThanOrEqual(2);
    });

    it('rejects session creation for inactive user', async () => {
      await expect(harness.loginAs(harness.userInactive)).rejects.toThrow(
        SellerUnauthenticatedError,
      );
    });

    it('rejects session creation for user with no store memberships', async () => {
      await expect(harness.loginAs(harness.userEve)).rejects.toThrow(SellerStoreAccessDeniedError);
    });

    it('honors preferredStoreId when user is an active member of that store', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeB.id);
      expect(session.activeStoreId).toBe(harness.storeB.id);
      expect(session.activeRole).toBe('STORE_STAFF');
    });

    it('rejects preferredStoreId if user is not a member of requested store', async () => {
      await expect(harness.loginAs(harness.userBob, harness.storeB.id)).rejects.toThrow(
        SellerStoreAccessDeniedError,
      );
    });
  });

  describe('Multi-Store Context Resolution', () => {
    it('resolves active store context securely from session token', async () => {
      const session = await harness.loginAs(harness.userAlice);
      const ctx = await harness.sessionManager.resolveActiveContext(session.sessionToken);

      expect(ctx.storeId).toBe(harness.storeA.id);
      expect(ctx.userId).toBe(harness.userAlice.id);
      expect(ctx.role).toBe('STORE_OWNER');
      expect(ctx.authenticatedContext.storeId).toBe(harness.storeA.id);
    });

    it('rejects resolution with invalid or expired session token', async () => {
      await expect(
        harness.sessionManager.resolveActiveContext('invalid-token-xyz'),
      ).rejects.toThrow(SellerUnauthenticatedError);
    });

    it('rejects resolution if store has been suspended', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      // Update storeA to SUSPENDED
      await harness.storeRepo.update(harness.storeA.id, { status: 'SUSPENDED' });

      await expect(
        harness.sessionManager.resolveActiveContext(session.sessionToken),
      ).rejects.toThrow(StoreSuspendedError);
    });

    it('rejects resolution if user membership in store has been removed', async () => {
      const session = await harness.loginAs(harness.userDan, harness.storeA.id);
      // Remove Dan's membership
      await harness.memberRepo.delete(harness.memberDanA.id);

      await expect(
        harness.sessionManager.resolveActiveContext(session.sessionToken),
      ).rejects.toThrow(SellerStoreAccessDeniedError);
    });
  });

  describe('Store Switching', () => {
    it('allows user with multiple store memberships to switch active store', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);
      expect(session.activeStoreId).toBe(harness.storeA.id);
      expect(session.activeRole).toBe('STORE_OWNER');

      const updatedSession = await harness.sessionManager.switchActiveStore(
        session.sessionToken,
        harness.storeB.id,
      );

      expect(updatedSession.activeStoreId).toBe(harness.storeB.id);
      expect(updatedSession.activeRole).toBe('STORE_STAFF');

      // Subsequent resolve reflects Store B
      const ctx = await harness.sessionManager.resolveActiveContext(session.sessionToken);
      expect(ctx.storeId).toBe(harness.storeB.id);
      expect(ctx.role).toBe('STORE_STAFF');
    });

    it('rejects store switch if user is not a member of target store', async () => {
      const session = await harness.loginAs(harness.userBob, harness.storeA.id);

      await expect(
        harness.sessionManager.switchActiveStore(session.sessionToken, harness.storeB.id),
      ).rejects.toThrow(StoreSwitchUnauthorizedError);
    });

    it('rejects store switch if target store is suspended', async () => {
      const session = await harness.loginAs(harness.userAlice, harness.storeA.id);

      await expect(
        harness.sessionManager.switchActiveStore(session.sessionToken, harness.storeC.id),
      ).rejects.toThrow(StoreSuspendedError);
    });
  });

  describe('Session Invalidation & Logout', () => {
    it('invalidates session upon logout', async () => {
      const session = await harness.loginAs(harness.userAlice);
      await harness.sessionManager.invalidateSession(session.sessionToken);

      await expect(
        harness.sessionManager.resolveActiveContext(session.sessionToken),
      ).rejects.toThrow(SellerUnauthenticatedError);
    });
  });
});

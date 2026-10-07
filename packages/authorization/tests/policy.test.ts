import { describe, it, expect } from 'vitest';
import {
  hasStorePermission,
  hasPlatformPermission,
  getPermissionsForStoreRole,
  getPermissionsForPlatformRole,
} from '../src/policy.js';
import { STORE_PERMISSIONS } from '../src/permissions.js';

describe('Role-to-Permission Policy Matrix', () => {
  describe('STORE_OWNER Policy', () => {
    it('grants full store commerce and management permissions to STORE_OWNER', () => {
      const ownerPerms = getPermissionsForStoreRole('STORE_OWNER');
      expect(ownerPerms.size).toBe(STORE_PERMISSIONS.length);

      expect(hasStorePermission('STORE_OWNER', 'products.create')).toBe(true);
      expect(hasStorePermission('STORE_OWNER', 'inventory.update')).toBe(true);
      expect(hasStorePermission('STORE_OWNER', 'staff.remove')).toBe(true);
      expect(hasStorePermission('STORE_OWNER', 'store.settings.update')).toBe(true);
      expect(hasStorePermission('STORE_OWNER', 'subscription.manage')).toBe(true);
    });
  });

  describe('STORE_ADMIN Policy', () => {
    it('grants operational management to STORE_ADMIN but reserves STORE_OWNER exclusives', () => {
      expect(hasStorePermission('STORE_ADMIN', 'products.create')).toBe(true);
      expect(hasStorePermission('STORE_ADMIN', 'products.update')).toBe(true);
      expect(hasStorePermission('STORE_ADMIN', 'orders.refund')).toBe(true);
      expect(hasStorePermission('STORE_ADMIN', 'staff.invite')).toBe(true);
      expect(hasStorePermission('STORE_ADMIN', 'store.settings.update')).toBe(true);
      expect(hasStorePermission('STORE_ADMIN', 'subscription.read')).toBe(true);

      // Dedicated owner permission denied to admin per provisional policy
      expect(hasStorePermission('STORE_ADMIN', 'subscription.manage')).toBe(false);
    });
  });

  describe('STORE_STAFF Policy', () => {
    it('grants limited operational permissions to STORE_STAFF', () => {
      expect(hasStorePermission('STORE_STAFF', 'orders.read')).toBe(true);
      expect(hasStorePermission('STORE_STAFF', 'orders.update')).toBe(true);
      expect(hasStorePermission('STORE_STAFF', 'customers.read')).toBe(true);
      expect(hasStorePermission('STORE_STAFF', 'inventory.read')).toBe(true);
      expect(hasStorePermission('STORE_STAFF', 'fulfillment.read')).toBe(true);
      expect(hasStorePermission('STORE_STAFF', 'fulfillment.process')).toBe(true);
      expect(hasStorePermission('STORE_STAFF', 'fulfillment.complete')).toBe(true);
      expect(hasStorePermission('STORE_STAFF', 'products.read')).toBe(true);
      expect(hasStorePermission('STORE_STAFF', 'vouchers.read')).toBe(true);
    });

    it('strictly denies high-privilege operations to STORE_STAFF', () => {
      // Product mutations
      expect(hasStorePermission('STORE_STAFF', 'products.create')).toBe(false);
      expect(hasStorePermission('STORE_STAFF', 'products.update')).toBe(false);
      expect(hasStorePermission('STORE_STAFF', 'products.delete')).toBe(false);

      // Inventory mutations
      expect(hasStorePermission('STORE_STAFF', 'inventory.update')).toBe(false);

      // Order cancellations & refunds
      expect(hasStorePermission('STORE_STAFF', 'orders.cancel')).toBe(false);
      expect(hasStorePermission('STORE_STAFF', 'orders.refund')).toBe(false);

      // Customer mutations
      expect(hasStorePermission('STORE_STAFF', 'customers.update')).toBe(false);

      // Financials & Payments
      expect(hasStorePermission('STORE_STAFF', 'payments.read')).toBe(false);
      expect(hasStorePermission('STORE_STAFF', 'payments.manage')).toBe(false);

      // Staff administration
      expect(hasStorePermission('STORE_STAFF', 'staff.read')).toBe(false);
      expect(hasStorePermission('STORE_STAFF', 'staff.invite')).toBe(false);
      expect(hasStorePermission('STORE_STAFF', 'staff.update')).toBe(false);
      expect(hasStorePermission('STORE_STAFF', 'staff.remove')).toBe(false);

      // Store settings & channels & subscriptions
      expect(hasStorePermission('STORE_STAFF', 'store.settings.read')).toBe(false);
      expect(hasStorePermission('STORE_STAFF', 'store.settings.update')).toBe(false);
      expect(hasStorePermission('STORE_STAFF', 'analytics.read')).toBe(false);
      expect(hasStorePermission('STORE_STAFF', 'channels.read')).toBe(false);
      expect(hasStorePermission('STORE_STAFF', 'channels.manage')).toBe(false);
      expect(hasStorePermission('STORE_STAFF', 'subscription.read')).toBe(false);
      expect(hasStorePermission('STORE_STAFF', 'subscription.manage')).toBe(false);
    });
  });

  describe('Platform Role Policy', () => {
    it('grants full platform administration to PLATFORM_OWNER', () => {
      expect(hasPlatformPermission('PLATFORM_OWNER', 'platform.system.manage')).toBe(true);
      expect(hasPlatformPermission('PLATFORM_OWNER', 'platform.stores.manage')).toBe(true);
      expect(hasPlatformPermission('PLATFORM_OWNER', 'platform.templates.manage')).toBe(true);
      expect(hasPlatformPermission('PLATFORM_OWNER', 'platform.plans.manage')).toBe(true);
    });

    it('grants administrative permissions to PLATFORM_ADMIN except root system control', () => {
      expect(hasPlatformPermission('PLATFORM_ADMIN', 'platform.stores.read')).toBe(true);
      expect(hasPlatformPermission('PLATFORM_ADMIN', 'platform.stores.manage')).toBe(true);
      expect(hasPlatformPermission('PLATFORM_ADMIN', 'platform.users.read')).toBe(true);
      expect(hasPlatformPermission('PLATFORM_ADMIN', 'platform.templates.manage')).toBe(true);
      expect(hasPlatformPermission('PLATFORM_ADMIN', 'platform.plans.manage')).toBe(true);

      // Root system manage reserved for PLATFORM_OWNER
      expect(hasPlatformPermission('PLATFORM_ADMIN', 'platform.system.manage')).toBe(false);
    });

    it('grants zero platform administration permissions to regular USER', () => {
      const userPerms = getPermissionsForPlatformRole('USER');
      expect(userPerms.size).toBe(0);
      expect(hasPlatformPermission('USER', 'platform.stores.read')).toBe(false);
      expect(hasPlatformPermission('USER', 'platform.system.manage')).toBe(false);
    });
  });
});

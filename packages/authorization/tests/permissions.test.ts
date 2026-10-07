import { describe, it, expect } from 'vitest';
import {
  STORE_PERMISSIONS,
  PLATFORM_PERMISSIONS,
  ALL_PERMISSIONS,
  isStorePermission,
  isPlatformPermission,
  isValidPermission,
} from '../src/permissions.js';

describe('Canonical Permission Catalog', () => {
  it('contains all required store permissions', () => {
    const required = [
      'products.read',
      'products.create',
      'products.update',
      'products.delete',
      'inventory.read',
      'inventory.update',
      'orders.read',
      'orders.update',
      'orders.cancel',
      'orders.refund',
      'customers.read',
      'customers.update',
      'payments.read',
      'payments.manage',
      'vouchers.read',
      'vouchers.manage',
      'staff.read',
      'staff.invite',
      'staff.update',
      'staff.remove',
      'store.settings.read',
      'store.settings.update',
      'analytics.read',
      'channels.read',
      'channels.manage',
      'fulfillment.read',
      'fulfillment.process',
      'fulfillment.complete',
      'subscription.read',
      'subscription.manage',
    ];

    for (const perm of required) {
      expect(STORE_PERMISSIONS).toContain(perm);
      expect(isStorePermission(perm)).toBe(true);
      expect(isValidPermission(perm)).toBe(true);
    }
  });

  it('contains all required platform permissions', () => {
    const requiredPlatform = [
      'platform.analytics.read',
      'platform.stores.read',
      'platform.stores.manage',
      'platform.users.read',
      'platform.users.manage',
      'platform.templates.manage',
      'platform.plans.manage',
      'platform.system.manage',
    ];

    for (const perm of requiredPlatform) {
      expect(PLATFORM_PERMISSIONS).toContain(perm);
      expect(isPlatformPermission(perm)).toBe(true);
      expect(isValidPermission(perm)).toBe(true);
    }
  });

  it('strictly distinguishes store permissions from platform permissions', () => {
    expect(isStorePermission('platform.stores.read')).toBe(false);
    expect(isPlatformPermission('products.read')).toBe(false);
    expect(isValidPermission('unknown.permission.fake')).toBe(false);
  });

  it('guarantees unique permission strings across the entire catalog', () => {
    const unique = new Set(ALL_PERMISSIONS);
    expect(unique.size).toBe(ALL_PERMISSIONS.length);
  });
});

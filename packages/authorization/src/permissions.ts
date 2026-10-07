/**
 * Bintang Tech Studio — Canonical Permission Catalog.
 * Baseline: Master Blueprint v3.0 / Milestone M04.
 */

export const STORE_PERMISSIONS = [
  // Products
  'products.read',
  'products.create',
  'products.update',
  'products.delete',

  // Inventory
  'inventory.read',
  'inventory.update',

  // Orders
  'orders.read',
  'orders.update',
  'orders.cancel',
  'orders.refund',

  // Customers
  'customers.read',
  'customers.update',

  // Payments
  'payments.read',
  'payments.manage',

  // Vouchers
  'vouchers.read',
  'vouchers.manage',

  // Staff / Team Members
  'staff.read',
  'staff.invite',
  'staff.update',
  'staff.remove',

  // Store Settings
  'store.settings.read',
  'store.settings.update',

  // Analytics
  'analytics.read',

  // Channels
  'channels.read',
  'channels.manage',

  // Fulfillment
  'fulfillment.read',
  'fulfillment.process',
  'fulfillment.complete',

  // Subscriptions & Plans
  'subscription.read',
  'subscription.manage',
] as const;

export type StorePermission = (typeof STORE_PERMISSIONS)[number];

export const PLATFORM_PERMISSIONS = [
  'platform.analytics.read',
  'platform.stores.read',
  'platform.stores.manage',
  'platform.users.read',
  'platform.users.manage',
  'platform.templates.manage',
  'platform.plans.manage',
  'platform.system.manage',
] as const;

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

export type Permission = StorePermission | PlatformPermission;

export const ALL_PERMISSIONS = [...STORE_PERMISSIONS, ...PLATFORM_PERMISSIONS] as const;

/**
 * Type guard to check if a string is a valid StorePermission.
 */
export function isStorePermission(permission: string): permission is StorePermission {
  return STORE_PERMISSIONS.includes(permission as StorePermission);
}

/**
 * Type guard to check if a string is a valid PlatformPermission.
 */
export function isPlatformPermission(permission: string): permission is PlatformPermission {
  return PLATFORM_PERMISSIONS.includes(permission as PlatformPermission);
}

/**
 * Type guard to check if a string is any canonical Permission.
 */
export function isValidPermission(permission: string): permission is Permission {
  return isStorePermission(permission) || isPlatformPermission(permission);
}

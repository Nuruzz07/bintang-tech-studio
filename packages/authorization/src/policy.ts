import { StoreRole, PlatformRole } from '@bintang/tenancy';
import {
  StorePermission,
  PlatformPermission,
  STORE_PERMISSIONS,
  PLATFORM_PERMISSIONS,
} from './permissions.js';

/**
 * Provisional M04 Centralized Policy Matrix.
 * Maps Store Roles to their allowed Store Permissions.
 */
const STORE_ROLE_POLICY: Record<StoreRole, ReadonlySet<StorePermission>> = {
  STORE_OWNER: new Set<StorePermission>(STORE_PERMISSIONS),

  STORE_ADMIN: new Set<StorePermission>([
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
    // Note: 'subscription.manage' is reserved for STORE_OWNER per provisional M04 policy
  ]),

  STORE_STAFF: new Set<StorePermission>([
    // Limited operational permissions only
    'products.read',
    'inventory.read',
    'orders.read',
    'orders.update',
    'customers.read',
    'vouchers.read',
    'fulfillment.read',
    'fulfillment.process',
    'fulfillment.complete',
  ]),
};

/**
 * Provisional M04 Centralized Policy Matrix.
 * Maps Platform Roles to their allowed Platform Permissions.
 */
const PLATFORM_ROLE_POLICY: Record<PlatformRole, ReadonlySet<PlatformPermission>> = {
  PLATFORM_OWNER: new Set<PlatformPermission>(PLATFORM_PERMISSIONS),

  PLATFORM_ADMIN: new Set<PlatformPermission>([
    'platform.analytics.read',
    'platform.stores.read',
    'platform.stores.manage',
    'platform.users.read',
    'platform.templates.manage',
    'platform.plans.manage',
    // 'platform.system.manage' is reserved for PLATFORM_OWNER per provisional M04 policy
  ]),

  USER: new Set<PlatformPermission>([]),
};

/**
 * Returns the set of permissions assigned to a given Store Role.
 */
export function getPermissionsForStoreRole(role: StoreRole): ReadonlySet<StorePermission> {
  return STORE_ROLE_POLICY[role] ?? new Set<StorePermission>();
}

/**
 * Returns the set of permissions assigned to a given Platform Role.
 */
export function getPermissionsForPlatformRole(role: PlatformRole): ReadonlySet<PlatformPermission> {
  return PLATFORM_ROLE_POLICY[role] ?? new Set<PlatformPermission>();
}

/**
 * Evaluates whether a Store Role is granted a specific Store Permission.
 */
export function hasStorePermission(role: StoreRole, permission: StorePermission): boolean {
  const allowed = getPermissionsForStoreRole(role);
  return allowed.has(permission);
}

/**
 * Evaluates whether a Platform Role is granted a specific Platform Permission.
 */
export function hasPlatformPermission(role: PlatformRole, permission: PlatformPermission): boolean {
  const allowed = getPermissionsForPlatformRole(role);
  return allowed.has(permission);
}

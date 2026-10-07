/**
 * Bintang Tech Studio — Identity and Tenancy Domain Types and Contracts.
 * Baseline: Master Blueprint v3.0 / Milestone M03.
 */

export const PLATFORM_ROLES = ['PLATFORM_OWNER', 'PLATFORM_ADMIN', 'USER'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const STORE_ROLES = ['STORE_OWNER', 'STORE_ADMIN', 'STORE_STAFF'] as const;
export type StoreRole = (typeof STORE_ROLES)[number];

export const STORE_STATUSES = ['SETUP', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const;
export type StoreStatus = (typeof STORE_STATUSES)[number];

export const MEMBERSHIP_STATUSES = ['INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const PROFILE_STATUSES = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

/**
 * Public profile extending Supabase auth.users with platform identity.
 */
export interface Profile {
  readonly id: string; // References auth.users(id)
  readonly fullName: string | null;
  readonly avatarUrl: string | null;
  readonly platformRole: PlatformRole;
  readonly status: ProfileStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Core tenant boundary representing a merchant store.
 */
export interface Store {
  readonly id: string;
  readonly ownerUserId: string;
  readonly name: string;
  readonly slug: string;
  readonly templateVersionId: string | null;
  readonly status: StoreStatus;
  readonly currency: string;
  readonly settings: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Store membership binding a profile to a store with a role and lifecycle status.
 */
export interface StoreMember {
  readonly id: string;
  readonly storeId: string;
  readonly userId: string;
  readonly role: StoreRole;
  readonly status: MembershipStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Input parameters for creating a new merchant store.
 */
export interface CreateStoreInput {
  readonly ownerUserId: string;
  readonly name: string;
  readonly slug: string;
  readonly templateVersionId?: string | null | undefined;
  readonly currency?: string | undefined;
  readonly settings?: Record<string, unknown> | undefined;
}

/**
 * Input parameters for updating mutable store attributes.
 * Note: ownerUserId is strictly immutable via general update.
 */
export interface UpdateStoreInput {
  readonly name?: string | undefined;
  readonly slug?: string | undefined;
  readonly templateVersionId?: string | null | undefined;
  readonly status?: StoreStatus | undefined;
  readonly currency?: string | undefined;
  readonly settings?: Record<string, unknown> | undefined;
}

/**
 * Input parameters for inviting a new store member.
 */
export interface InviteMemberInput {
  readonly storeId: string;
  readonly userId: string;
  readonly role: StoreRole;
  readonly actorUserId: string;
}

/**
 * Input parameters for dedicated store ownership transfer.
 */
export interface TransferOwnershipInput {
  readonly storeId: string;
  readonly currentOwnerUserId: string;
  readonly targetUserId: string;
}

/**
 * Input parameters for resolving StoreContext.
 */
export interface ResolveStoreContextInput {
  readonly userId: string;
  readonly storeId: string;
  readonly correlationId?: string | undefined;
  readonly requestId?: string | undefined;
}

/**
 * Abstract repository interface for Profile persistence.
 */
export interface ProfileRepository {
  findById(id: string): Promise<Profile | null>;
  create(profile: Omit<Profile, 'createdAt' | 'updatedAt'>): Promise<Profile>;
  update(
    id: string,
    updates: Partial<Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Profile>;
}

/**
 * Abstract repository interface for Store persistence.
 */
export interface StoreRepository {
  findById(id: string): Promise<Store | null>;
  findBySlug(slug: string): Promise<Store | null>;
  findByOwnerUserId(ownerUserId: string): Promise<Store[]>;
  create(store: Omit<Store, 'id' | 'createdAt' | 'updatedAt'>): Promise<Store>;
  update(
    id: string,
    updates: Partial<Omit<Store, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Store>;
  updateOwner(id: string, newOwnerUserId: string): Promise<Store>;
}

/**
 * Abstract repository interface for StoreMember persistence.
 */
export interface StoreMemberRepository {
  findById(id: string): Promise<StoreMember | null>;
  findByStoreAndUser(storeId: string, userId: string): Promise<StoreMember | null>;
  findByStoreId(storeId: string): Promise<StoreMember[]>;
  findByUserId(userId: string): Promise<StoreMember[]>;
  create(member: Omit<StoreMember, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoreMember>;
  update(
    id: string,
    updates: Partial<Omit<StoreMember, 'id' | 'storeId' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<StoreMember>;
  delete(id: string): Promise<boolean>;
}

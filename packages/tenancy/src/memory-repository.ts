import {
  Profile,
  Store,
  StoreMember,
  ProfileRepository,
  StoreRepository,
  StoreMemberRepository,
} from './types.js';
import { ConflictError, NotFoundError } from '@bintang/shared';

/**
 * In-memory Profile repository implementation.
 */
export class InMemoryProfileRepository implements ProfileRepository {
  private readonly profiles = new Map<string, Profile>();

  async findById(id: string): Promise<Profile | null> {
    return this.profiles.get(id) ?? null;
  }

  async create(profile: Omit<Profile, 'createdAt' | 'updatedAt'>): Promise<Profile> {
    if (this.profiles.has(profile.id)) {
      throw new ConflictError(`Profile with id ${profile.id} already exists`);
    }

    const now = new Date().toISOString();
    const newProfile: Profile = {
      ...profile,
      createdAt: now,
      updatedAt: now,
    };
    this.profiles.set(profile.id, newProfile);
    return newProfile;
  }

  async update(
    id: string,
    updates: Partial<Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Profile> {
    const existing = this.profiles.get(id);
    if (!existing) {
      throw new NotFoundError(`Profile with id ${id} not found`);
    }

    const updated: Profile = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.profiles.set(id, updated);
    return updated;
  }

  clear(): void {
    this.profiles.clear();
  }
}

/**
 * In-memory Store repository implementation.
 */
export class InMemoryStoreRepository implements StoreRepository {
  private readonly stores = new Map<string, Store>();

  async findById(id: string): Promise<Store | null> {
    return this.stores.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<Store | null> {
    for (const store of this.stores.values()) {
      if (store.slug.toLowerCase() === slug.toLowerCase()) {
        return store;
      }
    }
    return null;
  }

  async findByOwnerUserId(ownerUserId: string): Promise<Store[]> {
    return Array.from(this.stores.values()).filter((s) => s.ownerUserId === ownerUserId);
  }

  async create(store: Omit<Store, 'id' | 'createdAt' | 'updatedAt'>): Promise<Store> {
    const existingBySlug = await this.findBySlug(store.slug);
    if (existingBySlug) {
      throw new ConflictError(`Store with slug ${store.slug} already exists`);
    }

    const id = `store_${Math.random().toString(36).substring(2, 10)}`;
    const now = new Date().toISOString();
    const newStore: Store = {
      id,
      ...store,
      createdAt: now,
      updatedAt: now,
    };
    this.stores.set(id, newStore);
    return newStore;
  }

  async update(
    id: string,
    updates: Partial<Omit<Store, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Store> {
    const existing = this.stores.get(id);
    if (!existing) {
      throw new NotFoundError(`Store with id ${id} not found`);
    }

    if (updates.slug && updates.slug !== existing.slug) {
      const existingBySlug = await this.findBySlug(updates.slug);
      if (existingBySlug && existingBySlug.id !== id) {
        throw new ConflictError(`Store with slug ${updates.slug} already exists`);
      }
    }

    const updated: Store = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.stores.set(id, updated);
    return updated;
  }

  async updateOwner(id: string, newOwnerUserId: string): Promise<Store> {
    const existing = this.stores.get(id);
    if (!existing) {
      throw new NotFoundError(`Store with id ${id} not found`);
    }

    const updated: Store = {
      ...existing,
      ownerUserId: newOwnerUserId,
      updatedAt: new Date().toISOString(),
    };
    this.stores.set(id, updated);
    return updated;
  }

  clear(): void {
    this.stores.clear();
  }
}

/**
 * In-memory StoreMember repository implementation.
 */
export class InMemoryStoreMemberRepository implements StoreMemberRepository {
  private readonly members = new Map<string, StoreMember>();

  async findById(id: string): Promise<StoreMember | null> {
    return this.members.get(id) ?? null;
  }

  async findByStoreAndUser(storeId: string, userId: string): Promise<StoreMember | null> {
    for (const member of this.members.values()) {
      if (member.storeId === storeId && member.userId === userId) {
        return member;
      }
    }
    return null;
  }

  async findByStoreId(storeId: string): Promise<StoreMember[]> {
    return Array.from(this.members.values()).filter((m) => m.storeId === storeId);
  }

  async findByUserId(userId: string): Promise<StoreMember[]> {
    return Array.from(this.members.values()).filter((m) => m.userId === userId);
  }

  async create(member: Omit<StoreMember, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoreMember> {
    const existing = await this.findByStoreAndUser(member.storeId, member.userId);
    if (existing) {
      throw new ConflictError(
        `User ${member.userId} already has membership in store ${member.storeId}`,
      );
    }

    const id = `sm_${Math.random().toString(36).substring(2, 10)}`;
    const now = new Date().toISOString();
    const newMember: StoreMember = {
      id,
      ...member,
      createdAt: now,
      updatedAt: now,
    };
    this.members.set(id, newMember);
    return newMember;
  }

  async update(
    id: string,
    updates: Partial<Omit<StoreMember, 'id' | 'storeId' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<StoreMember> {
    const existing = this.members.get(id);
    if (!existing) {
      throw new NotFoundError(`StoreMember with id ${id} not found`);
    }

    const updated: StoreMember = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.members.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.members.delete(id);
  }

  clear(): void {
    this.members.clear();
  }
}

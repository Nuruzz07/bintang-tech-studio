import {
  Store,
  StoreMember,
  CreateStoreInput,
  UpdateStoreInput,
  StoreRepository,
  StoreMemberRepository,
  ProfileRepository,
} from './types.js';
import { OwnerInvariantViolationError, TenantNotFoundError } from './errors.js';
import { ValidationError, NotFoundError } from '@bintang/shared';

export interface CreateStoreResult {
  readonly store: Store;
  readonly ownerMembership: StoreMember;
}

export class StoreService {
  constructor(
    private readonly storeRepo: StoreRepository,
    private readonly memberRepo: StoreMemberRepository,
    private readonly profileRepo: ProfileRepository,
  ) {}

  /**
   * Creates a new store and atomically provisions the active STORE_OWNER membership.
   * Status defaults strictly to 'SETUP'.
   */
  async createStore(input: CreateStoreInput): Promise<CreateStoreResult> {
    const ownerUserId = input.ownerUserId?.trim();
    if (!ownerUserId) {
      throw new ValidationError('ownerUserId is required to create a store');
    }

    const name = input.name?.trim();
    if (!name) {
      throw new ValidationError('Store name is required');
    }

    const slug = input.slug?.trim().toLowerCase();
    if (!slug) {
      throw new ValidationError('Store slug is required');
    }

    // Verify owner profile exists and is active
    const ownerProfile = await this.profileRepo.findById(ownerUserId);
    if (!ownerProfile) {
      throw new NotFoundError(`Profile for ownerUserId ${ownerUserId} not found`);
    }
    if (ownerProfile.status !== 'ACTIVE') {
      throw new ValidationError(
        `Owner profile ${ownerUserId} is not ACTIVE (status: ${ownerProfile.status})`,
      );
    }

    // 1. Create the store with default status 'SETUP'
    const store = await this.storeRepo.create({
      ownerUserId,
      name,
      slug,
      templateVersionId: input.templateVersionId ?? null,
      status: 'SETUP',
      currency: input.currency ?? 'IDR',
      settings: input.settings ?? {},
    });

    // 2. Provision the active STORE_OWNER membership
    const ownerMembership = await this.memberRepo.create({
      storeId: store.id,
      userId: ownerUserId,
      role: 'STORE_OWNER',
      status: 'ACTIVE',
    });

    return {
      store,
      ownerMembership,
    };
  }

  /**
   * Retrieves a store by ID.
   */
  async getStoreById(storeId: string): Promise<Store | null> {
    const id = storeId?.trim();
    if (!id) return null;
    return this.storeRepo.findById(id);
  }

  /**
   * Retrieves a store by unique slug.
   */
  async getStoreBySlug(slug: string): Promise<Store | null> {
    const s = slug?.trim();
    if (!s) return null;
    return this.storeRepo.findBySlug(s);
  }

  /**
   * Retrieves all stores owned by a user.
   */
  async getStoresByOwner(ownerUserId: string): Promise<Store[]> {
    return this.storeRepo.findByOwnerUserId(ownerUserId.trim());
  }

  /**
   * Updates store attributes.
   * Strictly blocks direct mutation of ownerUserId (Owner Invariant).
   */
  async updateStore(
    storeId: string,
    updates: UpdateStoreInput & { ownerUserId?: string },
  ): Promise<Store> {
    const existing = await this.storeRepo.findById(storeId);
    if (!existing) {
      throw new TenantNotFoundError(`Store ${storeId} not found`);
    }

    // Direct mutation of ownerUserId is forbidden
    if (updates.ownerUserId !== undefined && updates.ownerUserId !== existing.ownerUserId) {
      throw new OwnerInvariantViolationError(
        'Direct mutation of store owner_user_id is strictly forbidden. Use dedicated owner transfer service.',
      );
    }

    return this.storeRepo.update(storeId, {
      ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
      ...(updates.slug !== undefined ? { slug: updates.slug.trim().toLowerCase() } : {}),
      ...(updates.templateVersionId !== undefined
        ? { templateVersionId: updates.templateVersionId }
        : {}),
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      ...(updates.currency !== undefined ? { currency: updates.currency } : {}),
      ...(updates.settings !== undefined ? { settings: updates.settings } : {}),
    });
  }
}

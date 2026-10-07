import { describe, it, expect, beforeEach } from 'vitest';
import { StoreService } from '../src/store-service.js';
import {
  InMemoryProfileRepository,
  InMemoryStoreRepository,
  InMemoryStoreMemberRepository,
} from '../src/memory-repository.js';
import { OwnerInvariantViolationError, TenantNotFoundError } from '../src/errors.js';
import { ConflictError, NotFoundError, ValidationError } from '@bintang/shared';

describe('Store Service & Invariants', () => {
  let profileRepo: InMemoryProfileRepository;
  let storeRepo: InMemoryStoreRepository;
  let memberRepo: InMemoryStoreMemberRepository;
  let storeService: StoreService;

  const ownerA = 'user_owner_a';
  const ownerB = 'user_owner_b';

  beforeEach(async () => {
    profileRepo = new InMemoryProfileRepository();
    storeRepo = new InMemoryStoreRepository();
    memberRepo = new InMemoryStoreMemberRepository();
    storeService = new StoreService(storeRepo, memberRepo, profileRepo);

    await profileRepo.create({
      id: ownerA,
      fullName: 'Owner Alpha',
      avatarUrl: null,
      platformRole: 'USER',
      status: 'ACTIVE',
    });

    await profileRepo.create({
      id: ownerB,
      fullName: 'Owner Beta',
      avatarUrl: null,
      platformRole: 'USER',
      status: 'ACTIVE',
    });
  });

  it('creates store with default status "SETUP" and auto-provisions active STORE_OWNER membership', async () => {
    const result = await storeService.createStore({
      ownerUserId: ownerA,
      name: 'Alpha Digital Store',
      slug: 'alpha-digital',
      currency: 'IDR',
    });

    expect(result.store.id).toBeDefined();
    expect(result.store.status).toBe('SETUP');
    expect(result.store.ownerUserId).toBe(ownerA);
    expect(result.store.currency).toBe('IDR');

    // Invariant: owner membership was auto-provisioned
    expect(result.ownerMembership).toBeDefined();
    expect(result.ownerMembership.storeId).toBe(result.store.id);
    expect(result.ownerMembership.userId).toBe(ownerA);
    expect(result.ownerMembership.role).toBe('STORE_OWNER');
    expect(result.ownerMembership.status).toBe('ACTIVE');

    // Verify lookup in repositories
    const members = await memberRepo.findByStoreId(result.store.id);
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe('STORE_OWNER');
  });

  it('rejects store creation if owner profile does not exist', async () => {
    await expect(
      storeService.createStore({
        ownerUserId: 'non_existent_owner',
        name: 'Ghost Store',
        slug: 'ghost-store',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('rejects store creation if owner profile is not ACTIVE', async () => {
    await profileRepo.create({
      id: 'suspended_user',
      fullName: 'Suspended Owner',
      avatarUrl: null,
      platformRole: 'USER',
      status: 'SUSPENDED',
    });

    await expect(
      storeService.createStore({
        ownerUserId: 'suspended_user',
        name: 'Suspended Store',
        slug: 'suspended-store',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('enforces unique store slug constraint', async () => {
    await storeService.createStore({
      ownerUserId: ownerA,
      name: 'Store One',
      slug: 'unique-slug',
    });

    await expect(
      storeService.createStore({
        ownerUserId: ownerB,
        name: 'Store Two',
        slug: 'unique-slug',
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('strictly rejects direct mutation of ownerUserId via store update', async () => {
    const { store } = await storeService.createStore({
      ownerUserId: ownerA,
      name: 'Alpha Store',
      slug: 'alpha-patch-test',
    });

    // Attempting direct PATCH / update with different ownerUserId
    await expect(
      storeService.updateStore(store.id, {
        ownerUserId: ownerB,
        name: 'Hacked Store',
      }),
    ).rejects.toThrow(OwnerInvariantViolationError);
  });

  it('allows updating non-owner store attributes', async () => {
    const { store } = await storeService.createStore({
      ownerUserId: ownerA,
      name: 'Alpha Store',
      slug: 'alpha-update-test',
    });

    const updated = await storeService.updateStore(store.id, {
      name: 'Alpha Store Renamed',
      status: 'ACTIVE',
    });

    expect(updated.name).toBe('Alpha Store Renamed');
    expect(updated.status).toBe('ACTIVE');
    expect(updated.ownerUserId).toBe(ownerA); // Unchanged
  });

  it('supports one user owning multiple independent stores', async () => {
    const store1 = await storeService.createStore({
      ownerUserId: ownerA,
      name: 'Owner A - Store 1',
      slug: 'owner-a-store-1',
    });

    const store2 = await storeService.createStore({
      ownerUserId: ownerA,
      name: 'Owner A - Store 2',
      slug: 'owner-a-store-2',
    });

    const stores = await storeService.getStoresByOwner(ownerA);
    expect(stores).toHaveLength(2);
    expect(stores.map((s) => s.id)).toEqual([store1.store.id, store2.store.id]);
  });

  it('throws TenantNotFoundError when updating non-existent store', async () => {
    await expect(
      storeService.updateStore('non_existent_store_id', { name: 'New Name' }),
    ).rejects.toThrow(TenantNotFoundError);
  });
});

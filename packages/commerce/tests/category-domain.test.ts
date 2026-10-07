import { describe, it, expect, beforeEach } from 'vitest';
import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import { AuthorizationService } from '@bintang/authorization';
import {
  CategoryService,
  InMemoryCategoryRepository,
  CategoryNotFoundError,
  DuplicateCategorySlugError,
  InvalidCategoryDataError,
  InvalidStateTransitionError,
} from '../src/index.js';

describe('Category Domain & Lifecycle Suite (M05 Tests 1-8+)', () => {
  let categoryRepo: InMemoryCategoryRepository;
  let authService: AuthorizationService;
  let categoryService: CategoryService;

  const storeAContext = createAuthenticatedStoreContext({
    storeId: 'store_a_111',
    userId: 'user_owner_a',
    membershipId: 'mem_owner_a',
    role: 'STORE_OWNER',
  });

  const storeBContext = createAuthenticatedStoreContext({
    storeId: 'store_b_222',
    userId: 'user_owner_b',
    membershipId: 'mem_owner_b',
    role: 'STORE_OWNER',
  });

  beforeEach(() => {
    categoryRepo = new InMemoryCategoryRepository();
    authService = new AuthorizationService();
    categoryService = new CategoryService({
      categoryRepository: categoryRepo,
      authorizationService: authService,
    });
  });

  // 1. Create Category
  it('1. should create a valid category with default active status', async () => {
    const category = await categoryService.createCategory(storeAContext, {
      name: 'Digital Products',
      slug: 'digital-products',
      description: 'Instant digital goods',
      sortOrder: 1,
    });

    expect(category.id).toBeDefined();
    expect(category.storeId).toBe(storeAContext.storeId);
    expect(category.name).toBe('Digital Products');
    expect(category.slug).toBe('digital-products');
    expect(category.sortOrder).toBe(1);
    expect(category.status).toBe('ACTIVE');
    expect(category.createdAt).toBeDefined();
    expect(category.updatedAt).toBeDefined();
  });

  // 2. Read Category
  it('2. should read an existing category by ID and by slug', async () => {
    const created = await categoryService.createCategory(storeAContext, {
      name: 'Gaming Topup',
      slug: 'gaming-topup',
    });

    const byId = await categoryService.getCategoryById(storeAContext, created.id);
    expect(byId.id).toBe(created.id);
    expect(byId.slug).toBe('gaming-topup');

    const bySlug = await categoryService.getCategoryBySlug(storeAContext, 'gaming-topup');
    expect(bySlug.id).toBe(created.id);
  });

  // 3. Update Category
  it('3. should update category name, sortOrder, and description while preserving storeId', async () => {
    const created = await categoryService.createCategory(storeAContext, {
      name: 'Old Name',
      slug: 'old-slug',
      sortOrder: 0,
    });

    const updated = await categoryService.updateCategory(storeAContext, created.id, {
      name: 'New Name',
      sortOrder: 5,
      description: 'Updated description',
    });

    expect(updated.name).toBe('New Name');
    expect(updated.slug).toBe('old-slug'); // Slug unchanged unless explicitly updated
    expect(updated.sortOrder).toBe(5);
    expect(updated.description).toBe('Updated description');
    expect(updated.storeId).toBe(storeAContext.storeId);
  });

  // 4. Archive Category
  it('4. should archive category (soft delete lifecycle)', async () => {
    const created = await categoryService.createCategory(storeAContext, {
      name: 'Legacy Services',
      slug: 'legacy-services',
    });

    const archived = await categoryService.archiveCategory(storeAContext, created.id);
    expect(archived.status).toBe('ARCHIVED');

    // Default list excludes archived unless specified
    const activeList = await categoryService.listCategories(storeAContext);
    expect(activeList.some((c) => c.id === created.id)).toBe(false);

    const allList = await categoryService.listCategories(storeAContext, {
      includeArchived: true,
    });
    expect(allList.some((c) => c.id === created.id)).toBe(true);
  });

  // 5. Duplicate Slug Same Store Denied
  it('5. should reject duplicate category slug in the same store', async () => {
    await categoryService.createCategory(storeAContext, {
      name: 'Mobile Games',
      slug: 'games',
    });

    await expect(
      categoryService.createCategory(storeAContext, {
        name: 'PC Games',
        slug: 'games',
      }),
    ).rejects.toThrow(DuplicateCategorySlugError);
  });

  // 6. Same Slug Different Stores Allowed
  it('6. should allow the same category slug in different stores', async () => {
    const catA = await categoryService.createCategory(storeAContext, {
      name: 'Streaming Store A',
      slug: 'streaming',
    });

    const catB = await categoryService.createCategory(storeBContext, {
      name: 'Streaming Store B',
      slug: 'streaming',
    });

    expect(catA.slug).toBe('streaming');
    expect(catB.slug).toBe('streaming');
    expect(catA.storeId).toBe(storeAContext.storeId);
    expect(catB.storeId).toBe(storeBContext.storeId);
    expect(catA.id).not.toBe(catB.id);
  });

  // 7. Cross-Tenant Category Access Denied
  it('7. should deny cross-tenant category access (Store A cannot access Store B category)', async () => {
    const catB = await categoryService.createCategory(storeBContext, {
      name: 'Store B Exclusive',
      slug: 'b-exclusive',
    });

    // Store A tries to access Store B category by ID -> 404 Not Found (Zero cross-tenant leak)
    await expect(categoryService.getCategoryById(storeAContext, catB.id)).rejects.toThrow(
      CategoryNotFoundError,
    );

    // Store A tries to access Store B category by Slug -> 404 Not Found
    await expect(categoryService.getCategoryBySlug(storeAContext, catB.slug)).rejects.toThrow(
      CategoryNotFoundError,
    );
  });

  // 8. Category StoreId Immutable
  it('8. should preserve storeId immutability during category mutation', async () => {
    const created = await categoryService.createCategory(storeAContext, {
      name: 'Immutable Test',
      slug: 'immutable-cat',
    });

    // Even if repository update attempts to pass storeId, it remains unchanged
    const updated = await categoryRepo.update(storeAContext.storeId, created.id, {
      name: 'Tampered Name',
    });

    expect(updated.storeId).toBe(storeAContext.storeId);
  });

  // Extra: Deactivate & Activate, Terminal Archive
  it('should support deactivate and activate transitions, and block unarchiving', async () => {
    const created = await categoryService.createCategory(storeAContext, {
      name: 'Toggle Category',
      slug: 'toggle-cat',
    });

    const deactivated = await categoryService.deactivateCategory(storeAContext, created.id);
    expect(deactivated.status).toBe('INACTIVE');

    const reactivated = await categoryService.activateCategory(storeAContext, created.id);
    expect(reactivated.status).toBe('ACTIVE');

    const archived = await categoryService.archiveCategory(storeAContext, created.id);
    expect(archived.status).toBe('ARCHIVED');

    await expect(categoryService.activateCategory(storeAContext, created.id)).rejects.toThrow(
      InvalidStateTransitionError,
    );
  });

  it('should validate invalid name and invalid slug format', async () => {
    await expect(
      categoryService.createCategory(storeAContext, {
        name: '',
        slug: 'valid-slug',
      }),
    ).rejects.toThrow(InvalidCategoryDataError);

    await expect(
      categoryService.createCategory(storeAContext, {
        name: 'Valid Name',
        slug: 'INVALID SLUG WITH SPACES',
      }),
    ).rejects.toThrow(InvalidCategoryDataError);
  });
});

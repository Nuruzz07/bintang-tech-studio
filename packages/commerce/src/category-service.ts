import { AuthenticatedStoreContext, StoreContext } from '@bintang/tenancy';
import { AuthorizationService } from '@bintang/authorization';
import { Category, CreateCategoryInput, UpdateCategoryInput, CategoryFilter } from './types.js';
import { CategoryRepository } from './category-repository.js';
import { CategoryNotFoundError } from './errors.js';
import {
  generateUUID,
  validateCategoryInput,
  validateCategoryStatusTransition,
} from './validation.js';

export interface CategoryServiceOptions {
  readonly categoryRepository: CategoryRepository;
  readonly authorizationService: AuthorizationService;
}

/**
 * Tenant-scoped Category Service enforcing authorization, domain validation, and lifecycle rules.
 */
export class CategoryService {
  private readonly categoryRepo: CategoryRepository;
  private readonly authService: AuthorizationService;

  constructor(options: CategoryServiceOptions) {
    this.categoryRepo = options.categoryRepository;
    this.authService = options.authorizationService;
  }

  /**
   * Creates a new category within the authenticated store context.
   */
  async createCategory(
    context: AuthenticatedStoreContext | StoreContext,
    input: CreateCategoryInput,
  ): Promise<Category> {
    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'products.create',
      targetStoreId: context.storeId,
    });

    const validated = validateCategoryInput(input, false);
    const now = new Date().toISOString();

    const category: Category = {
      id: generateUUID(),
      storeId: context.storeId,
      name: validated.name!,
      slug: validated.slug!,
      description: validated.description ?? null,
      sortOrder: validated.sortOrder ?? 0,
      status: 'ACTIVE',
      metadata: Object.freeze({ ...(input.metadata ?? {}) }),
      createdAt: now,
      updatedAt: now,
    };

    return this.categoryRepo.create(context.storeId, category);
  }

  /**
   * Retrieves a category by ID within the authenticated store boundary.
   */
  async getCategoryById(
    context: AuthenticatedStoreContext | StoreContext,
    categoryId: string,
  ): Promise<Category> {
    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'products.read',
      targetStoreId: context.storeId,
    });

    const category = await this.categoryRepo.findById(context.storeId, categoryId);
    if (!category) {
      throw new CategoryNotFoundError(categoryId);
    }

    return category;
  }

  /**
   * Retrieves a category by slug within the authenticated store boundary.
   */
  async getCategoryBySlug(
    context: AuthenticatedStoreContext | StoreContext,
    slug: string,
  ): Promise<Category> {
    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'products.read',
      targetStoreId: context.storeId,
    });

    const category = await this.categoryRepo.findBySlug(context.storeId, slug);
    if (!category) {
      throw new CategoryNotFoundError(slug);
    }

    return category;
  }

  /**
   * Lists categories for the store.
   */
  async listCategories(
    context: AuthenticatedStoreContext | StoreContext,
    filter?: CategoryFilter,
  ): Promise<readonly Category[]> {
    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'products.read',
      targetStoreId: context.storeId,
    });

    return this.categoryRepo.list(context.storeId, filter);
  }

  /**
   * Updates an existing category within the store.
   */
  async updateCategory(
    context: AuthenticatedStoreContext | StoreContext,
    categoryId: string,
    input: UpdateCategoryInput,
  ): Promise<Category> {
    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'products.update',
      targetStoreId: context.storeId,
    });

    const existing = await this.categoryRepo.findById(context.storeId, categoryId);
    if (!existing) {
      throw new CategoryNotFoundError(categoryId);
    }

    const validated = validateCategoryInput(input, true);

    if (validated.status && validated.status !== existing.status) {
      validateCategoryStatusTransition(existing.status, validated.status);
    }

    return this.categoryRepo.update(context.storeId, categoryId, {
      ...validated,
      ...(input.metadata !== undefined
        ? { metadata: Object.freeze({ ...existing.metadata, ...input.metadata }) }
        : {}),
    });
  }

  /**
   * Archives a category (soft delete).
   */
  async archiveCategory(
    context: AuthenticatedStoreContext | StoreContext,
    categoryId: string,
  ): Promise<Category> {
    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'products.delete',
      targetStoreId: context.storeId,
    });

    const existing = await this.categoryRepo.findById(context.storeId, categoryId);
    if (!existing) {
      throw new CategoryNotFoundError(categoryId);
    }

    validateCategoryStatusTransition(existing.status, 'ARCHIVED');
    return this.categoryRepo.archive(context.storeId, categoryId);
  }

  /**
   * Deactivates a category.
   */
  async deactivateCategory(
    context: AuthenticatedStoreContext | StoreContext,
    categoryId: string,
  ): Promise<Category> {
    return this.updateCategory(context, categoryId, { status: 'INACTIVE' });
  }

  /**
   * Activates a category.
   */
  async activateCategory(
    context: AuthenticatedStoreContext | StoreContext,
    categoryId: string,
  ): Promise<Category> {
    return this.updateCategory(context, categoryId, { status: 'ACTIVE' });
  }
}

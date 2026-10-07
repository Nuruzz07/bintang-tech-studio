import { AuthenticatedStoreContext, StoreContext } from '@bintang/tenancy';
import { AuthorizationService } from '@bintang/authorization';
import { Product, CreateProductInput, UpdateProductInput, ProductFilter } from './types.js';
import { ProductRepository } from './product-repository.js';
import { CategoryRepository } from './category-repository.js';
import {
  ProductNotFoundError,
  CrossTenantCategoryError,
  InvalidProductDataError,
} from './errors.js';
import {
  generateUUID,
  validateProductInput,
  validateProductStatusTransition,
} from './validation.js';

export interface ProductServiceOptions {
  readonly productRepository: ProductRepository;
  readonly categoryRepository: CategoryRepository;
  readonly authorizationService: AuthorizationService;
}

/**
 * Tenant-scoped Product Service enforcing authorization, entitlement quota,
 * domain validation, category-product integrity, and lifecycle rules.
 */
export class ProductService {
  private readonly productRepo: ProductRepository;
  private readonly categoryRepo: CategoryRepository;
  private readonly authService: AuthorizationService;

  constructor(options: ProductServiceOptions) {
    this.productRepo = options.productRepository;
    this.categoryRepo = options.categoryRepository;
    this.authService = options.authorizationService;
  }

  /**
   * Creates a new product within the authenticated store context.
   * Enforces role permission AND subscription product quota entitlement (products.max).
   */
  async createProduct(
    context: AuthenticatedStoreContext | StoreContext,
    input: CreateProductInput,
  ): Promise<Product> {
    // 1. Quota check: Count active (non-archived) products for the store
    const currentCount = await this.productRepo.countProducts(context.storeId, {
      excludeArchived: true,
    });

    // 2. Authorization & Entitlement enforcement
    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'products.create',
      targetStoreId: context.storeId,
      limitCheck: {
        key: 'products.max',
        currentCount,
      },
    });

    // 3. Domain validation
    const validated = validateProductInput(input, false);

    // 4. Category cross-tenant & validity verification
    if (validated.categoryId) {
      const category = await this.categoryRepo.findById(context.storeId, validated.categoryId);
      if (!category) {
        throw new CrossTenantCategoryError(validated.categoryId);
      }
      if (category.status === 'ARCHIVED') {
        throw new InvalidProductDataError('Cannot assign product to an archived category');
      }
    }

    const now = new Date().toISOString();

    const product: Product = {
      id: generateUUID(),
      storeId: context.storeId,
      categoryId: validated.categoryId ?? null,
      name: validated.name!,
      slug: validated.slug!,
      description: validated.description ?? null,
      productType: validated.productType ?? 'DIGITAL',
      price: validated.price!,
      compareAtPrice: validated.compareAtPrice ?? null,
      stockMode: validated.stockMode ?? 'TRACKED',
      status: validated.status ?? 'DRAFT',
      metadata: Object.freeze({ ...(input.metadata ?? {}) }),
      createdAt: now,
      updatedAt: now,
    };

    return this.productRepo.create(context.storeId, product);
  }

  /**
   * Retrieves a product by ID within the authenticated store boundary.
   */
  async getProductById(
    context: AuthenticatedStoreContext | StoreContext,
    productId: string,
  ): Promise<Product> {
    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'products.read',
      targetStoreId: context.storeId,
    });

    const product = await this.productRepo.findById(context.storeId, productId);
    if (!product) {
      throw new ProductNotFoundError(productId);
    }

    return product;
  }

  /**
   * Retrieves a product by slug within the authenticated store boundary.
   */
  async getProductBySlug(
    context: AuthenticatedStoreContext | StoreContext,
    slug: string,
  ): Promise<Product> {
    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'products.read',
      targetStoreId: context.storeId,
    });

    const product = await this.productRepo.findBySlug(context.storeId, slug);
    if (!product) {
      throw new ProductNotFoundError(slug);
    }

    return product;
  }

  /**
   * Lists products for the store.
   */
  async listProducts(
    context: AuthenticatedStoreContext | StoreContext,
    filter?: ProductFilter,
  ): Promise<readonly Product[]> {
    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'products.read',
      targetStoreId: context.storeId,
    });

    return this.productRepo.list(context.storeId, filter);
  }

  /**
   * Updates an existing product within the store.
   * Note: Updating product name does NOT automatically mutate slug.
   */
  async updateProduct(
    context: AuthenticatedStoreContext | StoreContext,
    productId: string,
    input: UpdateProductInput,
  ): Promise<Product> {
    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'products.update',
      targetStoreId: context.storeId,
    });

    const existing = await this.productRepo.findById(context.storeId, productId);
    if (!existing) {
      throw new ProductNotFoundError(productId);
    }

    const validated = validateProductInput(input, true);

    // Validate category association if updated
    if (validated.categoryId !== undefined) {
      if (validated.categoryId !== null) {
        const category = await this.categoryRepo.findById(context.storeId, validated.categoryId);
        if (!category) {
          throw new CrossTenantCategoryError(validated.categoryId);
        }
        if (category.status === 'ARCHIVED') {
          throw new InvalidProductDataError('Cannot assign product to an archived category');
        }
      }
    }

    // Validate status transition if updated
    if (validated.status && validated.status !== existing.status) {
      validateProductStatusTransition(existing.status, validated.status);
    }

    return this.productRepo.update(context.storeId, productId, {
      ...validated,
      ...(input.metadata !== undefined
        ? { metadata: Object.freeze({ ...existing.metadata, ...input.metadata }) }
        : {}),
    });
  }

  /**
   * Archives a product (soft delete).
   * Semantics: products.delete permission authorizes soft-archive.
   */
  async archiveProduct(
    context: AuthenticatedStoreContext | StoreContext,
    productId: string,
  ): Promise<Product> {
    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'products.delete',
      targetStoreId: context.storeId,
    });

    const existing = await this.productRepo.findById(context.storeId, productId);
    if (!existing) {
      throw new ProductNotFoundError(productId);
    }

    validateProductStatusTransition(existing.status, 'ARCHIVED');
    return this.productRepo.archive(context.storeId, productId);
  }

  /**
   * Activates a product (making it live for catalog visibility).
   */
  async activateProduct(
    context: AuthenticatedStoreContext | StoreContext,
    productId: string,
  ): Promise<Product> {
    return this.updateProduct(context, productId, { status: 'ACTIVE' });
  }

  /**
   * Deactivates a product.
   */
  async deactivateProduct(
    context: AuthenticatedStoreContext | StoreContext,
    productId: string,
  ): Promise<Product> {
    return this.updateProduct(context, productId, { status: 'INACTIVE' });
  }

  /**
   * Counts active products for the store.
   */
  async countProducts(
    context: AuthenticatedStoreContext | StoreContext,
    filter?: { readonly excludeArchived?: boolean },
  ): Promise<number> {
    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'products.read',
      targetStoreId: context.storeId,
    });

    return this.productRepo.countProducts(context.storeId, filter);
  }
}

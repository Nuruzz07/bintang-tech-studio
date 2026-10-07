import { AuthenticatedStoreContext, StoreContext } from '@bintang/tenancy';
import { AuthorizationService } from '@bintang/authorization';
import {
  Category,
  CreateCategoryInput,
  UpdateCategoryInput,
  CategoryFilter,
  Product,
  CreateProductInput,
  UpdateProductInput,
  ProductFilter,
} from './types.js';
import { CategoryRepository } from './category-repository.js';
import { ProductRepository } from './product-repository.js';
import { CategoryService } from './category-service.js';
import { ProductService } from './product-service.js';

export interface CatalogServiceOptions {
  readonly categoryRepository: CategoryRepository;
  readonly productRepository: ProductRepository;
  readonly authorizationService: AuthorizationService;
}

/**
 * Unified Catalog Service facade providing a single point of interaction for Catalog operations.
 */
export class CatalogService {
  public readonly categories: CategoryService;
  public readonly products: ProductService;

  constructor(options: CatalogServiceOptions) {
    this.categories = new CategoryService({
      categoryRepository: options.categoryRepository,
      authorizationService: options.authorizationService,
    });
    this.products = new ProductService({
      productRepository: options.productRepository,
      categoryRepository: options.categoryRepository,
      authorizationService: options.authorizationService,
    });
  }

  // --- Category Delegations ---

  createCategory(
    context: AuthenticatedStoreContext | StoreContext,
    input: CreateCategoryInput,
  ): Promise<Category> {
    return this.categories.createCategory(context, input);
  }

  getCategoryById(
    context: AuthenticatedStoreContext | StoreContext,
    categoryId: string,
  ): Promise<Category> {
    return this.categories.getCategoryById(context, categoryId);
  }

  getCategoryBySlug(
    context: AuthenticatedStoreContext | StoreContext,
    slug: string,
  ): Promise<Category> {
    return this.categories.getCategoryBySlug(context, slug);
  }

  listCategories(
    context: AuthenticatedStoreContext | StoreContext,
    filter?: CategoryFilter,
  ): Promise<readonly Category[]> {
    return this.categories.listCategories(context, filter);
  }

  updateCategory(
    context: AuthenticatedStoreContext | StoreContext,
    categoryId: string,
    input: UpdateCategoryInput,
  ): Promise<Category> {
    return this.categories.updateCategory(context, categoryId, input);
  }

  archiveCategory(
    context: AuthenticatedStoreContext | StoreContext,
    categoryId: string,
  ): Promise<Category> {
    return this.categories.archiveCategory(context, categoryId);
  }

  activateCategory(
    context: AuthenticatedStoreContext | StoreContext,
    categoryId: string,
  ): Promise<Category> {
    return this.categories.activateCategory(context, categoryId);
  }

  deactivateCategory(
    context: AuthenticatedStoreContext | StoreContext,
    categoryId: string,
  ): Promise<Category> {
    return this.categories.deactivateCategory(context, categoryId);
  }

  // --- Product Delegations ---

  createProduct(
    context: AuthenticatedStoreContext | StoreContext,
    input: CreateProductInput,
  ): Promise<Product> {
    return this.products.createProduct(context, input);
  }

  getProductById(
    context: AuthenticatedStoreContext | StoreContext,
    productId: string,
  ): Promise<Product> {
    return this.products.getProductById(context, productId);
  }

  getProductBySlug(
    context: AuthenticatedStoreContext | StoreContext,
    slug: string,
  ): Promise<Product> {
    return this.products.getProductBySlug(context, slug);
  }

  listProducts(
    context: AuthenticatedStoreContext | StoreContext,
    filter?: ProductFilter,
  ): Promise<readonly Product[]> {
    return this.products.listProducts(context, filter);
  }

  updateProduct(
    context: AuthenticatedStoreContext | StoreContext,
    productId: string,
    input: UpdateProductInput,
  ): Promise<Product> {
    return this.products.updateProduct(context, productId, input);
  }

  archiveProduct(
    context: AuthenticatedStoreContext | StoreContext,
    productId: string,
  ): Promise<Product> {
    return this.products.archiveProduct(context, productId);
  }

  activateProduct(
    context: AuthenticatedStoreContext | StoreContext,
    productId: string,
  ): Promise<Product> {
    return this.products.activateProduct(context, productId);
  }

  deactivateProduct(
    context: AuthenticatedStoreContext | StoreContext,
    productId: string,
  ): Promise<Product> {
    return this.products.deactivateProduct(context, productId);
  }

  countProducts(
    context: AuthenticatedStoreContext | StoreContext,
    filter?: { readonly excludeArchived?: boolean },
  ): Promise<number> {
    return this.products.countProducts(context, filter);
  }
}

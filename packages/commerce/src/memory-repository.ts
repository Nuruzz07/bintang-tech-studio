import { Category, CategoryFilter, Product, ProductFilter } from './types.js';
import { CategoryRepository } from './category-repository.js';
import { ProductRepository } from './product-repository.js';
import {
  DuplicateCategorySlugError,
  DuplicateProductSlugError,
  CategoryNotFoundError,
  ProductNotFoundError,
} from './errors.js';

/**
 * In-memory Category Repository enforcing store-scoped slug uniqueness and tenant isolation.
 */
export class InMemoryCategoryRepository implements CategoryRepository {
  private readonly categories = new Map<string, Category>();
  private readonly inFlightSlugs = new Set<string>();

  async create(storeId: string, category: Category): Promise<Category> {
    if (category.storeId !== storeId) {
      throw new Error(
        `Category storeId ${category.storeId} does not match repository storeId ${storeId}`,
      );
    }

    const slugKey = `${storeId}:${category.slug.trim().toLowerCase()}`;
    if (this.inFlightSlugs.has(slugKey)) {
      throw new DuplicateCategorySlugError(category.slug);
    }

    for (const cat of this.categories.values()) {
      if (cat.storeId === storeId && cat.slug === category.slug.trim().toLowerCase()) {
        throw new DuplicateCategorySlugError(category.slug);
      }
    }

    this.inFlightSlugs.add(slugKey);
    try {
      this.categories.set(category.id, Object.freeze({ ...category }));
      return this.categories.get(category.id)!;
    } finally {
      this.inFlightSlugs.delete(slugKey);
    }
  }

  async findById(storeId: string, id: string): Promise<Category | null> {
    const category = this.categories.get(id);
    if (!category || category.storeId !== storeId) {
      return null;
    }
    return category;
  }

  async findBySlug(storeId: string, slug: string): Promise<Category | null> {
    const normalizedSlug = slug.trim().toLowerCase();
    for (const cat of this.categories.values()) {
      if (cat.storeId === storeId && cat.slug === normalizedSlug) {
        return cat;
      }
    }
    return null;
  }

  async list(storeId: string, filter?: CategoryFilter): Promise<readonly Category[]> {
    const results: Category[] = [];
    const filterStatuses = filter?.status
      ? Array.isArray(filter.status)
        ? filter.status
        : [filter.status]
      : null;

    for (const cat of this.categories.values()) {
      if (cat.storeId !== storeId) continue;

      if (!filter?.includeArchived && cat.status === 'ARCHIVED') {
        if (!filterStatuses || !filterStatuses.includes('ARCHIVED')) {
          continue;
        }
      }

      if (filterStatuses && !filterStatuses.includes(cat.status)) {
        continue;
      }

      results.push(cat);
    }

    return results.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async update(
    storeId: string,
    id: string,
    data: Partial<Omit<Category, 'id' | 'storeId' | 'createdAt'>>,
  ): Promise<Category> {
    const existing = await this.findById(storeId, id);
    if (!existing) {
      throw new CategoryNotFoundError(id);
    }

    // Check slug uniqueness if slug changed
    if (data.slug && data.slug !== existing.slug) {
      const existingSlug = await this.findBySlug(storeId, data.slug);
      if (existingSlug && existingSlug.id !== id) {
        throw new DuplicateCategorySlugError(data.slug);
      }
    }

    const updated: Category = Object.freeze({
      ...existing,
      ...data,
      id: existing.id,
      storeId: existing.storeId, // Guaranteed immutable
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    });

    this.categories.set(id, updated);
    return updated;
  }

  async archive(storeId: string, id: string): Promise<Category> {
    return this.update(storeId, id, { status: 'ARCHIVED' });
  }

  /**
   * Test utility to reset state.
   */
  clear(): void {
    this.categories.clear();
  }
}

/**
 * In-memory Product Repository enforcing store-scoped slug uniqueness and tenant isolation.
 */
export class InMemoryProductRepository implements ProductRepository {
  private readonly products = new Map<string, Product>();
  private readonly inFlightSlugs = new Set<string>();

  async create(storeId: string, product: Product): Promise<Product> {
    if (product.storeId !== storeId) {
      throw new Error(
        `Product storeId ${product.storeId} does not match repository storeId ${storeId}`,
      );
    }

    const slugKey = `${storeId}:${product.slug.trim().toLowerCase()}`;
    if (this.inFlightSlugs.has(slugKey)) {
      throw new DuplicateProductSlugError(product.slug);
    }

    for (const prod of this.products.values()) {
      if (prod.storeId === storeId && prod.slug === product.slug.trim().toLowerCase()) {
        throw new DuplicateProductSlugError(product.slug);
      }
    }

    this.inFlightSlugs.add(slugKey);
    try {
      this.products.set(product.id, Object.freeze({ ...product }));
      return this.products.get(product.id)!;
    } finally {
      this.inFlightSlugs.delete(slugKey);
    }
  }

  async findById(storeId: string, id: string): Promise<Product | null> {
    const product = this.products.get(id);
    if (!product || product.storeId !== storeId) {
      return null;
    }
    return product;
  }

  async findBySlug(storeId: string, slug: string): Promise<Product | null> {
    const normalizedSlug = slug.trim().toLowerCase();
    for (const prod of this.products.values()) {
      if (prod.storeId === storeId && prod.slug === normalizedSlug) {
        return prod;
      }
    }
    return null;
  }

  async list(storeId: string, filter?: ProductFilter): Promise<readonly Product[]> {
    const results: Product[] = [];
    const filterStatuses = filter?.status
      ? Array.isArray(filter.status)
        ? filter.status
        : [filter.status]
      : null;

    for (const prod of this.products.values()) {
      if (prod.storeId !== storeId) continue;

      if (!filter?.includeArchived && prod.status === 'ARCHIVED') {
        if (!filterStatuses || !filterStatuses.includes('ARCHIVED')) {
          continue;
        }
      }

      if (filterStatuses && !filterStatuses.includes(prod.status)) {
        continue;
      }

      if (filter?.categoryId !== undefined && prod.categoryId !== filter.categoryId) {
        continue;
      }

      if (filter?.productType !== undefined && prod.productType !== filter.productType) {
        continue;
      }

      results.push(prod);
    }

    return results;
  }

  async update(
    storeId: string,
    id: string,
    data: Partial<Omit<Product, 'id' | 'storeId' | 'createdAt'>>,
  ): Promise<Product> {
    const existing = await this.findById(storeId, id);
    if (!existing) {
      throw new ProductNotFoundError(id);
    }

    // Check slug uniqueness if slug changed
    if (data.slug && data.slug !== existing.slug) {
      const existingSlug = await this.findBySlug(storeId, data.slug);
      if (existingSlug && existingSlug.id !== id) {
        throw new DuplicateProductSlugError(data.slug);
      }
    }

    const updated: Product = Object.freeze({
      ...existing,
      ...data,
      id: existing.id,
      storeId: existing.storeId, // Guaranteed immutable
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    });

    this.products.set(id, updated);
    return updated;
  }

  async archive(storeId: string, id: string): Promise<Product> {
    return this.update(storeId, id, { status: 'ARCHIVED' });
  }

  async countProducts(
    storeId: string,
    filter?: { readonly excludeArchived?: boolean },
  ): Promise<number> {
    let count = 0;
    for (const prod of this.products.values()) {
      if (prod.storeId !== storeId) continue;
      if (filter?.excludeArchived && prod.status === 'ARCHIVED') continue;
      count++;
    }
    return count;
  }

  async countProductsByCategoryId(storeId: string, categoryId: string): Promise<number> {
    let count = 0;
    for (const prod of this.products.values()) {
      if (
        prod.storeId === storeId &&
        prod.categoryId === categoryId &&
        prod.status !== 'ARCHIVED'
      ) {
        count++;
      }
    }
    return count;
  }

  /**
   * Test utility to reset state.
   */
  clear(): void {
    this.products.clear();
  }
}

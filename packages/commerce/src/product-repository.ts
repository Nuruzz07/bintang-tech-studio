import { Product, ProductFilter } from './types.js';

/**
 * Tenant-scoped Product Repository contract.
 * All operations require an explicit storeId to enforce tenant boundary isolation.
 */
export interface ProductRepository {
  /**
   * Persists a new product entity scoped to a store.
   */
  create(storeId: string, product: Product): Promise<Product>;

  /**
   * Retrieves a product by ID within a store boundary.
   */
  findById(storeId: string, id: string): Promise<Product | null>;

  /**
   * Retrieves a product by slug within a store boundary.
   */
  findBySlug(storeId: string, slug: string): Promise<Product | null>;

  /**
   * Lists products for a store matching the given filter.
   */
  list(storeId: string, filter?: ProductFilter): Promise<readonly Product[]>;

  /**
   * Updates an existing product within a store.
   * Modifying storeId is strictly prohibited.
   */
  update(
    storeId: string,
    id: string,
    data: Partial<Omit<Product, 'id' | 'storeId' | 'createdAt'>>,
  ): Promise<Product>;

  /**
   * Performs soft deletion / archiving of a product within a store.
   */
  archive(storeId: string, id: string): Promise<Product>;

  /**
   * Counts the number of products for a store (used for quota/entitlement checks).
   */
  countProducts(storeId: string, filter?: { readonly excludeArchived?: boolean }): Promise<number>;

  /**
   * Counts the number of products referencing a specific category within a store.
   */
  countProductsByCategoryId(storeId: string, categoryId: string): Promise<number>;
}

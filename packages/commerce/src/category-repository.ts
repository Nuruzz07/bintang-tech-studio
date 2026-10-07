import { Category, CategoryFilter } from './types.js';

/**
 * Tenant-scoped Category Repository contract.
 * All operations require an explicit storeId to enforce tenant boundary isolation.
 */
export interface CategoryRepository {
  /**
   * Persists a new category entity scoped to a store.
   */
  create(storeId: string, category: Category): Promise<Category>;

  /**
   * Retrieves a category by ID within a store boundary.
   */
  findById(storeId: string, id: string): Promise<Category | null>;

  /**
   * Retrieves a category by slug within a store boundary.
   */
  findBySlug(storeId: string, slug: string): Promise<Category | null>;

  /**
   * Lists categories for a store matching the given filter.
   */
  list(storeId: string, filter?: CategoryFilter): Promise<readonly Category[]>;

  /**
   * Updates an existing category within a store.
   * Modifying storeId is strictly prohibited.
   */
  update(
    storeId: string,
    id: string,
    data: Partial<Omit<Category, 'id' | 'storeId' | 'createdAt'>>,
  ): Promise<Category>;

  /**
   * Performs soft deletion / archiving of a category within a store.
   */
  archive(storeId: string, id: string): Promise<Category>;
}

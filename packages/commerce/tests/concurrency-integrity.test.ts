import { describe, it, expect, beforeEach } from 'vitest';
import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import { AuthorizationService } from '@bintang/authorization';
import {
  ProductService,
  CategoryService,
  CatalogService,
  InMemoryProductRepository,
  InMemoryCategoryRepository,
  DuplicateProductSlugError,
  DuplicateCategorySlugError,
  normalizeMoney,
  compareMoney,
} from '../src/index.js';

describe('Concurrency, Money & Relational Integrity Suite (M05 Tests 39-40+)', () => {
  let productRepo: InMemoryProductRepository;
  let categoryRepo: InMemoryCategoryRepository;
  let authService: AuthorizationService;
  let productService: ProductService;
  let categoryService: CategoryService;
  let catalogService: CatalogService;

  const storeId = 'store_concurrency_test';
  const context = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_concurrency',
    membershipId: 'mem_concurrency',
    role: 'STORE_OWNER',
  });

  beforeEach(() => {
    productRepo = new InMemoryProductRepository();
    categoryRepo = new InMemoryCategoryRepository();
    authService = new AuthorizationService();
    productService = new ProductService({
      productRepository: productRepo,
      categoryRepository: categoryRepo,
      authorizationService: authService,
    });
    categoryService = new CategoryService({
      categoryRepository: categoryRepo,
      authorizationService: authService,
    });
    catalogService = new CatalogService({
      productRepository: productRepo,
      categoryRepository: categoryRepo,
      authorizationService: authService,
    });
  });

  // 39. Duplicate slug concurrent attempts resolve safely
  it('39. should ensure concurrent product creation with the same slug safely allows only one and rejects the other', async () => {
    const p1Promise = productService.createProduct(context, {
      name: 'Concurrent Item One',
      slug: 'race-slug',
      price: '10000.00',
    });

    const p2Promise = productService.createProduct(context, {
      name: 'Concurrent Item Two',
      slug: 'race-slug',
      price: '15000.00',
    });

    const results = await Promise.allSettled([p1Promise, p2Promise]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly one must succeed and one must be rejected with DuplicateProductSlugError
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    if (rejected[0]?.status === 'rejected') {
      expect(rejected[0].reason).toBeInstanceOf(DuplicateProductSlugError);
    }
  });

  it('39b. should ensure concurrent category creation with the same slug safely allows only one', async () => {
    const c1Promise = categoryService.createCategory(context, {
      name: 'Concurrent Cat One',
      slug: 'race-cat-slug',
    });

    const c2Promise = categoryService.createCategory(context, {
      name: 'Concurrent Cat Two',
      slug: 'race-cat-slug',
    });

    const results = await Promise.allSettled([c1Promise, c2Promise]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    if (rejected[0]?.status === 'rejected') {
      expect(rejected[0].reason).toBeInstanceOf(DuplicateCategorySlugError);
    }
  });

  // 40. Store/Category/Product relationship remains tenant-safe
  it('40. should preserve complete relational safety across store, category, and products', async () => {
    // 1. Create 2 categories in the store
    const cat1 = await catalogService.createCategory(context, {
      name: 'Cat Priority 2',
      slug: 'cat-2',
      sortOrder: 2,
    });

    const cat2 = await catalogService.createCategory(context, {
      name: 'Cat Priority 1',
      slug: 'cat-1',
      sortOrder: 1,
    });

    // 2. Listing categories returns them sorted by sortOrder
    const categories = await catalogService.listCategories(context);
    expect(categories[0]?.id).toBe(cat2.id); // sortOrder 1 first
    expect(categories[1]?.id).toBe(cat1.id); // sortOrder 2 second

    // 3. Create products referencing each category
    const prod1 = await catalogService.createProduct(context, {
      name: 'Prod in Cat 1',
      slug: 'prod-in-cat-1',
      categoryId: cat2.id,
      price: '50000.00',
    });

    const prod2 = await catalogService.createProduct(context, {
      name: 'Prod in Cat 2',
      slug: 'prod-in-cat-2',
      categoryId: cat1.id,
      price: '75000.00',
    });

    expect(prod1.categoryId).toBe(cat2.id);
    expect(prod2.categoryId).toBe(cat1.id);

    // 4. Filter products by category
    const cat1Products = await catalogService.listProducts(context, { categoryId: cat2.id });
    expect(cat1Products.length).toBe(1);
    expect(cat1Products[0]?.id).toBe(prod1.id);

    // 5. Archiving category cat1 keeps existing prod2 intact (safe soft lifecycle)
    await catalogService.archiveCategory(context, cat1.id);
    const existingProd = await catalogService.getProductById(context, prod2.id);
    expect(existingProd.categoryId).toBe(cat1.id); // Relational integrity maintained
  });

  // Money Normalization & Financial Invariants
  it('should accurately format and compare authoritative money representations', () => {
    expect(normalizeMoney(50000)).toBe('50000.00');
    expect(normalizeMoney('25000')).toBe('25000.00');
    expect(normalizeMoney('12500.5')).toBe('12500.50');
    expect(normalizeMoney('99.99')).toBe('99.99');
    expect(normalizeMoney(0)).toBe('0.00');

    expect(compareMoney('50000.00', '25000.00')).toBe(1);
    expect(compareMoney('25000.00', '50000.00')).toBe(-1);
    expect(compareMoney('50000.00', '50000.00')).toBe(0);
  });
});

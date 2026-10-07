import { describe, it, expect, beforeEach } from 'vitest';
import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import { AuthorizationService } from '@bintang/authorization';
import {
  ProductService,
  CategoryService,
  InMemoryProductRepository,
  InMemoryCategoryRepository,
  ProductNotFoundError,
  CrossTenantCategoryError,
} from '../src/index.js';

describe('Catalog Multi-Tenant Security & Anti-Leak Suite (M05 Tests 34-38)', () => {
  let productRepo: InMemoryProductRepository;
  let categoryRepo: InMemoryCategoryRepository;
  let authService: AuthorizationService;
  let productService: ProductService;
  let categoryService: CategoryService;

  const storeAContext = createAuthenticatedStoreContext({
    storeId: 'store_alpha_aaa',
    userId: 'user_alpha',
    membershipId: 'mem_alpha',
    role: 'STORE_OWNER',
  });

  const storeBContext = createAuthenticatedStoreContext({
    storeId: 'store_beta_bbb',
    userId: 'user_beta',
    membershipId: 'mem_beta',
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
  });

  // 34. Arbitrary client store_id cannot change StoreContext
  it('34. should ignore arbitrary spoofed store_id in input payload and enforce context storeId', async () => {
    // Authenticated context is for Store A
    // Payload attempts to inject Store B's storeId as a property
    const spoofedInput = {
      name: 'Spoofed Tenant Product',
      slug: 'spoofed-prod',
      price: '10000.00',
      storeId: 'store_beta_bbb', // Injected spoofed storeId
    };

    const created = await productService.createProduct(storeAContext, spoofedInput);

    // Guaranteed created under Store A, never Store B
    expect(created.storeId).toBe(storeAContext.storeId);
    expect(created.storeId).not.toBe('store_beta_bbb');

    // Store B cannot see this product
    const storeBProducts = await productService.listProducts(storeBContext);
    expect(storeBProducts.some((p) => p.id === created.id)).toBe(false);
  });

  // 35. Product ID from another tenant cannot be read
  it('35. should prevent reading a product belonging to another tenant even when knowing the exact ID', async () => {
    // Create product in Store B
    const prodB = await productService.createProduct(storeBContext, {
      name: 'Secret Store B Product',
      slug: 'secret-prod-b',
      price: '99000.00',
    });

    // Store A attempts to read Store B product by exact UUID
    await expect(productService.getProductById(storeAContext, prodB.id)).rejects.toThrow(
      ProductNotFoundError,
    );

    // Store A attempts to read Store B product by slug
    await expect(productService.getProductBySlug(storeAContext, prodB.slug)).rejects.toThrow(
      ProductNotFoundError,
    );
  });

  // 36. Category ID from another tenant cannot be attached
  it('36. should prevent attaching category from another tenant to a product (CrossTenantCategoryError)', async () => {
    // Category belongs to Store B
    const catB = await categoryService.createCategory(storeBContext, {
      name: 'Store B Category',
      slug: 'cat-b',
    });

    // Store A attempts to attach catB to a new product
    await expect(
      productService.createProduct(storeAContext, {
        name: 'Store A Invalid Product',
        slug: 'invalid-prod-cross',
        categoryId: catB.id,
        price: '10000.00',
      }),
    ).rejects.toThrow(CrossTenantCategoryError);
  });

  // 37. Tenant mismatch cannot be bypassed through repository
  it('37. should prevent repository-level bypass when storeId does not match entity storeId', async () => {
    // Directly calling repository with mismatched storeId throws error
    const product = {
      id: 'prod_mismatch_1',
      storeId: 'store_alpha_aaa',
      categoryId: null,
      name: 'Mismatch Product',
      slug: 'mismatch-prod',
      description: null,
      productType: 'DIGITAL' as const,
      price: '10000.00',
      compareAtPrice: null,
      stockMode: 'TRACKED' as const,
      status: 'ACTIVE' as const,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Attempting to persist with storeId 'store_beta_bbb' while entity has 'store_alpha_aaa'
    await expect(productRepo.create('store_beta_bbb', product)).rejects.toThrow(
      /does not match repository storeId/,
    );
  });

  // 38. No public catalog leak across tenants
  it('38. should ensure listing products in Store A returns 0 products from Store B', async () => {
    // Seed 5 products in Store B
    for (let i = 1; i <= 5; i++) {
      await productService.createProduct(storeBContext, {
        name: `Store B Product ${i}`,
        slug: `store-b-prod-${i}`,
        price: '10000.00',
      });
    }

    // Seed 2 products in Store A
    for (let i = 1; i <= 2; i++) {
      await productService.createProduct(storeAContext, {
        name: `Store A Product ${i}`,
        slug: `store-a-prod-${i}`,
        price: '10000.00',
      });
    }

    const listA = await productService.listProducts(storeAContext);
    const listB = await productService.listProducts(storeBContext);

    expect(listA.length).toBe(2);
    expect(listB.length).toBe(5);

    // Verify all items in listA have storeId === storeAContext.storeId
    expect(listA.every((p) => p.storeId === storeAContext.storeId)).toBe(true);
    expect(listB.every((p) => p.storeId === storeBContext.storeId)).toBe(true);
  });
});

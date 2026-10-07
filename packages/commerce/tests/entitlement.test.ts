import { describe, it, expect, beforeEach } from 'vitest';
import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import {
  AuthorizationService,
  InMemoryEntitlementResolver,
  EntitlementDeniedError,
} from '@bintang/authorization';
import {
  ProductService,
  InMemoryProductRepository,
  InMemoryCategoryRepository,
} from '../src/index.js';

describe('Catalog Entitlement & Quota Suite (M05 Tests 29-33)', () => {
  let productRepo: InMemoryProductRepository;
  let categoryRepo: InMemoryCategoryRepository;
  let entitlementResolver: InMemoryEntitlementResolver;
  let authService: AuthorizationService;
  let productService: ProductService;

  const storeId = 'store_entitlement_test';

  const ownerContext = createAuthenticatedStoreContext({
    storeId,
    userId: 'user_owner_quota',
    membershipId: 'mem_owner_quota',
    role: 'STORE_OWNER',
  });

  beforeEach(() => {
    productRepo = new InMemoryProductRepository();
    categoryRepo = new InMemoryCategoryRepository();
    entitlementResolver = new InMemoryEntitlementResolver();
    entitlementResolver.setStoreConfig(storeId, {
      planSlug: 'starter',
      baseEntitlements: { 'products.max': 20 },
    });
    authService = new AuthorizationService(entitlementResolver);
    productService = new ProductService({
      productRepository: productRepo,
      categoryRepository: categoryRepo,
      authorizationService: authService,
    });
  });

  // Helper to seed N active products
  async function seedProducts(count: number): Promise<void> {
    for (let i = 1; i <= count; i++) {
      await productRepo.create(storeId, {
        id: `prod_seed_${i}`,
        storeId,
        categoryId: null,
        name: `Seeded Product ${i}`,
        slug: `seeded-prod-${i}`,
        description: null,
        productType: 'DIGITAL',
        price: '10000.00',
        compareAtPrice: null,
        stockMode: 'TRACKED',
        status: 'ACTIVE',
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // 29. Starter 19/20 allows creation
  it('29. should allow creating the 20th product when store has 19 active products (Starter 19/20)', async () => {
    // Default Starter plan limit is products.max = 20
    await seedProducts(19);

    const countBefore = await productRepo.countProducts(storeId, { excludeArchived: true });
    expect(countBefore).toBe(19);

    const created = await productService.createProduct(ownerContext, {
      name: 'Twentieth Product',
      slug: 'twentieth-prod',
      price: '20000.00',
    });

    expect(created.id).toBeDefined();
    const countAfter = await productRepo.countProducts(storeId, { excludeArchived: true });
    expect(countAfter).toBe(20);
  });

  // 30. Starter 20/20 denies creation
  it('30. should deny creating the 21st product when store has reached 20 active products (Starter 20/20)', async () => {
    await seedProducts(20);

    const currentCount = await productRepo.countProducts(storeId, { excludeArchived: true });
    expect(currentCount).toBe(20);

    await expect(
      productService.createProduct(ownerContext, {
        name: 'Twenty First Product Blocked',
        slug: 'twenty-first-blocked',
        price: '20000.00',
      }),
    ).rejects.toThrow(EntitlementDeniedError);
  });

  // 31. Add-on increased limit works
  it('31. should allow creating beyond 20 products when an add-on extends product limit', async () => {
    // Seed 20 products
    await seedProducts(20);

    // Apply add-on of +50 products: limit becomes 20 + 50 = 70
    entitlementResolver.setStoreConfig(storeId, {
      planSlug: 'starter',
      baseEntitlements: { 'products.max': 20 },
      activeAddons: [
        {
          slug: 'addon_extra_products_50',
          limits: { 'products.max': 50 },
        },
      ],
    });

    const effectiveLimit = await entitlementResolver.getLimit(storeId, 'products.max');
    expect(effectiveLimit).toBe(70);

    // Now creation of 21st product must succeed
    const created = await productService.createProduct(ownerContext, {
      name: 'Twenty First Product With Addon',
      slug: 'twenty-first-addon',
      price: '25000.00',
    });

    expect(created.id).toBeDefined();
    expect(created.name).toBe('Twenty First Product With Addon');
  });

  // 32. Downgrade does not delete existing products
  it('32. should NOT delete existing products when plan is downgraded or limit decreases', async () => {
    // Store had 25 products with an add-on
    await seedProducts(25);

    // Simulate downgrade: remove add-on, limit returns to Starter (20)
    entitlementResolver.setStoreConfig(storeId, {
      planSlug: 'starter',
      baseEntitlements: { 'products.max': 20 },
      activeAddons: [],
    });
    const effectiveLimit = await entitlementResolver.getLimit(storeId, 'products.max');
    expect(effectiveLimit).toBe(20);

    // Verify all 25 products remain intact and accessible
    const allProducts = await productRepo.list(storeId);
    expect(allProducts.length).toBe(25);

    // Reading existing products still works
    const firstProduct = await productService.getProductById(ownerContext, 'prod_seed_1');
    expect(firstProduct.id).toBe('prod_seed_1');
  });

  // 33. Over-limit existing store blocks new creation
  it('33. should block creating NEW products when existing count exceeds downgraded limit', async () => {
    // Store has 25 products from previous plan
    await seedProducts(25);

    // Limit is now 20 (less than 25)
    await expect(
      productService.createProduct(ownerContext, {
        name: 'New Product When Over Limit',
        slug: 'over-limit-prod',
        price: '10000.00',
      }),
    ).rejects.toThrow(EntitlementDeniedError);
  });
});

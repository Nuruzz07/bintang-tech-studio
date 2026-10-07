import { describe, it, expect, beforeEach } from 'vitest';
import { createAuthenticatedStoreContext, createStoreContext } from '@bintang/tenancy';
import {
  AuthorizationService,
  InMemoryEntitlementResolver,
  PermissionDeniedError,
  AuthorizationError,
  UnauthenticatedError,
} from '@bintang/authorization';
import {
  ProductService,
  InMemoryProductRepository,
  InMemoryCategoryRepository,
} from '../src/index.js';

describe('M04 Authorization Integration Suite (M05 Tests 22-28)', () => {
  let productRepo: InMemoryProductRepository;
  let categoryRepo: InMemoryCategoryRepository;
  let entitlementResolver: InMemoryEntitlementResolver;
  let authService: AuthorizationService;
  let productService: ProductService;

  const targetStoreId = 'store_test_999';

  const ownerContext = createAuthenticatedStoreContext({
    storeId: targetStoreId,
    userId: 'user_owner',
    membershipId: 'mem_owner',
    role: 'STORE_OWNER',
  });

  const adminContext = createAuthenticatedStoreContext({
    storeId: targetStoreId,
    userId: 'user_admin',
    membershipId: 'mem_admin',
    role: 'STORE_ADMIN',
  });

  const staffContext = createAuthenticatedStoreContext({
    storeId: targetStoreId,
    userId: 'user_staff',
    membershipId: 'mem_staff',
    role: 'STORE_STAFF',
  });

  beforeEach(() => {
    productRepo = new InMemoryProductRepository();
    categoryRepo = new InMemoryCategoryRepository();
    entitlementResolver = new InMemoryEntitlementResolver();
    entitlementResolver.setStoreConfig(targetStoreId, {
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

  // 22. STORE_OWNER can create product
  it('22. should allow STORE_OWNER to create product', async () => {
    const product = await productService.createProduct(ownerContext, {
      name: 'Owner Product',
      slug: 'owner-product',
      price: '10000.00',
    });

    expect(product.id).toBeDefined();
    expect(product.name).toBe('Owner Product');
  });

  // 23. STORE_ADMIN can create product
  it('23. should allow STORE_ADMIN to create product', async () => {
    const product = await productService.createProduct(adminContext, {
      name: 'Admin Product',
      slug: 'admin-product',
      price: '15000.00',
    });

    expect(product.id).toBeDefined();
    expect(product.name).toBe('Admin Product');
  });

  // 24. STORE_STAFF cannot create product
  it('24. should deny STORE_STAFF from creating product (PermissionDeniedError)', async () => {
    await expect(
      productService.createProduct(staffContext, {
        name: 'Staff Product Attempt',
        slug: 'staff-product',
        price: '20000.00',
      }),
    ).rejects.toThrow(PermissionDeniedError);
  });

  // 25. Unauthorized user denied
  it('25. should deny unauthenticated or missing identity context (UnauthenticatedError)', async () => {
    // Unauthenticated context (missing userId)
    const unauthenticatedContext = createStoreContext({
      storeId: targetStoreId,
    });

    await expect(
      productService.createProduct(unauthenticatedContext, {
        name: 'Unauth Attempt',
        slug: 'unauth-prod',
        price: '10000.00',
      }),
    ).rejects.toThrow(UnauthenticatedError);
  });

  // 26. Cross-tenant access denied
  it('26. should deny cross-tenant store access when context storeId mismatches target', async () => {
    const foreignStoreContext = createAuthenticatedStoreContext({
      storeId: 'store_foreign_888',
      userId: 'user_foreign_owner',
      membershipId: 'mem_foreign_owner',
      role: 'STORE_OWNER',
    });

    // Foreign user creates product in their own store
    const foreignProd = await productService.createProduct(foreignStoreContext, {
      name: 'Foreign Product',
      slug: 'foreign-prod',
      price: '10000.00',
    });

    // Target store owner tries to query foreign product using targetStore context
    await expect(productService.getProductById(ownerContext, foreignProd.id)).rejects.toThrow();
  });

  // 27. Platform role cannot bypass store membership
  it('27. should deny platform role from performing store actions without valid store membership', async () => {
    // Context with non-store role or arbitrary user context
    const regularUserContext = createStoreContext({
      storeId: targetStoreId,
      userId: 'platform_admin_user',
      role: 'USER', // Plain platform user
    });

    await expect(
      productService.createProduct(regularUserContext, {
        name: 'Platform Superuser Bypass Attempt',
        slug: 'platform-bypass',
        price: '10000.00',
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  // 28. Permission + Entitlement both required
  it('28. should require BOTH Role Permission and Plan Entitlement to proceed', async () => {
    // STORE_OWNER has permission, but let's simulate entitlement quota filled
    // Pre-populate 20 products to hit Starter quota
    for (let i = 1; i <= 20; i++) {
      await productRepo.create(targetStoreId, {
        id: `prod_seed_${i}`,
        storeId: targetStoreId,
        categoryId: null,
        name: `Product ${i}`,
        slug: `prod-${i}`,
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

    // Attempting 21st product must be blocked even though user is STORE_OWNER
    await expect(
      productService.createProduct(ownerContext, {
        name: 'Product 21 Over Quota',
        slug: 'prod-21',
        price: '10000.00',
      }),
    ).rejects.toThrow(/Store has reached maximum limit for products.max/);
  });
});

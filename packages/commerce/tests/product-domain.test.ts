import { describe, it, expect, beforeEach } from 'vitest';
import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import { AuthorizationService } from '@bintang/authorization';
import {
  ProductService,
  CategoryService,
  InMemoryProductRepository,
  InMemoryCategoryRepository,
  DuplicateProductSlugError,
  CrossTenantCategoryError,
  InvalidProductDataError,
  InvalidStateTransitionError,
} from '../src/index.js';

describe('Product Domain & Lifecycle Suite (M05 Tests 9-21+)', () => {
  let productRepo: InMemoryProductRepository;
  let categoryRepo: InMemoryCategoryRepository;
  let authService: AuthorizationService;
  let productService: ProductService;
  let categoryService: CategoryService;

  const storeAContext = createAuthenticatedStoreContext({
    storeId: 'store_a_111',
    userId: 'user_owner_a',
    membershipId: 'mem_owner_a',
    role: 'STORE_OWNER',
  });

  const storeBContext = createAuthenticatedStoreContext({
    storeId: 'store_b_222',
    userId: 'user_owner_b',
    membershipId: 'mem_owner_b',
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

  // 9. Create Product
  it('9. should create a valid product with default draft status and normalized price', async () => {
    const product = await productService.createProduct(storeAContext, {
      name: 'Spotify Premium 1 Bulan',
      slug: 'spotify-premium-1m',
      description: 'Akun premium garansi 30 hari',
      productType: 'DIGITAL',
      price: 25000,
      compareAtPrice: 35000,
      stockMode: 'TRACKED',
    });

    expect(product.id).toBeDefined();
    expect(product.storeId).toBe(storeAContext.storeId);
    expect(product.name).toBe('Spotify Premium 1 Bulan');
    expect(product.slug).toBe('spotify-premium-1m');
    expect(product.price).toBe('25000.00'); // Authoritative decimal string
    expect(product.compareAtPrice).toBe('35000.00');
    expect(product.productType).toBe('DIGITAL');
    expect(product.stockMode).toBe('TRACKED');
    expect(product.status).toBe('DRAFT');
  });

  // 10. Read Product
  it('10. should read an existing product by ID and by slug', async () => {
    const created = await productService.createProduct(storeAContext, {
      name: 'Netflix 4K UHD',
      slug: 'netflix-4k',
      price: '45000.00',
    });

    const byId = await productService.getProductById(storeAContext, created.id);
    expect(byId.id).toBe(created.id);
    expect(byId.slug).toBe('netflix-4k');

    const bySlug = await productService.getProductBySlug(storeAContext, 'netflix-4k');
    expect(bySlug.id).toBe(created.id);
  });

  // 11. Update Product
  it('11. should update product name, price, and description while keeping slug unchanged unless specified', async () => {
    const created = await productService.createProduct(storeAContext, {
      name: 'Canva Pro Initial',
      slug: 'canva-pro',
      price: '15000.00',
    });

    const updated = await productService.updateProduct(storeAContext, created.id, {
      name: 'Canva Pro 1 Tahun Lifetime',
      price: '20000.00',
      description: 'Undangan tim resmi',
    });

    expect(updated.name).toBe('Canva Pro 1 Tahun Lifetime');
    expect(updated.slug).toBe('canva-pro'); // Slug preserved
    expect(updated.price).toBe('20000.00');
    expect(updated.description).toBe('Undangan tim resmi');
    expect(updated.storeId).toBe(storeAContext.storeId);
  });

  // 12. Archive Product
  it('12. should archive product (soft delete instead of hard destructive delete)', async () => {
    const created = await productService.createProduct(storeAContext, {
      name: 'Discontinued Product',
      slug: 'discontinued',
      price: '10000.00',
    });

    const archived = await productService.archiveProduct(storeAContext, created.id);
    expect(archived.status).toBe('ARCHIVED');

    // Default list excludes archived
    const activeList = await productService.listProducts(storeAContext);
    expect(activeList.some((p) => p.id === created.id)).toBe(false);

    // List with includeArchived includes it
    const allList = await productService.listProducts(storeAContext, {
      includeArchived: true,
    });
    expect(allList.some((p) => p.id === created.id)).toBe(true);
  });

  // 13. Activate Product
  it('13. should activate product, transitioning from DRAFT to ACTIVE', async () => {
    const created = await productService.createProduct(storeAContext, {
      name: 'Draft Product',
      slug: 'draft-product',
      price: '50000.00',
    });
    expect(created.status).toBe('DRAFT');

    const activated = await productService.activateProduct(storeAContext, created.id);
    expect(activated.status).toBe('ACTIVE');

    const deactivated = await productService.deactivateProduct(storeAContext, created.id);
    expect(deactivated.status).toBe('INACTIVE');
  });

  // 14. Invalid ProductType Denied
  it('14. should deny invalid productType', async () => {
    await expect(
      productService.createProduct(storeAContext, {
        name: 'Invalid Type',
        slug: 'invalid-type',
        price: '10000.00',
        // @ts-expect-error testing invalid enum
        productType: 'SUBSCRIPTION_BOX',
      }),
    ).rejects.toThrow(InvalidProductDataError);
  });

  // 15. Invalid StockMode Denied
  it('15. should deny invalid stockMode', async () => {
    await expect(
      productService.createProduct(storeAContext, {
        name: 'Invalid Stock Mode',
        slug: 'invalid-stock-mode',
        price: '10000.00',
        // @ts-expect-error testing invalid enum
        stockMode: 'INFINITY',
      }),
    ).rejects.toThrow(InvalidProductDataError);
  });

  // 16. Invalid Price Denied
  it('16. should deny invalid or negative price', async () => {
    await expect(
      productService.createProduct(storeAContext, {
        name: 'Negative Price',
        slug: 'neg-price',
        price: -5000,
      }),
    ).rejects.toThrow(InvalidProductDataError);

    await expect(
      productService.createProduct(storeAContext, {
        name: 'Non Numeric Price',
        slug: 'non-num-price',
        price: 'five-thousand',
      }),
    ).rejects.toThrow(InvalidProductDataError);
  });

  // 17. Invalid Slug Denied
  it('17. should deny invalid slug format (uppercase, spaces, special chars)', async () => {
    await expect(
      productService.createProduct(storeAContext, {
        name: 'Product with Bad Slug',
        slug: 'Bad Slug Format!',
        price: '10000.00',
      }),
    ).rejects.toThrow(InvalidProductDataError);

    await expect(
      productService.createProduct(storeAContext, {
        name: 'Product with Underscores',
        slug: 'bad_slug_underscores',
        price: '10000.00',
      }),
    ).rejects.toThrow(InvalidProductDataError);
  });

  // 18. Duplicate Product Slug Same Store Denied
  it('18. should deny duplicate product slug in the same store', async () => {
    await productService.createProduct(storeAContext, {
      name: 'Product One',
      slug: 'duplicate-item',
      price: '10000.00',
    });

    await expect(
      productService.createProduct(storeAContext, {
        name: 'Product Two',
        slug: 'duplicate-item',
        price: '20000.00',
      }),
    ).rejects.toThrow(DuplicateProductSlugError);
  });

  // 19. Same Product Slug Different Stores Allowed
  it('19. should allow the same product slug in different stores', async () => {
    const prodA = await productService.createProduct(storeAContext, {
      name: 'Mobile Legends Diamond Store A',
      slug: 'mlbb-diamond',
      price: '50000.00',
    });

    const prodB = await productService.createProduct(storeBContext, {
      name: 'Mobile Legends Diamond Store B',
      slug: 'mlbb-diamond',
      price: '52000.00',
    });

    expect(prodA.slug).toBe('mlbb-diamond');
    expect(prodB.slug).toBe('mlbb-diamond');
    expect(prodA.storeId).toBe(storeAContext.storeId);
    expect(prodB.storeId).toBe(storeBContext.storeId);
    expect(prodA.id).not.toBe(prodB.id);
  });

  // 20. Category from Another Store Denied
  it('20. should deny assigning category belonging to another store (CrossTenantCategoryError)', async () => {
    // Create category in Store B
    const catB = await categoryService.createCategory(storeBContext, {
      name: 'Store B Category',
      slug: 'store-b-cat',
    });

    // Attempt to create product in Store A referencing Store B's category
    await expect(
      productService.createProduct(storeAContext, {
        name: 'Store A Product With Cross Category',
        slug: 'cross-cat-prod',
        categoryId: catB.id,
        price: '10000.00',
      }),
    ).rejects.toThrow(CrossTenantCategoryError);

    // Attempt to update product in Store A referencing Store B's category
    const validProdA = await productService.createProduct(storeAContext, {
      name: 'Valid Prod A',
      slug: 'valid-prod-a',
      price: '10000.00',
    });

    await expect(
      productService.updateProduct(storeAContext, validProdA.id, {
        categoryId: catB.id,
      }),
    ).rejects.toThrow(CrossTenantCategoryError);
  });

  // 21. Product StoreId Immutable
  it('21. should ensure product storeId is immutable during update', async () => {
    const created = await productService.createProduct(storeAContext, {
      name: 'Immutability Check',
      slug: 'immutable-prod',
      price: '15000.00',
    });

    const updated = await productRepo.update(storeAContext.storeId, created.id, {
      name: 'Tampered Name Attempt',
    });

    expect(updated.storeId).toBe(storeAContext.storeId);
  });

  // Extra: Archived Category Assignment Blocked
  it('should deny assigning an archived category to a product', async () => {
    const catA = await categoryService.createCategory(storeAContext, {
      name: 'Archived Category',
      slug: 'archived-cat',
    });
    await categoryService.archiveCategory(storeAContext, catA.id);

    await expect(
      productService.createProduct(storeAContext, {
        name: 'Product with Archived Category',
        slug: 'prod-archived-cat',
        categoryId: catA.id,
        price: '10000.00',
      }),
    ).rejects.toThrow(InvalidProductDataError);
  });

  // Extra: Terminal Archived Status
  it('should deny transitioning an archived product back to draft or active', async () => {
    const created = await productService.createProduct(storeAContext, {
      name: 'Terminal Product',
      slug: 'terminal-prod',
      price: '10000.00',
    });

    await productService.archiveProduct(storeAContext, created.id);

    await expect(productService.activateProduct(storeAContext, created.id)).rejects.toThrow(
      InvalidStateTransitionError,
    );
  });
});

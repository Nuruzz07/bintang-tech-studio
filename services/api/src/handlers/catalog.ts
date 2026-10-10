import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import { ParsedRequest } from '../router.js';
import { ApiDependencies, ApiResponse } from '../types.js';
import { BadRequestError, NotFoundError } from '../errors.js';

export interface PublicProductView {
  readonly id: string;
  readonly storeId: string;
  readonly categoryId: string | null;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly productType: string;
  readonly price: string;
  readonly compareAtPrice: string | null;
  readonly stockMode: string;
  readonly availableQuantity: number | null;
  readonly isAvailable: boolean;
}

export async function handleListProducts(
  req: ParsedRequest,
  deps: ApiDependencies,
): Promise<ApiResponse<readonly PublicProductView[]>> {
  const storeId = req.params.storeId?.trim();
  if (!storeId) {
    throw new BadRequestError('Missing storeId parameter');
  }

  // 1. Authoritative store validation
  const store = await deps.storeRepo.findById(storeId);
  if (!store || store.status !== 'ACTIVE') {
    throw new NotFoundError(`Store not found or inactive: ${storeId}`);
  }

  const storeContext = createAuthenticatedStoreContext({
    storeId,
    tenantSlug: store.slug || storeId,
    userId: `system:api-catalog:${storeId}`,
    membershipId: `sys_mem_${storeId}`,
    role: 'STORE_ADMIN',
    requestId: req.requestId,
  });

  // 2. Fetch active products for store
  const categoryId = req.searchParams.get('categoryId') || undefined;
  const products = await deps.catalogService.listProducts(storeContext, {
    status: 'ACTIVE',
    ...(categoryId ? { categoryId } : {}),
  });

  // 3. Assemble sanitized public views with real stock availability
  const publicViews: PublicProductView[] = [];
  for (const p of products) {
    let availableQuantity: number | null = null;
    let isAvailable = true;

    if (p.stockMode === 'TRACKED') {
      try {
        const avail = await deps.inventoryService.getAvailability(storeContext, p.id);
        availableQuantity = Number.isFinite(avail.availableQuantity)
          ? Math.max(0, avail.availableQuantity)
          : 0;
        isAvailable = avail.isAvailable;
      } catch {
        availableQuantity = 0;
        isAvailable = false;
      }
    }

    publicViews.push({
      id: p.id,
      storeId: p.storeId,
      categoryId: p.categoryId,
      name: p.name,
      slug: p.slug,
      description: p.description,
      productType: p.productType,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      stockMode: p.stockMode,
      availableQuantity,
      isAvailable,
    });
  }

  return {
    data: publicViews,
    meta: {
      total: publicViews.length,
      storeId,
      currency: store.currency,
    },
  };
}

export async function handleGetProduct(
  req: ParsedRequest,
  deps: ApiDependencies,
): Promise<ApiResponse<PublicProductView>> {
  const storeId = req.params.storeId?.trim();
  const productId = req.params.productId?.trim();

  if (!storeId) {
    throw new BadRequestError('Missing storeId parameter');
  }
  if (!productId) {
    throw new BadRequestError('Missing productId parameter');
  }

  // 1. Authoritative store validation
  const store = await deps.storeRepo.findById(storeId);
  if (!store || store.status !== 'ACTIVE') {
    throw new NotFoundError(`Store not found or inactive: ${storeId}`);
  }

  const storeContext = createAuthenticatedStoreContext({
    storeId,
    tenantSlug: store.slug || storeId,
    userId: `system:api-catalog:${storeId}`,
    membershipId: `sys_mem_${storeId}`,
    role: 'STORE_ADMIN',
    requestId: req.requestId,
  });

  // 2. Fetch product within store boundary
  let product;
  try {
    product = await deps.catalogService.getProductById(storeContext, productId);
  } catch {
    throw new NotFoundError(`Product not found: ${productId}`);
  }

  if (product.storeId !== storeId || product.status !== 'ACTIVE') {
    throw new NotFoundError(`Product not found in store: ${productId}`);
  }

  // 3. Evaluate stock availability
  let availableQuantity: number | null = null;
  let isAvailable = true;

  if (product.stockMode === 'TRACKED') {
    try {
      const avail = await deps.inventoryService.getAvailability(storeContext, product.id);
      availableQuantity = Number.isFinite(avail.availableQuantity)
        ? Math.max(0, avail.availableQuantity)
        : 0;
      isAvailable = avail.isAvailable;
    } catch {
      availableQuantity = 0;
      isAvailable = false;
    }
  }

  return {
    data: {
      id: product.id,
      storeId: product.storeId,
      categoryId: product.categoryId,
      name: product.name,
      slug: product.slug,
      description: product.description,
      productType: product.productType,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      stockMode: product.stockMode,
      availableQuantity,
      isAvailable,
    },
    meta: {
      currency: store.currency,
    },
  };
}

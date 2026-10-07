/**
 * Bintang Tech Studio — Catalog Domain Models & Types.
 * Baseline: Master Blueprint v3.0 / Milestone M05.
 */

export const PRODUCT_TYPES = ['DIGITAL', 'SERVICE', 'PHYSICAL'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const STOCK_MODES = ['UNLIMITED', 'TRACKED'] as const;
export type StockMode = (typeof STOCK_MODES)[number];

export const PRODUCT_STATUSES = ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const CATEGORY_STATUSES = ['ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;
export type CategoryStatus = (typeof CATEGORY_STATUSES)[number];

/**
 * Category domain entity.
 */
export interface Category {
  readonly id: string;
  readonly storeId: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly sortOrder: number;
  readonly status: CategoryStatus;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateCategoryInput {
  readonly name: string;
  readonly slug?: string | undefined;
  readonly description?: string | null | undefined;
  readonly sortOrder?: number | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface UpdateCategoryInput {
  readonly name?: string | undefined;
  readonly slug?: string | undefined;
  readonly description?: string | null | undefined;
  readonly sortOrder?: number | undefined;
  readonly status?: CategoryStatus | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface CategoryFilter {
  readonly status?: CategoryStatus | readonly CategoryStatus[] | undefined;
  readonly includeArchived?: boolean | undefined;
}

/**
 * Product domain entity.
 */
export interface Product {
  readonly id: string;
  readonly storeId: string;
  readonly categoryId: string | null;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly productType: ProductType;
  readonly price: string; // Authoritative NUMERIC(15,2) decimal string representation (e.g. "50000.00")
  readonly compareAtPrice: string | null;
  readonly stockMode: StockMode;
  readonly status: ProductStatus;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateProductInput {
  readonly name: string;
  readonly slug?: string | undefined;
  readonly categoryId?: string | null | undefined;
  readonly description?: string | null | undefined;
  readonly productType?: ProductType | undefined;
  readonly price: string | number;
  readonly compareAtPrice?: string | number | null | undefined;
  readonly stockMode?: StockMode | undefined;
  readonly status?: ProductStatus | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface UpdateProductInput {
  readonly name?: string | undefined;
  readonly slug?: string | undefined;
  readonly categoryId?: string | null | undefined;
  readonly description?: string | null | undefined;
  readonly productType?: ProductType | undefined;
  readonly price?: string | number | undefined;
  readonly compareAtPrice?: string | number | null | undefined;
  readonly stockMode?: StockMode | undefined;
  readonly status?: ProductStatus | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface ProductFilter {
  readonly categoryId?: string | undefined;
  readonly status?: ProductStatus | readonly ProductStatus[] | undefined;
  readonly productType?: ProductType | undefined;
  readonly includeArchived?: boolean | undefined;
}

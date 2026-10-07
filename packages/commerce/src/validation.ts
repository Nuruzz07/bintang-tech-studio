import {
  PRODUCT_TYPES,
  ProductType,
  STOCK_MODES,
  StockMode,
  PRODUCT_STATUSES,
  ProductStatus,
  CATEGORY_STATUSES,
  CategoryStatus,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateProductInput,
  UpdateProductInput,
} from './types.js';
import {
  InvalidCategoryDataError,
  InvalidProductDataError,
  InvalidStateTransitionError,
} from './errors.js';
import { normalizeMoney } from './money.js';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Validates that a slug adheres to strict lowercase kebab-case format.
 */
export function validateSlug(rawSlug: string, resourceType: 'category' | 'product'): string {
  if (typeof rawSlug !== 'string') {
    throw resourceType === 'category'
      ? new InvalidCategoryDataError('Slug must be a string')
      : new InvalidProductDataError('Slug must be a string');
  }

  const slug = rawSlug.trim().toLowerCase();
  if (!slug) {
    throw resourceType === 'category'
      ? new InvalidCategoryDataError('Slug cannot be empty')
      : new InvalidProductDataError('Slug cannot be empty');
  }

  if (slug.length > 100) {
    throw resourceType === 'category'
      ? new InvalidCategoryDataError('Slug cannot exceed 100 characters')
      : new InvalidProductDataError('Slug cannot exceed 100 characters');
  }

  if (!SLUG_REGEX.test(slug)) {
    throw resourceType === 'category'
      ? new InvalidCategoryDataError(
          `Invalid category slug format "${slug}". Slugs must contain only lowercase alphanumeric characters and single hyphens`,
        )
      : new InvalidProductDataError(
          `Invalid product slug format "${slug}". Slugs must contain only lowercase alphanumeric characters and single hyphens`,
        );
  }

  return slug;
}

/**
 * Generates an RFC4122 version 4 UUID string.
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Helper utility to generate a kebab-case slug from a raw string.
 */
export function generateSlug(rawName: string): string {
  const normalized = rawName
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // remove non-word chars
    .replace(/\s+/g, '-') // replace whitespace with hyphens
    .replace(/--+/g, '-') // collapse multiple hyphens
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens

  return normalized || 'item';
}

/**
 * Validates category creation or update input.
 */
export function validateCategoryInput(
  input: CreateCategoryInput | UpdateCategoryInput,
  isUpdate = false,
): {
  name?: string;
  slug?: string;
  description?: string | null;
  sortOrder?: number;
  status?: CategoryStatus;
} {
  const result: {
    name?: string;
    slug?: string;
    description?: string | null;
    sortOrder?: number;
    status?: CategoryStatus;
  } = {};

  if (!isUpdate || input.name !== undefined) {
    if (typeof input.name !== 'string' || !input.name.trim()) {
      throw new InvalidCategoryDataError('Category name is required and cannot be empty');
    }
    const trimmed = input.name.trim();
    if (trimmed.length > 100) {
      throw new InvalidCategoryDataError('Category name cannot exceed 100 characters');
    }
    result.name = trimmed;
  }

  if (input.slug !== undefined) {
    result.slug = validateSlug(input.slug, 'category');
  } else if (!isUpdate && input.name) {
    result.slug = generateSlug(input.name);
  }

  if (input.description !== undefined) {
    result.description = input.description ? input.description.trim() : null;
  }

  if (input.sortOrder !== undefined) {
    if (
      typeof input.sortOrder !== 'number' ||
      !Number.isInteger(input.sortOrder) ||
      input.sortOrder < 0
    ) {
      throw new InvalidCategoryDataError('sortOrder must be a non-negative integer');
    }
    result.sortOrder = input.sortOrder;
  }

  if (isUpdate && 'status' in input && input.status !== undefined) {
    if (!CATEGORY_STATUSES.includes(input.status)) {
      throw new InvalidCategoryDataError(`Invalid category status: ${input.status}`);
    }
    result.status = input.status;
  }

  return result;
}

/**
 * Validates product creation or update input.
 */
export function validateProductInput(
  input: CreateProductInput | UpdateProductInput,
  isUpdate = false,
): {
  name?: string;
  slug?: string;
  categoryId?: string | null;
  description?: string | null;
  productType?: ProductType;
  price?: string;
  compareAtPrice?: string | null;
  stockMode?: StockMode;
  status?: ProductStatus;
} {
  const result: {
    name?: string;
    slug?: string;
    categoryId?: string | null;
    description?: string | null;
    productType?: ProductType;
    price?: string;
    compareAtPrice?: string | null;
    stockMode?: StockMode;
    status?: ProductStatus;
  } = {};

  if (!isUpdate || input.name !== undefined) {
    if (typeof input.name !== 'string' || !input.name.trim()) {
      throw new InvalidProductDataError('Product name is required and cannot be empty');
    }
    const trimmed = input.name.trim();
    if (trimmed.length > 200) {
      throw new InvalidProductDataError('Product name cannot exceed 200 characters');
    }
    result.name = trimmed;
  }

  if (input.slug !== undefined) {
    result.slug = validateSlug(input.slug, 'product');
  } else if (!isUpdate && input.name) {
    result.slug = generateSlug(input.name);
  }

  if (input.categoryId !== undefined) {
    result.categoryId = input.categoryId ? input.categoryId.trim() : null;
  }

  if (input.description !== undefined) {
    result.description = input.description ? input.description.trim() : null;
  }

  if (input.productType !== undefined) {
    if (!PRODUCT_TYPES.includes(input.productType)) {
      throw new InvalidProductDataError(`Invalid productType: ${input.productType}`);
    }
    result.productType = input.productType;
  }

  if (!isUpdate || input.price !== undefined) {
    if (input.price === undefined || input.price === null) {
      throw new InvalidProductDataError('Product price is required');
    }
    result.price = normalizeMoney(input.price, 'price');
  }

  if (input.compareAtPrice !== undefined) {
    if (input.compareAtPrice === null || input.compareAtPrice === '') {
      result.compareAtPrice = null;
    } else {
      result.compareAtPrice = normalizeMoney(input.compareAtPrice, 'compareAtPrice');
    }
  }

  if (input.stockMode !== undefined) {
    if (!STOCK_MODES.includes(input.stockMode)) {
      throw new InvalidProductDataError(`Invalid stockMode: ${input.stockMode}`);
    }
    result.stockMode = input.stockMode;
  }

  if (input.status !== undefined) {
    if (!PRODUCT_STATUSES.includes(input.status)) {
      throw new InvalidProductDataError(`Invalid product status: ${input.status}`);
    }
    result.status = input.status;
  }

  return result;
}

/**
 * Validates Category lifecycle status transitions.
 */
export function validateCategoryStatusTransition(
  currentStatus: CategoryStatus,
  targetStatus: CategoryStatus,
): void {
  if (currentStatus === targetStatus) return;

  if (currentStatus === 'ARCHIVED') {
    throw new InvalidStateTransitionError(
      'category',
      currentStatus,
      targetStatus,
      'Archived categories cannot be transitioned back to active/inactive',
    );
  }

  // ACTIVE <-> INACTIVE and any -> ARCHIVED are allowed
}

/**
 * Validates Product lifecycle status transitions.
 */
export function validateProductStatusTransition(
  currentStatus: ProductStatus,
  targetStatus: ProductStatus,
): void {
  if (currentStatus === targetStatus) return;

  if (currentStatus === 'ARCHIVED') {
    throw new InvalidStateTransitionError(
      'product',
      currentStatus,
      targetStatus,
      'Archived products cannot be transitioned back to draft/active/inactive',
    );
  }

  // DRAFT, ACTIVE, INACTIVE can transition to each other or to ARCHIVED
}

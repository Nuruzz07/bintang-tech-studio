import {
  ApplicationError,
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from '@bintang/shared';

/**
 * Base Catalog Error.
 */
export class CatalogError extends ApplicationError {
  constructor(message: string, code = 'CATALOG_ERROR', statusCode = 400, details?: unknown) {
    super(message, code, statusCode, details);
  }
}

export class CategoryNotFoundError extends NotFoundError {
  constructor(categoryIdOrSlug: string) {
    super(`Category not found: ${categoryIdOrSlug}`, { category: categoryIdOrSlug });
  }
}

export class ProductNotFoundError extends NotFoundError {
  constructor(productIdOrSlug: string) {
    super(`Product not found: ${productIdOrSlug}`, { product: productIdOrSlug });
  }
}

export class DuplicateSlugError extends ConflictError {
  constructor(resourceType: 'category' | 'product', slug: string) {
    super(`A ${resourceType} with slug "${slug}" already exists in this store`, {
      resourceType,
      slug,
    });
  }
}

export class DuplicateCategorySlugError extends DuplicateSlugError {
  constructor(slug: string) {
    super('category', slug);
  }
}

export class DuplicateProductSlugError extends DuplicateSlugError {
  constructor(slug: string) {
    super('product', slug);
  }
}

/**
 * Thrown when attempting to assign or reference a category from another tenant store.
 * Safe error message that never reveals internal cross-tenant data.
 */
export class CrossTenantCategoryError extends ForbiddenError {
  constructor(categoryId: string) {
    super(`Category ${categoryId} does not belong to the current store or does not exist`, {
      categoryId,
    });
  }
}

export class InvalidCategoryDataError extends ValidationError {
  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}

export class InvalidProductDataError extends ValidationError {
  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}

export class InvalidStateTransitionError extends ValidationError {
  constructor(
    entity: 'category' | 'product',
    fromStatus: string,
    toStatus: string,
    reason?: string,
  ) {
    super(
      `Invalid ${entity} status transition from "${fromStatus}" to "${toStatus}"${reason ? `: ${reason}` : ''}`,
      { entity, fromStatus, toStatus },
    );
  }
}

export class ProductQuotaExceededError extends ForbiddenError {
  constructor(currentCount: number, maxLimit: number) {
    super(
      `Store has reached product catalog quota limit of ${maxLimit} products (current: ${currentCount})`,
      { currentCount, maxLimit },
    );
  }
}

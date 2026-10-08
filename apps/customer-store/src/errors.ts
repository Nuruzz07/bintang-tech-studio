/**
 * Bintang Tech Studio — Customer Storefront Typed Domain Errors.
 * Baseline: Milestone M10 Customer Store Migration.
 */

export abstract class CustomerStoreError extends Error {
  public abstract readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class StoreContextResolutionError extends CustomerStoreError {
  public readonly code = 'STORE_CONTEXT_RESOLUTION_ERROR';
  constructor(message: string = 'Could not resolve a valid store context') {
    super(message, 400);
  }
}

export class CustomerSessionError extends CustomerStoreError {
  public readonly code = 'CUSTOMER_SESSION_ERROR';
  constructor(message: string = 'Invalid or expired customer session') {
    super(message, 401);
  }
}

export class CustomerAccessDeniedError extends CustomerStoreError {
  public readonly code = 'CUSTOMER_ACCESS_DENIED';
  constructor(message: string = 'Access denied: resource belongs to another customer or tenant') {
    super(message, 403);
  }
}

export class ProductNotAvailableError extends CustomerStoreError {
  public readonly code = 'PRODUCT_NOT_AVAILABLE';
  constructor(
    productId: string,
    reason: string = 'Product is inactive, archived, or out of stock',
  ) {
    super(`Product "${productId}" is not available: ${reason}`, 404);
  }
}

export class CartValidationError extends CustomerStoreError {
  public readonly code = 'CART_VALIDATION_ERROR';
  public readonly issues: readonly string[];

  constructor(message: string, issues: readonly string[] = []) {
    super(message, 422);
    this.issues = issues;
  }
}

export class CheckoutValidationError extends CustomerStoreError {
  public readonly code = 'CHECKOUT_VALIDATION_ERROR';
  constructor(message: string) {
    super(message, 422);
  }
}

export class PaymentNotAllowedError extends CustomerStoreError {
  public readonly code = 'PAYMENT_NOT_ALLOWED';
  constructor(message: string) {
    super(message, 400);
  }
}

export class CrossTenantAccessError extends CustomerStoreError {
  public readonly code = 'CROSS_TENANT_ACCESS_ERROR';
  constructor(message: string = 'Cross-tenant resource access attempted and rejected') {
    super(message, 403);
  }
}

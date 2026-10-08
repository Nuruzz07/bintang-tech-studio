/**
 * Bintang Tech Studio — Customer Storefront Domain & Application Types.
 * Baseline: Milestone M10 Customer Store Migration.
 */

import type { OrderStatus } from '@bintang/orders';

/**
 * Resolved store context for customer store execution.
 */
export interface ResolvedStoreContext {
  readonly storeId: string;
  readonly storeName: string;
  readonly tenantSlug: string;
  readonly domain?: string | undefined;
  readonly currency: string;
}

/**
 * Customer session identity.
 * Binds a customer strictly to a specific store context.
 */
export interface CustomerSession {
  readonly sessionToken: string;
  readonly storeId: string;
  readonly customerId: string;
  readonly customerName?: string | undefined;
  readonly customerEmail?: string | undefined;
  readonly customerPhone?: string | undefined;
  readonly createdAt: string;
  readonly expiresAt: string;
}

/**
 * Customer-facing category presentation view.
 */
export interface CustomerCategoryView {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly icon?: string | undefined;
  readonly badge?: string | undefined;
}

/**
 * Customer-facing product summary for catalog lists and cards.
 */
export interface CustomerProductView {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly categoryId: string | null;
  readonly categoryName?: string | undefined;
  readonly price: string; // Authoritative decimal string, e.g. "19000.00"
  readonly compareAtPrice: string | null;
  readonly formattedPrice: string; // e.g. "Rp 19.000"
  readonly formattedCompareAtPrice?: string | undefined;
  readonly isAvailable: boolean;
  readonly duration?: string | undefined;
  readonly shortDescription?: string | undefined;
  readonly monogram?: string | undefined;
  readonly badge?: string | undefined;
  readonly rating?: number | undefined;
  readonly soldCount?: number | undefined;
}

/**
 * Customer-facing product detail view including rich marketing and warranty metadata.
 */
export interface CustomerProductDetailView extends CustomerProductView {
  readonly description: string | null;
  readonly benefits: readonly string[];
  readonly importantInfo: string | null;
  readonly stockQuantity: number;
  readonly stockMode: 'UNLIMITED' | 'TRACKED';
}

/**
 * Input item for client cart valuation.
 */
export interface CartItemInput {
  readonly productId: string;
  readonly quantity: number;
}

/**
 * Server-calculated authoritative cart line valuation.
 */
export interface CartValuationLine {
  readonly productId: string;
  readonly productName: string;
  readonly requestedQuantity: number;
  readonly availableQuantity: number;
  readonly unitPrice: string; // Authoritative price from M05 Catalog
  readonly lineTotal: string; // multiplyMoney(unitPrice, requestedQuantity)
  readonly isAvailable: boolean;
  readonly stockIssue?: string | undefined;
}

/**
 * Authoritative cart valuation summary calculated server-side.
 */
export interface CartValuationResult {
  readonly storeId: string;
  readonly currency: string;
  readonly lines: readonly CartValuationLine[];
  readonly subtotal: string;
  readonly discountTotal: string;
  readonly grandTotal: string;
  readonly isValid: boolean;
  readonly validationIssues: readonly string[];
}

/**
 * Input payload for customer checkout.
 */
export interface CustomerCheckoutInput {
  readonly items: readonly CartItemInput[];
  readonly customerName: string;
  readonly customerEmail?: string | undefined;
  readonly customerPhone?: string | undefined;
  readonly idempotencyKey?: string | undefined;
  readonly notes?: string | undefined;
}

/**
 * Result of customer checkout execution.
 */
export interface CustomerCheckoutResult {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly subtotal: string;
  readonly grandTotal: string;
  readonly currency: string;
  readonly createdAt: string;
  readonly items: readonly {
    readonly id: string;
    readonly productId: string | null;
    readonly productName: string;
    readonly quantity: number;
    readonly unitPrice: string;
    readonly subtotal: string;
  }[];
}

/**
 * Input payload for initiating payment on an authoritative order.
 */
export interface InitiatePaymentInput {
  readonly orderId: string;
  readonly idempotencyKey?: string | undefined;
}

/**
 * Customer-facing payment details.
 */
export interface CustomerPaymentResult {
  readonly paymentIntentId: string;
  readonly orderId: string;
  readonly amount: string;
  readonly currency: string;
  readonly status: string;
  readonly provider: string;
  readonly qrPayload?: string | undefined;
  readonly instructions: string;
  readonly expiresAt: string;
}

/**
 * Customer-facing sanitized fulfillment view.
 */
export interface CustomerFulfillmentView {
  readonly id: string;
  readonly orderId: string;
  readonly status: string;
  readonly strategy: string;
  readonly trackingInfo: Readonly<Record<string, unknown>>;
  readonly items: readonly {
    readonly id: string;
    readonly orderItemId: string;
    readonly itemType: string;
    readonly status: string;
    readonly payloadReference: string | null;
  }[];
}

/**
 * Customer order history summary.
 */
export interface CustomerOrderSummaryView {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly grandTotal: string;
  readonly currency: string;
  readonly itemCount: number;
  readonly fulfillmentStatus: string;
  readonly createdAt: string;
}

/**
 * Informational promotional voucher view.
 */
export interface CustomerPromotionalVoucherView {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly badge: string;
  readonly discountText: string;
  readonly status: 'ACTIVE' | 'EXPIRED' | 'MAINTENANCE';
}

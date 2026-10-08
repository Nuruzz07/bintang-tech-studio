/**
 * Bintang Tech Studio — Seller Dashboard Domain & Application Types.
 * Baseline: Milestone M12 Seller Dashboard Foundation.
 */

import type { AuthenticatedStoreContext, StoreRole } from '@bintang/tenancy';
import type { OrderStatus, FulfillmentStatus as OrderFulfillmentStatus } from '@bintang/orders';
import type { FulfillmentStatus } from '@bintang/fulfillment';
import type { PaymentAccountStatus } from '@bintang/payments';

// ============================================================================
// 1. SELLER AUTHENTICATION, MEMBERSHIP & SESSION TYPES
// ============================================================================

export interface SellerUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly isActive: boolean;
}

export interface SellerMembershipSummary {
  readonly membershipId: string;
  readonly storeId: string;
  readonly storeName: string;
  readonly tenantSlug: string;
  readonly role: StoreRole;
  readonly status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
}

export interface SellerSession {
  readonly sessionToken: string;
  readonly userId: string;
  readonly userEmail: string;
  readonly userName: string;
  readonly activeStoreId: string;
  readonly activeRole: StoreRole;
  readonly activeMembershipId: string;
  readonly availableStores: readonly SellerMembershipSummary[];
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface ActiveSellerStoreContext {
  readonly storeId: string;
  readonly storeName: string;
  readonly tenantSlug: string;
  readonly role: StoreRole;
  readonly userId: string;
  readonly membershipId: string;
  readonly currency: string;
  readonly authenticatedContext: AuthenticatedStoreContext;
}

// ============================================================================
// 2. DASHBOARD NAVIGATION SECTIONS
// ============================================================================

export type DashboardSection =
  | 'overview'
  | 'products'
  | 'categories'
  | 'inventory'
  | 'orders'
  | 'customers'
  | 'vouchers'
  | 'payments'
  | 'fulfillment'
  | 'channels'
  | 'team'
  | 'settings'
  | 'subscription';

// ============================================================================
// 3. OVERVIEW DTOs
// ============================================================================

export interface DashboardOverview {
  readonly storeId: string;
  readonly storeName: string;
  readonly currency: string;
  readonly totalOrders: number;
  readonly pendingOrders: number;
  readonly paidOrders: number;
  readonly fulfilledOrders: number;
  readonly grossRevenue: string; // e.g. "1550000.00"
  readonly formattedGrossRevenue: string; // e.g. "Rp 1.550.000"
  readonly lowStockCount: number;
  readonly recentOrders: readonly SellerOrderSummaryView[];
  readonly storeStatus: string;
}

// ============================================================================
// 4. PRODUCTS DTOs
// ============================================================================

export interface SellerProductView {
  readonly id: string;
  readonly storeId: string;
  readonly name: string;
  readonly slug: string;
  readonly categoryId: string | null;
  readonly categoryName?: string | undefined;
  readonly price: string;
  readonly compareAtPrice: string | null;
  readonly formattedPrice: string;
  readonly status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'INACTIVE';
  readonly onHand: number;
  readonly reserved: number;
  readonly availableStock: number;
  readonly description: string | null;
  readonly duration?: string | undefined;
  readonly warranty?: string | undefined;
}

export interface CreateProductInput {
  readonly name: string;
  readonly slug?: string | undefined;
  readonly categoryId?: string | null | undefined;
  readonly price: string;
  readonly compareAtPrice?: string | null | undefined;
  readonly description?: string | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
  readonly initialStock?: number | undefined;
}

export interface UpdateProductInput {
  readonly name?: string | undefined;
  readonly slug?: string | undefined;
  readonly categoryId?: string | null | undefined;
  readonly price?: string | undefined;
  readonly compareAtPrice?: string | null | undefined;
  readonly description?: string | undefined;
  readonly status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

// ============================================================================
// 5. CATEGORIES DTOs
// ============================================================================

export interface SellerCategoryView {
  readonly id: string;
  readonly storeId: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly sortOrder: number;
  readonly isActive: boolean;
  readonly status?: string | undefined;
  readonly productCount?: number | undefined;
}

export interface CreateCategoryInput {
  readonly name: string;
  readonly slug?: string | undefined;
  readonly description?: string | undefined;
  readonly sortOrder?: number | undefined;
}

export interface UpdateCategoryInput {
  readonly name?: string | undefined;
  readonly slug?: string | undefined;
  readonly description?: string | undefined;
  readonly sortOrder?: number | undefined;
  readonly isActive?: boolean | undefined;
}

// ============================================================================
// 6. INVENTORY DTOs
// ============================================================================

export interface SellerInventoryLevelView {
  readonly id: string;
  readonly storeId: string;
  readonly productId: string;
  readonly productName: string;
  readonly onHand: number;
  readonly reserved: number;
  readonly available: number;
  readonly availableStock?: number | undefined;
  readonly lowStockThreshold: number;
  readonly isLowStock: boolean;
  readonly updatedAt: string;
}

export interface StockAdjustmentInput {
  readonly productId: string;
  readonly deltaQuantity: number;
  readonly reason: string;
  readonly idempotencyKey?: string | undefined;
}

export interface SellerInventoryItemSummary {
  readonly totalItems: number;
  readonly availableItems: number;
  readonly reservedItems: number;
  readonly assignedItems: number;
  readonly productId?: string | undefined;
  readonly availableCount?: number | undefined;
  readonly reservedCount?: number | undefined;
  readonly consumedCount?: number | undefined;
}

// ============================================================================
// 7. ORDERS DTOs
// ============================================================================

export interface SellerOrderSummaryView {
  readonly id: string;
  readonly storeId: string;
  readonly orderNumber: string;
  readonly customerId: string;
  readonly customerName?: string | undefined;
  readonly customerEmail?: string | undefined;
  readonly status: OrderStatus;
  readonly subtotal: string;
  readonly discountTotal: string;
  readonly grandTotal: string;
  readonly formattedGrandTotal: string;
  readonly fulfillmentStatus: OrderFulfillmentStatus;
  readonly createdAt: string;
}

export interface SellerOrderItemView {
  readonly id: string;
  readonly productId: string;
  readonly productName: string;
  readonly quantity: number;
  readonly unitPrice: string;
  readonly formattedUnitPrice: string;
  readonly subtotal: string;
  readonly formattedSubtotal: string;
}

export interface SellerOrderDetailView extends SellerOrderSummaryView {
  readonly items: readonly SellerOrderItemView[];
  readonly voucherId: string | null;
  readonly voucherCode?: string | undefined;
}

export interface CancelOrderInput {
  readonly orderId: string;
  readonly reason: string;
}

// ============================================================================
// 8. CUSTOMERS DTOs
// ============================================================================

export interface SellerCustomerSummaryView {
  readonly id: string;
  readonly storeId: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly telegramId: string | null;
  readonly totalOrders: number;
  readonly totalSpent: string;
  readonly formattedTotalSpent: string;
  readonly lastOrderAt: string | null;
  readonly createdAt: string;
}

// ============================================================================
// 9. VOUCHERS DTOs
// ============================================================================

export type VoucherDiscountType = 'PERCENTAGE' | 'FIXED';
export type VoucherStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED';

export interface Voucher {
  readonly id: string;
  readonly storeId: string;
  readonly code: string;
  readonly discountType: VoucherDiscountType;
  readonly discountValue: string;
  readonly minimumPurchase: string;
  readonly maximumDiscount: string | null;
  readonly usageLimit: number | null;
  readonly usedCount: number;
  readonly status: VoucherStatus;
  readonly startsAt: string;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SellerVoucherView {
  readonly id: string;
  readonly storeId: string;
  readonly code: string;
  readonly discountType: VoucherDiscountType;
  readonly discountValue: string;
  readonly formattedDiscount: string;
  readonly minimumPurchase: string;
  readonly formattedMinimumPurchase: string;
  readonly usageLimit: number | null;
  readonly usedCount: number;
  readonly status: VoucherStatus;
  readonly expiresAt: string | null;
}

export interface CreateVoucherInput {
  readonly code: string;
  readonly discountType: VoucherDiscountType;
  readonly discountValue: string;
  readonly minimumPurchase?: string | undefined;
  readonly maximumDiscount?: string | null | undefined;
  readonly usageLimit?: number | null | undefined;
  readonly expiresAt?: string | null | undefined;
}

export interface UpdateVoucherInput {
  readonly discountType?: VoucherDiscountType | undefined;
  readonly discountValue?: string | undefined;
  readonly minimumPurchase?: string | undefined;
  readonly maximumDiscount?: string | null | undefined;
  readonly usageLimit?: number | null | undefined;
  readonly status?: VoucherStatus | undefined;
  readonly expiresAt?: string | null | undefined;
}

// ============================================================================
// 10. PAYMENTS DTOs
// ============================================================================

export interface SellerPaymentAccountView {
  readonly id: string;
  readonly storeId: string;
  readonly provider: string;
  readonly accountIdentifier: string;
  readonly status: PaymentAccountStatus;
  readonly isActive: boolean;
  readonly capabilities: readonly string[];
  readonly createdAt: string;
}

export interface ConfigurePaymentAccountInput {
  readonly provider: string;
  readonly accountIdentifier: string;
  readonly configData?: Readonly<Record<string, unknown>> | undefined;
}

// ============================================================================
// 11. FULFILLMENT DTOs
// ============================================================================

export interface SellerFulfillmentItemView {
  readonly id: string;
  readonly orderItemId: string;
  readonly itemType: string;
  readonly status: string;
  readonly payloadReference: string | null;
}

export interface SellerFulfillmentSummaryView {
  readonly id: string;
  readonly storeId: string;
  readonly orderId: string;
  readonly strategy: string;
  readonly status: FulfillmentStatus;
  readonly trackingInfo?: Readonly<Record<string, unknown>> | undefined;
  readonly failureReason: string | null;
  readonly createdAt: string;
}

export interface SellerFulfillmentDetailView extends SellerFulfillmentSummaryView {
  readonly items: readonly SellerFulfillmentItemView[];
}

export interface ProcessFulfillmentInput {
  readonly action: 'START_PROCESSING' | 'COMPLETE' | 'FAIL';
  readonly trackingMessage?: string | undefined;
  readonly failureReason?: string | undefined;
}

// ============================================================================
// 12. CHANNELS / TELEGRAM DTOs
// ============================================================================

export interface SellerChannelView {
  readonly id: string;
  readonly storeId: string;
  readonly channelType: 'TELEGRAM' | 'WHATSAPP';
  readonly isActive: boolean;
  readonly botUsername?: string | undefined;
  readonly botId?: string | undefined;
  readonly connectedAt?: string | undefined;
}

export interface SellerBotBindingView {
  readonly id: string;
  readonly storeId: string;
  readonly botId: string;
  readonly botUsername?: string | undefined;
  readonly isActive: boolean;
  readonly miniAppUrl?: string | undefined;
  readonly createdAt: string;
}

// ============================================================================
// 13. TEAM / MEMBERS DTOs
// ============================================================================

export interface SellerTeamMemberView {
  readonly membershipId: string;
  readonly storeId: string;
  readonly userId: string;
  readonly userEmail: string;
  readonly userName: string;
  readonly role: StoreRole;
  readonly status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  readonly joinedAt: string;
}

export interface InviteMemberInput {
  readonly email: string;
  readonly name: string;
  readonly role: 'STORE_ADMIN' | 'STORE_STAFF';
}

export interface UpdateMemberRoleInput {
  readonly membershipId: string;
  readonly role: 'STORE_ADMIN' | 'STORE_STAFF';
}

// ============================================================================
// 14. STORE SETTINGS DTOs
// ============================================================================

export interface SellerStoreSettingsView {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly domain: string | null;
  readonly currency: string;
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  readonly createdAt: string;
}

export interface UpdateStoreSettingsInput {
  readonly name?: string | undefined;
  readonly domain?: string | null | undefined;
}

// ============================================================================
// 15. SUBSCRIPTION VISIBILITY DTOs
// ============================================================================

export interface SellerSubscriptionVisibilityView {
  readonly storeId: string;
  readonly planSlug: string;
  readonly planName: string;
  readonly status: 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'EXPIRED';
  readonly productLimit: number;
  readonly currentProducts: number;
  readonly staffLimit: number;
  readonly currentStaff: number;
  readonly telegramAllowed: boolean;
  readonly whatsappAllowed: boolean;
  readonly voucherAllowed: boolean;
  readonly advancedAnalyticsAllowed: boolean;
}

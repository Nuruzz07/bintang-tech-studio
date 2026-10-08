import { AuthenticatedStoreContext, StoreContext } from '@bintang/tenancy';

export const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'FULFILLED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const FULFILLMENT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'FULFILLED',
  'FAILED',
  'MANUAL_REVIEW',
  'CANCELLED',
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

/**
 * Store-scoped Customer Entity.
 * Corresponds to PostgreSQL public.customers table.
 */
export interface Customer {
  readonly id: string;
  readonly storeId: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly telegramId: string | null;
  readonly whatsappNumber: string | null;
  readonly totalOrders: number;
  readonly totalSpent: string;
  readonly lastOrderAt: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Order aggregate root entity.
 * Corresponds to PostgreSQL public.orders table.
 */
export interface Order {
  readonly id: string;
  readonly storeId: string;
  readonly customerId: string;
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly subtotal: string;
  readonly discountTotal: string;
  readonly grandTotal: string;
  readonly currency: string;
  readonly voucherId: string | null;
  readonly fulfillmentStatus: FulfillmentStatus;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Immutable Order Item line snapshot.
 * Corresponds to PostgreSQL public.order_items table.
 * Preserves historical product identity, name, quantity, unit price, and subtotal.
 */
export interface OrderItem {
  readonly id: string;
  readonly storeId: string;
  readonly orderId: string;
  readonly productId: string | null;
  readonly productName: string; // Historical snapshot
  readonly quantity: number;
  readonly unitPrice: string; // Historical price snapshot (NUMERIC(15,2))
  readonly subtotal: string; // Historical line total (NUMERIC(15,2))
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

/**
 * Order entity with embedded items list.
 */
export interface OrderWithItems extends Order {
  readonly items: readonly OrderItem[];
}

/**
 * Input for a single order line item when creating an order.
 */
export interface CreateOrderItemInput {
  readonly productId: string;
  readonly quantity: number;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Input payload for order creation.
 */
export interface CreateOrderInput {
  readonly customerId?: string | undefined;
  readonly items: readonly CreateOrderItemInput[];
  readonly currency?: string | undefined;
  readonly idempotencyKey?: string | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Filter criteria for querying orders.
 */
export interface OrderFilter {
  readonly status?: OrderStatus | readonly OrderStatus[] | undefined;
  readonly customerId?: string | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

/**
 * Customer execution context for customer-facing store interactions.
 */
export interface CustomerContext {
  readonly storeId: string;
  readonly customerId: string;
  readonly name?: string | undefined;
  readonly email?: string | undefined;
}

/**
 * Discriminated union of caller context: Seller (merchant staff/admin/owner) vs Customer.
 */
export type OrderCaller =
  | { readonly type: 'SELLER'; readonly context: AuthenticatedStoreContext | StoreContext }
  | { readonly type: 'CUSTOMER'; readonly context: CustomerContext };

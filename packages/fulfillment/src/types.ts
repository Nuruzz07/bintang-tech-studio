import { AuthenticatedStoreContext, StoreContext } from '@bintang/tenancy';
import { CustomerContext, OrderWithItems } from '@bintang/orders';
import { InventoryItem } from '@bintang/inventory';

export const FULFILLMENT_STRATEGIES = [
  'DIGITAL_AUTO',
  'DIGITAL_MANUAL',
  'SERVICE',
  'PHYSICAL',
] as const;
export type FulfillmentStrategy = (typeof FULFILLMENT_STRATEGIES)[number];

export const FULFILLMENT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'FULFILLED',
  'FAILED',
  'MANUAL_REVIEW',
  'CANCELLED',
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export const FULFILLMENT_ITEM_STATUSES = ['PENDING', 'DELIVERED', 'FAILED', 'REVOKED'] as const;
export type FulfillmentItemStatus = (typeof FULFILLMENT_ITEM_STATUSES)[number];

export const FULFILLMENT_ITEM_TYPES = [
  'CREDENTIAL',
  'LICENSE_KEY',
  'DOWNLOAD_LINK',
  'SERVICE',
  'PHYSICAL',
] as const;
export type FulfillmentItemType = (typeof FULFILLMENT_ITEM_TYPES)[number];

/**
 * Fulfillment aggregate entity.
 * Corresponds to PostgreSQL public.fulfillments table.
 */
export interface Fulfillment {
  readonly id: string;
  readonly storeId: string;
  readonly orderId: string;
  readonly strategy: FulfillmentStrategy;
  readonly status: FulfillmentStatus;
  readonly trackingInfo: Readonly<Record<string, unknown>>;
  readonly failureReason: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Line item belonging to a fulfillment.
 * Corresponds to PostgreSQL public.fulfillment_items table.
 */
export interface FulfillmentItem {
  readonly id: string;
  readonly storeId: string;
  readonly fulfillmentId: string;
  readonly orderItemId: string;
  readonly inventoryItemId: string | null;
  readonly itemType: string;
  readonly status: FulfillmentItemStatus;
  readonly payloadReference: string | null;
  readonly createdAt: string;
}

/**
 * Fulfillment aggregate populated with its line items.
 */
export interface FulfillmentWithItems extends Fulfillment {
  readonly items: readonly FulfillmentItem[];
}

/**
 * Customer-safe projection of FulfillmentItem (sanitizes internal references).
 */
export interface PublicFulfillmentItem {
  readonly id: string;
  readonly orderItemId: string;
  readonly itemType: string;
  readonly status: FulfillmentItemStatus;
  readonly payloadReference: string | null;
  readonly createdAt: string;
}

/**
 * Customer-safe projection of Fulfillment.
 */
export interface PublicFulfillment {
  readonly id: string;
  readonly storeId: string;
  readonly orderId: string;
  readonly strategy: FulfillmentStrategy;
  readonly status: FulfillmentStatus;
  readonly trackingInfo: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly items: readonly PublicFulfillmentItem[];
}

/**
 * Unified caller discrimination.
 */
export type FulfillmentCaller =
  | {
      readonly type: 'SELLER';
      readonly context: AuthenticatedStoreContext | StoreContext;
    }
  | {
      readonly type: 'CUSTOMER';
      readonly context: CustomerContext;
    };

export interface FulfillmentFilter {
  readonly orderId?: string | undefined;
  readonly status?: FulfillmentStatus | undefined;
  readonly strategy?: FulfillmentStrategy | undefined;
}

export interface CreateFulfillmentInput {
  readonly orderId: string;
  readonly strategy?: FulfillmentStrategy | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
  readonly idempotencyKey?: string | undefined;
}

export interface ExecuteFulfillmentInput {
  readonly fulfillmentId: string;
  readonly providerName?: string | undefined;
  readonly manualPayloads?: Readonly<Record<string, string>> | undefined; // orderItemId -> payloadReference
  readonly idempotencyKey?: string | undefined;
}

export interface RetryFulfillmentInput {
  readonly fulfillmentId: string;
  readonly reason?: string | undefined;
  readonly idempotencyKey?: string | undefined;
}

export interface FulfillmentProviderCapabilities {
  readonly autoDelivery: boolean;
  readonly retryable: boolean;
  readonly verification: boolean;
}

export interface FulfillmentDeliveryInput {
  readonly fulfillment: Fulfillment;
  readonly order: OrderWithItems;
  readonly items: readonly FulfillmentItem[];
  readonly assignedInventoryItems?: readonly InventoryItem[] | undefined;
  readonly manualPayloads?: Readonly<Record<string, string>> | undefined;
}

export interface FulfillmentDeliverySuccess {
  readonly success: true;
  readonly providerReference: string;
  readonly deliveryPayloads: Readonly<Record<string, string>>; // orderItemId -> payloadReference
  readonly trackingInfo?: Readonly<Record<string, unknown>> | undefined;
  readonly deliveredAt: string;
}

export interface FulfillmentDeliveryFailure {
  readonly success: false;
  readonly failureCode: string;
  readonly failureReason: string;
  readonly retryable: boolean;
}

export type FulfillmentDeliveryResult = FulfillmentDeliverySuccess | FulfillmentDeliveryFailure;

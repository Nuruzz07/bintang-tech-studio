import { StockMode } from '@bintang/commerce';

/**
 * Inventory aggregate entity for a product.
 * Corresponds to PostgreSQL public.inventory table.
 */
export interface Inventory {
  readonly id: string;
  readonly storeId: string;
  readonly productId: string;
  readonly quantityOnHand: number;
  readonly quantityReserved: number;
  readonly updatedAt: string;
}

export const INVENTORY_ITEM_STATUSES = [
  'AVAILABLE',
  'RESERVED',
  'ASSIGNED',
  'EXPIRED',
  'INVALID',
] as const;
export type InventoryItemStatus = (typeof INVENTORY_ITEM_STATUSES)[number];

/**
 * Individual single-use credential/asset item entity.
 * Corresponds to PostgreSQL public.inventory_items table.
 */
export interface InventoryItem {
  readonly id: string;
  readonly storeId: string;
  readonly productId: string;
  readonly inventoryId: string | null;
  readonly itemType: string;
  readonly secretReference: string;
  readonly status: InventoryItemStatus;
  readonly reservedOrderId: string | null;
  readonly assignedOrderId: string | null;
  readonly reservedAt: string | null;
  readonly reservedUntil: string | null;
  readonly assignedAt: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Inventory availability snapshot for a product.
 */
export interface InventoryAvailability {
  readonly productId: string;
  readonly storeId: string;
  readonly stockMode: StockMode;
  readonly quantityOnHand: number;
  readonly quantityReserved: number;
  readonly availableQuantity: number;
  readonly isAvailable: boolean;
}

export type StockAdjustmentType = 'INCREASE' | 'DECREASE' | 'SET';

export interface AdjustStockInput {
  readonly type: StockAdjustmentType;
  readonly quantity: number;
  readonly reason?: string | undefined;
}

export interface ReserveStockInput {
  readonly amount: number;
  readonly orderId?: string | undefined;
  readonly leaseSeconds?: number | undefined;
}

export interface ReleaseStockInput {
  readonly amount: number;
  readonly orderId?: string | undefined;
}

export interface ConsumeStockInput {
  readonly amount: number;
  readonly fromReserved: boolean;
  readonly orderId?: string | undefined;
}

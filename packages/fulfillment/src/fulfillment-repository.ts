import {
  Fulfillment,
  FulfillmentItem,
  FulfillmentWithItems,
  FulfillmentStatus,
  FulfillmentFilter,
} from './types.js';

export interface UpdateFulfillmentStatusPatch {
  readonly failureReason?: string | null | undefined;
  readonly trackingInfo?: Readonly<Record<string, unknown>> | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

export interface FulfillmentRepository {
  /**
   * Creates a fulfillment record and its line items.
   * Enforces storeId consistency and uniqueness constraints.
   */
  create(
    storeId: string,
    fulfillment: Fulfillment,
    items: readonly FulfillmentItem[],
  ): Promise<FulfillmentWithItems>;

  /**
   * Finds a fulfillment by its id within store boundaries.
   */
  findById(storeId: string, id: string): Promise<FulfillmentWithItems | null>;

  /**
   * Finds all fulfillments for a specific order.
   */
  findByOrderId(storeId: string, orderId: string): Promise<readonly FulfillmentWithItems[]>;

  /**
   * Finds an active or completed fulfillment for an order (PENDING, PROCESSING, or FULFILLED).
   */
  findActiveByOrderId(storeId: string, orderId: string): Promise<FulfillmentWithItems | null>;

  /**
   * Updates fulfillment status and optional metadata/tracking info.
   * Enforces state machine transitions.
   */
  updateStatus(
    storeId: string,
    id: string,
    targetStatus: FulfillmentStatus,
    patch?: UpdateFulfillmentStatusPatch | undefined,
  ): Promise<FulfillmentWithItems>;

  /**
   * Lists fulfillments matching filter within store boundaries.
   */
  list(
    storeId: string,
    filter?: FulfillmentFilter | undefined,
  ): Promise<readonly FulfillmentWithItems[]>;
}

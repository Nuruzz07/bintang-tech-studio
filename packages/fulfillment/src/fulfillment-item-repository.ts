import { FulfillmentItem, FulfillmentItemStatus } from './types.js';

export interface UpdateFulfillmentItemPatch {
  readonly status?: FulfillmentItemStatus | undefined;
  readonly payloadReference?: string | null | undefined;
  readonly inventoryItemId?: string | null | undefined;
}

export interface FulfillmentItemRepository {
  /**
   * Finds a fulfillment item by its id within store boundaries.
   */
  findById(storeId: string, id: string): Promise<FulfillmentItem | null>;

  /**
   * Lists items belonging to a fulfillment.
   */
  listByFulfillmentId(storeId: string, fulfillmentId: string): Promise<readonly FulfillmentItem[]>;

  /**
   * Updates a fulfillment item's delivery payload or status.
   */
  updateItem(
    storeId: string,
    id: string,
    patch: UpdateFulfillmentItemPatch,
  ): Promise<FulfillmentItem>;
}

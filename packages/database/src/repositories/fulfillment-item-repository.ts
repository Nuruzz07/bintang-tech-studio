import {
  FulfillmentItem,
  FulfillmentItemRepository,
  FulfillmentItemStatus,
  UpdateFulfillmentItemPatch,
} from '@bintang/fulfillment';
import { PostgrestClient } from '../client.js';
import { DbFulfillmentItem } from '../types.js';

function toDomain(row: DbFulfillmentItem): FulfillmentItem {
  return {
    id: row.id,
    storeId: row.store_id,
    fulfillmentId: row.fulfillment_id,
    orderItemId: row.order_item_id,
    inventoryItemId: row.inventory_item_id,
    itemType: 'CREDENTIAL',
    status: row.status as FulfillmentItemStatus,
    payloadReference: row.delivered_credential_reference,
    createdAt: row.created_at,
  };
}

export class SupabaseFulfillmentItemRepository implements FulfillmentItemRepository {
  private readonly client: PostgrestClient;

  constructor(client: PostgrestClient) {
    this.client = client;
  }

  async findById(storeId: string, id: string): Promise<FulfillmentItem | null> {
    const row = await this.client
      .from<DbFulfillmentItem>('fulfillment_items')
      .select('*')
      .eq('store_id', storeId)
      .eq('id', id)
      .maybeSingle();
    return row ? toDomain(row) : null;
  }

  async listByFulfillmentId(
    storeId: string,
    fulfillmentId: string,
  ): Promise<readonly FulfillmentItem[]> {
    const rows = await this.client
      .from<DbFulfillmentItem>('fulfillment_items')
      .select('*')
      .eq('store_id', storeId)
      .eq('fulfillment_id', fulfillmentId)
      .execute();
    return Object.freeze(rows.map(toDomain));
  }

  async updateItem(
    storeId: string,
    id: string,
    patch: UpdateFulfillmentItemPatch,
  ): Promise<FulfillmentItem> {
    const updatePayload: Partial<DbFulfillmentItem> = {};
    if (patch.status !== undefined) updatePayload.status = patch.status;
    if (patch.payloadReference !== undefined)
      updatePayload.delivered_credential_reference = patch.payloadReference;
    if (patch.inventoryItemId !== undefined)
      updatePayload.inventory_item_id = patch.inventoryItemId;

    const rows = await this.client
      .from<DbFulfillmentItem>('fulfillment_items')
      .eq('store_id', storeId)
      .eq('id', id)
      .update(updatePayload);

    const row = rows[0];
    if (!row) {
      throw new Error(`Fulfillment item ${id} not found for update`);
    }
    return toDomain(row);
  }
}

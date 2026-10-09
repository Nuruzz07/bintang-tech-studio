import {
  Fulfillment,
  FulfillmentItem,
  FulfillmentWithItems,
  FulfillmentStatus,
  FulfillmentStrategy,
  FulfillmentItemStatus,
  FulfillmentFilter,
  FulfillmentRepository,
  UpdateFulfillmentStatusPatch,
} from '@bintang/fulfillment';
import { PostgrestClient } from '../client.js';
import { DbFulfillment, DbFulfillmentItem } from '../types.js';
import { isMissingRpcError } from '../errors.js';

function toDomainFulfillment(row: DbFulfillment): Fulfillment {
  const metadata = (row.delivery_payload?.['metadata'] as Record<string, unknown>) ?? {};
  const trackingInfo = (row.delivery_payload?.['trackingInfo'] as Record<string, unknown>) ?? {};
  const failureReason = (row.delivery_payload?.['failureReason'] as string) ?? null;

  return {
    id: row.id,
    storeId: row.store_id,
    orderId: row.order_id,
    strategy: row.fulfillment_type as FulfillmentStrategy,
    status: row.status as FulfillmentStatus,
    trackingInfo,
    failureReason,
    metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDomainItem(row: DbFulfillmentItem): FulfillmentItem {
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

export class SupabaseFulfillmentRepository implements FulfillmentRepository {
  private readonly client: PostgrestClient;

  constructor(client: PostgrestClient) {
    this.client = client;
  }

  async create(
    storeId: string,
    fulfillment: Fulfillment,
    items: readonly FulfillmentItem[],
    consumeStock = false,
  ): Promise<FulfillmentWithItems> {
    const deliveryPayload = {
      trackingInfo: fulfillment.trackingInfo,
      failureReason: fulfillment.failureReason,
      metadata: fulfillment.metadata,
    };

    const fulfillmentPayload: Partial<DbFulfillment> = {
      id: fulfillment.id,
      store_id: storeId,
      order_id: fulfillment.orderId,
      status: fulfillment.status,
      fulfillment_type: fulfillment.strategy,
      delivery_payload: deliveryPayload,
    };

    const itemPayloads: Partial<DbFulfillmentItem>[] = items.map((item) => ({
      id: item.id,
      fulfillment_id: fulfillment.id,
      store_id: storeId,
      order_item_id: item.orderItemId,
      product_id: '',
      inventory_item_id: item.inventoryItemId,
      status: item.status,
      delivered_credential_reference: item.payloadReference,
    }));

    try {
      const res = await this.client.rpc<{
        fulfillment: DbFulfillment;
        items: DbFulfillmentItem[];
      }>('rpc_create_fulfillment_atomic', {
        p_store_id: storeId,
        p_fulfillment: fulfillmentPayload,
        p_items: itemPayloads,
        p_consume_stock: consumeStock,
      });

      if (res?.fulfillment) {
        return {
          ...toDomainFulfillment(res.fulfillment),
          items: Object.freeze((res.items ?? []).map(toDomainItem)),
        };
      }
    } catch (err: unknown) {
      if (!isMissingRpcError(err)) {
        throw err;
      }
      // Mock / fallback path
    }

    const insertedFulfillments = await this.client
      .from<DbFulfillment>('fulfillments')
      .insert(fulfillmentPayload);
    const fulfillmentRow = insertedFulfillments[0];
    if (!fulfillmentRow) {
      throw new Error('Failed to insert fulfillment: empty response');
    }

    let itemRows: readonly DbFulfillmentItem[] = [];
    if (itemPayloads.length > 0) {
      itemRows = await this.client
        .from<DbFulfillmentItem>('fulfillment_items')
        .insert(itemPayloads);
    }

    return {
      ...toDomainFulfillment(fulfillmentRow),
      items: Object.freeze(itemRows.map(toDomainItem)),
    };
  }

  async findById(storeId: string, id: string): Promise<FulfillmentWithItems | null> {
    const fulfillmentRow = await this.client
      .from<DbFulfillment>('fulfillments')
      .select('*')
      .eq('store_id', storeId)
      .eq('id', id)
      .maybeSingle();

    if (!fulfillmentRow) return null;

    const itemRows = await this.client
      .from<DbFulfillmentItem>('fulfillment_items')
      .select('*')
      .eq('store_id', storeId)
      .eq('fulfillment_id', id)
      .execute();

    return {
      ...toDomainFulfillment(fulfillmentRow),
      items: Object.freeze(itemRows.map(toDomainItem)),
    };
  }

  async findByOrderId(storeId: string, orderId: string): Promise<readonly FulfillmentWithItems[]> {
    const fulfillmentRows = await this.client
      .from<DbFulfillment>('fulfillments')
      .select('*')
      .eq('store_id', storeId)
      .eq('order_id', orderId)
      .execute();

    if (fulfillmentRows.length === 0) return Object.freeze([]);

    const fulfillmentIds = fulfillmentRows.map((r) => r.id);
    const itemRows = await this.client
      .from<DbFulfillmentItem>('fulfillment_items')
      .select('*')
      .eq('store_id', storeId)
      .in('fulfillment_id', fulfillmentIds)
      .execute();

    const itemsByFulfillment = new Map<string, DbFulfillmentItem[]>();
    for (const item of itemRows) {
      const existing = itemsByFulfillment.get(item.fulfillment_id) ?? [];
      existing.push(item);
      itemsByFulfillment.set(item.fulfillment_id, existing);
    }

    const result = fulfillmentRows.map((row) => {
      const items = itemsByFulfillment.get(row.id) ?? [];
      return {
        ...toDomainFulfillment(row),
        items: Object.freeze(items.map(toDomainItem)),
      };
    });

    return Object.freeze(result);
  }

  async findActiveByOrderId(
    storeId: string,
    orderId: string,
  ): Promise<FulfillmentWithItems | null> {
    const fulfillments = await this.findByOrderId(storeId, orderId);
    return (
      fulfillments.find(
        (f) => f.status === 'PENDING' || f.status === 'PROCESSING' || f.status === 'FULFILLED',
      ) ?? null
    );
  }

  async updateStatus(
    storeId: string,
    id: string,
    targetStatus: FulfillmentStatus,
    patch?: UpdateFulfillmentStatusPatch,
  ): Promise<FulfillmentWithItems> {
    const existing = await this.findById(storeId, id);
    if (!existing) {
      throw new Error(`Fulfillment ${id} not found in store ${storeId}`);
    }

    const updatedDeliveryPayload = {
      trackingInfo: patch?.trackingInfo ?? existing.trackingInfo,
      failureReason:
        patch?.failureReason !== undefined ? patch.failureReason : existing.failureReason,
      metadata: patch?.metadata ?? existing.metadata,
    };

    const rows = await this.client
      .from<DbFulfillment>('fulfillments')
      .eq('store_id', storeId)
      .eq('id', id)
      .update({
        status: targetStatus,
        delivery_payload: updatedDeliveryPayload,
        updated_at: new Date().toISOString(),
      });

    const row = rows[0];
    if (!row) {
      throw new Error(`Failed to update fulfillment: ${id}`);
    }

    return {
      ...toDomainFulfillment(row),
      items: existing.items,
    };
  }

  async list(
    storeId: string,
    filter?: FulfillmentFilter,
  ): Promise<readonly FulfillmentWithItems[]> {
    let builder = this.client
      .from<DbFulfillment>('fulfillments')
      .select('*')
      .eq('store_id', storeId);

    if (filter?.status) {
      builder = builder.eq('status', filter.status);
    }
    if (filter?.orderId) {
      builder = builder.eq('order_id', filter.orderId);
    }

    const rows = await builder.execute();
    if (rows.length === 0) return Object.freeze([]);

    const ids = rows.map((r) => r.id);
    const itemRows = await this.client
      .from<DbFulfillmentItem>('fulfillment_items')
      .select('*')
      .eq('store_id', storeId)
      .in('fulfillment_id', ids)
      .execute();

    const itemsByFulfillment = new Map<string, DbFulfillmentItem[]>();
    for (const item of itemRows) {
      const existing = itemsByFulfillment.get(item.fulfillment_id) ?? [];
      existing.push(item);
      itemsByFulfillment.set(item.fulfillment_id, existing);
    }

    const result = rows.map((row) => {
      const items = itemsByFulfillment.get(row.id) ?? [];
      return {
        ...toDomainFulfillment(row),
        items: Object.freeze(items.map(toDomainItem)),
      };
    });

    return Object.freeze(result);
  }
}

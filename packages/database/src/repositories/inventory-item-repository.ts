import { InventoryItem, InventoryItemRepository, InventoryItemStatus } from '@bintang/inventory';
import { PostgrestClient } from '../client.js';
import { DbInventoryItem } from '../types.js';

function toDomain(row: DbInventoryItem): InventoryItem {
  return {
    id: row.id,
    storeId: row.store_id,
    productId: row.product_id,
    inventoryId: row.inventory_id,
    itemType: row.item_type,
    secretReference: row.secret_reference,
    status: row.status as InventoryItemStatus,
    reservedOrderId: row.reserved_order_id,
    assignedOrderId: row.assigned_order_id,
    reservedAt: row.reserved_at,
    reservedUntil: row.reserved_until,
    assignedAt: row.assigned_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseInventoryItemRepository implements InventoryItemRepository {
  private readonly client: PostgrestClient;

  constructor(client: PostgrestClient) {
    this.client = client;
  }

  async create(storeId: string, item: InventoryItem): Promise<InventoryItem> {
    const payload: Partial<DbInventoryItem> = {
      id: item.id,
      store_id: storeId,
      product_id: item.productId,
      inventory_id: item.inventoryId,
      item_type: item.itemType,
      secret_reference: item.secretReference,
      status: item.status,
      reserved_order_id: item.reservedOrderId,
      assigned_order_id: item.assignedOrderId,
      reserved_at: item.reservedAt,
      reserved_until: item.reservedUntil,
      assigned_at: item.assignedAt,
      metadata: { ...item.metadata },
    };

    const inserted = await this.client.from<DbInventoryItem>('inventory_items').insert(payload);
    const row = inserted[0];
    if (!row) {
      throw new Error('Failed to insert inventory item: empty response');
    }
    return toDomain(row);
  }

  async findById(storeId: string, id: string): Promise<InventoryItem | null> {
    const row = await this.client
      .from<DbInventoryItem>('inventory_items')
      .select('*')
      .eq('store_id', storeId)
      .eq('id', id)
      .maybeSingle();
    return row ? toDomain(row) : null;
  }

  async listByProductId(
    storeId: string,
    productId: string,
    status?: InventoryItemStatus,
  ): Promise<readonly InventoryItem[]> {
    let builder = this.client
      .from<DbInventoryItem>('inventory_items')
      .select('*')
      .eq('store_id', storeId)
      .eq('product_id', productId);

    if (status) {
      builder = builder.eq('status', status);
    }

    const rows = await builder.execute();
    return Object.freeze(rows.map(toDomain));
  }

  async updateStatus(
    storeId: string,
    id: string,
    status: InventoryItemStatus,
    patch?: {
      readonly reservedOrderId?: string | null | undefined;
      readonly assignedOrderId?: string | null | undefined;
      readonly reservedAt?: string | null | undefined;
      readonly reservedUntil?: string | null | undefined;
      readonly assignedAt?: string | null | undefined;
    },
  ): Promise<InventoryItem> {
    const updatePayload: Partial<DbInventoryItem> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (patch?.reservedOrderId !== undefined)
      updatePayload.reserved_order_id = patch.reservedOrderId;
    if (patch?.assignedOrderId !== undefined)
      updatePayload.assigned_order_id = patch.assignedOrderId;
    if (patch?.reservedAt !== undefined) updatePayload.reserved_at = patch.reservedAt;
    if (patch?.reservedUntil !== undefined) updatePayload.reserved_until = patch.reservedUntil;
    if (patch?.assignedAt !== undefined) updatePayload.assigned_at = patch.assignedAt;

    const rows = await this.client
      .from<DbInventoryItem>('inventory_items')
      .eq('store_id', storeId)
      .eq('id', id)
      .update(updatePayload);

    const row = rows[0];
    if (!row) {
      throw new Error(`Inventory item not found for update: ${id}`);
    }
    return toDomain(row);
  }

  async countByStatus(
    storeId: string,
    productId: string,
    status: InventoryItemStatus,
  ): Promise<number> {
    const rows = await this.listByProductId(storeId, productId, status);
    return rows.length;
  }
}

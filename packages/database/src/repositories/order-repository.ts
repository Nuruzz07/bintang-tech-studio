import {
  Order,
  OrderItem,
  OrderStatus,
  FulfillmentStatus,
  OrderWithItems,
  OrderFilter,
  OrderRepository,
} from '@bintang/orders';
import { PostgrestClient } from '../client.js';
import { DbOrder, DbOrderItem } from '../types.js';
import { isMissingRpcError } from '../errors.js';

function toDomainOrder(row: DbOrder): Order {
  const metadata = row.metadata ?? {};
  const fulfillmentStatus = (metadata['fulfillmentStatus'] as FulfillmentStatus) || 'PENDING';

  return {
    id: row.id,
    storeId: row.store_id,
    customerId: row.customer_id ?? '',
    orderNumber: row.order_number,
    status: row.status as OrderStatus,
    subtotal: row.subtotal,
    discountTotal: row.discount,
    grandTotal: row.total,
    currency: row.currency,
    voucherId: row.voucher_id,
    fulfillmentStatus,
    metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDomainItem(row: DbOrderItem): OrderItem {
  return {
    id: row.id,
    storeId: row.store_id,
    orderId: row.order_id,
    productId: row.product_id,
    productName: row.name_snapshot,
    quantity: row.quantity,
    unitPrice: row.price_snapshot,
    subtotal: row.total,
    metadata: row.metadata ?? {},
    createdAt: new Date().toISOString(),
  };
}

export class SupabaseOrderRepository implements OrderRepository {
  private readonly client: PostgrestClient;

  constructor(client: PostgrestClient) {
    this.client = client;
  }

  async create(
    storeId: string,
    order: Order,
    items: readonly OrderItem[],
    reserveStock = false,
  ): Promise<OrderWithItems> {
    const metadata = {
      ...(order.metadata ?? {}),
      fulfillmentStatus: order.fulfillmentStatus,
    };

    const orderPayload: Partial<DbOrder> = {
      id: order.id,
      store_id: storeId,
      customer_id: order.customerId || null,
      order_number: order.orderNumber,
      status: order.status,
      currency: order.currency,
      subtotal: order.subtotal,
      discount: order.discountTotal,
      tax: '0.00',
      total: order.grandTotal,
      voucher_id: order.voucherId,
      metadata,
    };

    const itemPayloads: Partial<DbOrderItem>[] = items.map((item) => ({
      id: item.id,
      order_id: order.id,
      store_id: storeId,
      product_id: item.productId ?? '',
      name_snapshot: item.productName,
      price_snapshot: item.unitPrice,
      quantity: item.quantity,
      total: item.subtotal,
      metadata: { ...item.metadata },
    }));

    try {
      const res = await this.client.rpc<{ order: DbOrder; items: DbOrderItem[] }>(
        'rpc_create_order_atomic',
        {
          p_store_id: storeId,
          p_order: orderPayload,
          p_items: itemPayloads,
          p_reserve_stock: reserveStock,
        },
      );
      if (res?.order) {
        return {
          ...toDomainOrder(res.order),
          items: Object.freeze((res.items ?? []).map(toDomainItem)),
        };
      }
    } catch (err: unknown) {
      if (!isMissingRpcError(err)) {
        throw err;
      }
      // If RPC is unavailable (e.g. mocked test environments), fallback to sequential insert
    }

    const insertedOrders = await this.client.from<DbOrder>('orders').insert(orderPayload);
    const orderRow = insertedOrders[0];
    if (!orderRow) {
      throw new Error('Failed to insert order: empty response');
    }

    let itemRows: readonly DbOrderItem[] = [];
    if (itemPayloads.length > 0) {
      itemRows = await this.client.from<DbOrderItem>('order_items').insert(itemPayloads);
    }

    return {
      ...toDomainOrder(orderRow),
      items: Object.freeze(itemRows.map(toDomainItem)),
    };
  }

  async cancelWithAtomicRelease(
    storeId: string,
    orderId: string,
    reason = 'Cancelled',
  ): Promise<OrderWithItems> {
    try {
      const row = await this.client.rpc<DbOrder>('rpc_cancel_order_atomic', {
        p_store_id: storeId,
        p_order_id: orderId,
        p_reason: reason,
      });
      const order = await this.findById(storeId, row.id);
      if (order) return order;
    } catch (err: unknown) {
      if (!isMissingRpcError(err)) {
        throw err;
      }
    }

    return this.updateStatus(storeId, orderId, 'CANCELLED');
  }

  async findById(storeId: string, id: string): Promise<OrderWithItems | null> {
    const orderRow = await this.client
      .from<DbOrder>('orders')
      .select('*')
      .eq('store_id', storeId)
      .eq('id', id)
      .maybeSingle();

    if (!orderRow) return null;

    const itemRows = await this.client
      .from<DbOrderItem>('order_items')
      .select('*')
      .eq('store_id', storeId)
      .eq('order_id', id)
      .execute();

    return {
      ...toDomainOrder(orderRow),
      items: Object.freeze(itemRows.map(toDomainItem)),
    };
  }

  async findByOrderNumber(storeId: string, orderNumber: string): Promise<OrderWithItems | null> {
    const orderRow = await this.client
      .from<DbOrder>('orders')
      .select('*')
      .eq('store_id', storeId)
      .eq('order_number', orderNumber)
      .maybeSingle();

    if (!orderRow) return null;

    const itemRows = await this.client
      .from<DbOrderItem>('order_items')
      .select('*')
      .eq('store_id', storeId)
      .eq('order_id', orderRow.id)
      .execute();

    return {
      ...toDomainOrder(orderRow),
      items: Object.freeze(itemRows.map(toDomainItem)),
    };
  }

  async list(storeId: string, filter?: OrderFilter): Promise<readonly OrderWithItems[]> {
    let builder = this.client.from<DbOrder>('orders').select('*').eq('store_id', storeId);

    if (filter?.status) {
      if (typeof filter.status === 'string') {
        builder = builder.eq('status', filter.status);
      } else {
        builder = builder.in('status', filter.status as readonly string[]);
      }
    }

    const orderRows = await builder.execute();
    if (orderRows.length === 0) return Object.freeze([]);

    const orderIds = orderRows.map((r) => r.id);
    const itemRows = await this.client
      .from<DbOrderItem>('order_items')
      .select('*')
      .eq('store_id', storeId)
      .in('order_id', orderIds)
      .execute();

    const itemsByOrder = new Map<string, DbOrderItem[]>();
    for (const item of itemRows) {
      const existing = itemsByOrder.get(item.order_id) ?? [];
      existing.push(item);
      itemsByOrder.set(item.order_id, existing);
    }

    const result = orderRows.map((orderRow) => {
      const items = itemsByOrder.get(orderRow.id) ?? [];
      return {
        ...toDomainOrder(orderRow),
        items: Object.freeze(items.map(toDomainItem)),
      };
    });

    return Object.freeze(result);
  }

  async listByCustomerId(
    storeId: string,
    customerId: string,
    filter?: OrderFilter,
  ): Promise<readonly OrderWithItems[]> {
    let builder = this.client
      .from<DbOrder>('orders')
      .select('*')
      .eq('store_id', storeId)
      .eq('customer_id', customerId);

    if (filter?.status) {
      if (typeof filter.status === 'string') {
        builder = builder.eq('status', filter.status);
      } else {
        builder = builder.in('status', filter.status as readonly string[]);
      }
    }

    const orderRows = await builder.execute();
    if (orderRows.length === 0) return Object.freeze([]);

    const orderIds = orderRows.map((r) => r.id);
    const itemRows = await this.client
      .from<DbOrderItem>('order_items')
      .select('*')
      .eq('store_id', storeId)
      .in('order_id', orderIds)
      .execute();

    const itemsByOrder = new Map<string, DbOrderItem[]>();
    for (const item of itemRows) {
      const existing = itemsByOrder.get(item.order_id) ?? [];
      existing.push(item);
      itemsByOrder.set(item.order_id, existing);
    }

    const result = orderRows.map((orderRow) => {
      const items = itemsByOrder.get(orderRow.id) ?? [];
      return {
        ...toDomainOrder(orderRow),
        items: Object.freeze(items.map(toDomainItem)),
      };
    });

    return Object.freeze(result);
  }

  async updateStatus(
    storeId: string,
    id: string,
    status: OrderStatus,
    metadata?: Readonly<Record<string, unknown>>,
  ): Promise<OrderWithItems> {
    const existing = await this.findById(storeId, id);
    if (!existing) {
      throw new Error(`Order ${id} not found in store ${storeId}`);
    }

    const mergedMetadata: Record<string, unknown> = {
      ...existing.metadata,
      ...(metadata ?? {}),
    };

    const rows = await this.client
      .from<DbOrder>('orders')
      .eq('store_id', storeId)
      .eq('id', id)
      .update({
        status,
        metadata: mergedMetadata,
        updated_at: new Date().toISOString(),
      });

    const orderRow = rows[0];
    if (!orderRow) {
      throw new Error(`Failed to update order status for: ${id}`);
    }

    return {
      ...toDomainOrder(orderRow),
      items: existing.items,
    };
  }
}

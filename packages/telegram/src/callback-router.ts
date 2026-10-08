/**
 * Bintang Tech Studio — Telegram Callback Router.
 * Baseline: Milestone M11 Telegram Engine.
 *
 * Handles inline button callbacks.
 * Invariant: Callback payload is UNTRUSTED user input.
 * Never use callback payload alone as proof of tenant, ownership, or authorization.
 */

import { CatalogService } from '@bintang/commerce';
import { OrderService, OrderCaller } from '@bintang/orders';
import { FulfillmentService, FulfillmentCaller, PublicFulfillment } from '@bintang/fulfillment';
import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import { TelegramAdapter } from './adapter.js';
import { TelegramOutboundService } from './outbound.js';
import { TelegramUpdateContext, TelegramCallerContext } from './types.js';
import { ResolvedTelegramStore } from './store-resolver.js';
import { TelegramCallbackMalformedError, TelegramResourceNotFoundError } from './errors.js';

export interface TelegramCallbackRouterDependencies {
  readonly adapter: TelegramAdapter;
  readonly outbound: TelegramOutboundService;
  readonly catalogService: CatalogService;
  readonly orderService: OrderService;
  readonly fulfillmentService: FulfillmentService;
}

export class TelegramCallbackRouter {
  constructor(private readonly deps: TelegramCallbackRouterDependencies) {}

  public async routeCallback(
    update: TelegramUpdateContext,
    store: ResolvedTelegramStore,
    caller: TelegramCallerContext,
  ): Promise<string> {
    const rawData = update.callbackData;
    if (!rawData) {
      throw new TelegramCallbackMalformedError('Missing callback data');
    }

    // Always acknowledge callback query to dismiss client loading spinner
    if (update.callbackQueryId) {
      try {
        await this.deps.adapter.answerCallbackQuery(update.botId, {
          callbackQueryId: update.callbackQueryId,
        });
      } catch {
        // Best-effort callback answer
      }
    }

    const parts = rawData.split(':');
    const actionPrefix = parts[0];

    switch (actionPrefix) {
      case 'product':
        if (parts[1] === 'view' && parts[2]) {
          return this.handleProductView(update, store, parts[2]);
        }
        break;

      case 'order':
        if (parts[1] === 'view' && parts[2]) {
          return this.handleOrderView(update, store, caller, parts[2]);
        }
        break;

      case 'action':
        return this.handleGeneralAction(update, store, caller, parts[1] ?? '');

      default:
        break;
    }

    throw new TelegramCallbackMalformedError(`Aksi callback tidak dikenali: ${rawData}`);
  }

  private async handleProductView(
    update: TelegramUpdateContext,
    store: ResolvedTelegramStore,
    productId: string,
  ): Promise<string> {
    const storeContext = createAuthenticatedStoreContext({
      storeId: store.storeId,
      tenantSlug: store.tenantSlug || 'store',
      userId: `system:telegram:${store.storeId}`,
      membershipId: `sys_mem_${store.storeId}`,
      role: 'STORE_ADMIN',
    });

    try {
      const product = await this.deps.catalogService.getProductById(storeContext, productId);

      // Verify product belongs to current store
      if (product.storeId !== store.storeId) {
        throw new TelegramResourceNotFoundError('Produk bukan milik toko ini.');
      }

      const payload = this.deps.outbound.formatProductDetail(
        update.chatId,
        product,
        store.miniAppUrl,
      );
      await this.deps.adapter.sendMessage(update.botId, payload);
      return 'CB_PRODUCT_VIEW_SUCCESS';
    } catch {
      throw new TelegramResourceNotFoundError('Produk tidak ditemukan atau tidak tersedia.');
    }
  }

  private async handleOrderView(
    update: TelegramUpdateContext,
    store: ResolvedTelegramStore,
    caller: TelegramCallerContext,
    orderId: string,
  ): Promise<string> {
    const orderCaller: OrderCaller =
      caller.type === 'CUSTOMER'
        ? { type: 'CUSTOMER', context: caller.context }
        : { type: 'SELLER', context: caller.context };

    try {
      const order = await this.deps.orderService.getOrderById(orderCaller, orderId);

      // Security check: order must belong to current store
      if (order.storeId !== store.storeId) {
        throw new TelegramResourceNotFoundError('Pesanan tidak ditemukan.');
      }

      // Query fulfillment
      const fulfillmentCaller: FulfillmentCaller =
        caller.type === 'CUSTOMER'
          ? { type: 'CUSTOMER', context: caller.context }
          : { type: 'SELLER', context: caller.context };

      let fulfillment: PublicFulfillment | null = null;
      try {
        const fulfillments = await this.deps.fulfillmentService.listFulfillments(
          fulfillmentCaller,
          { orderId: order.id },
        );
        if (fulfillments.length > 0) {
          fulfillment = fulfillments[0]!;
        }
      } catch {
        // Best effort fulfillment lookup
      }

      const payload = this.deps.outbound.formatOrderDetail(
        update.chatId,
        order,
        fulfillment,
        store.miniAppUrl,
      );
      await this.deps.adapter.sendMessage(update.botId, payload);
      return 'CB_ORDER_VIEW_SUCCESS';
    } catch {
      throw new TelegramResourceNotFoundError('Pesanan tidak ditemukan atau akses tidak tersedia.');
    }
  }

  private async handleGeneralAction(
    update: TelegramUpdateContext,
    store: ResolvedTelegramStore,
    caller: TelegramCallerContext,
    action: string,
  ): Promise<string> {
    switch (action) {
      case 'list_products': {
        const storeContext = createAuthenticatedStoreContext({
          storeId: store.storeId,
          tenantSlug: store.tenantSlug || 'store',
          userId: `system:telegram:${store.storeId}`,
          membershipId: `sys_mem_${store.storeId}`,
          role: 'STORE_ADMIN',
        });
        const products = await this.deps.catalogService.listProducts(storeContext, {
          status: 'ACTIVE',
        });
        const payload = this.deps.outbound.formatProductList(
          update.chatId,
          store.storeName,
          products,
          store.miniAppUrl,
        );
        await this.deps.adapter.sendMessage(update.botId, payload);
        return 'CB_LIST_PRODUCTS_SUCCESS';
      }

      case 'list_orders': {
        const orderCaller: OrderCaller =
          caller.type === 'CUSTOMER'
            ? { type: 'CUSTOMER', context: caller.context }
            : { type: 'SELLER', context: caller.context };
        const orders = await this.deps.orderService.listOrders(orderCaller, {
          customerId: caller.type === 'CUSTOMER' ? caller.customerId : undefined,
        });
        const payload = this.deps.outbound.formatOrderList(update.chatId, orders, store.miniAppUrl);
        await this.deps.adapter.sendMessage(update.botId, payload);
        return 'CB_LIST_ORDERS_SUCCESS';
      }

      case 'help': {
        const payload = this.deps.outbound.formatHelpMessage(update.chatId, store.storeName);
        await this.deps.adapter.sendMessage(update.botId, payload);
        return 'CB_HELP_SUCCESS';
      }

      default:
        throw new TelegramCallbackMalformedError(`Aksi umum tidak valid: ${action}`);
    }
  }
}

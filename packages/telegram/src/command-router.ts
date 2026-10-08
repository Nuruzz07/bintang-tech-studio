/**
 * Bintang Tech Studio — Telegram Command Router.
 * Baseline: Milestone M11 Telegram Engine.
 *
 * Dispatches commands (/start, /products, /orders, /order, /help)
 * strictly through existing domain and application services.
 *
 * Invariant: Commands never manipulate domain state directly.
 */

import { AuthorizationService } from '@bintang/authorization';
import { CatalogService } from '@bintang/commerce';
import { OrderService, OrderCaller } from '@bintang/orders';
import { FulfillmentService, FulfillmentCaller, PublicFulfillment } from '@bintang/fulfillment';
import { createAuthenticatedStoreContext } from '@bintang/tenancy';
import { TelegramAdapter } from './adapter.js';
import { TelegramOutboundService } from './outbound.js';
import { TelegramUpdateContext, TelegramCallerContext } from './types.js';
import { ResolvedTelegramStore } from './store-resolver.js';
import {
  TelegramCommandUnknownError,
  TelegramSellerAccessDeniedError,
  TelegramResourceNotFoundError,
} from './errors.js';

export interface TelegramCommandRouterDependencies {
  readonly adapter: TelegramAdapter;
  readonly outbound: TelegramOutboundService;
  readonly catalogService: CatalogService;
  readonly orderService: OrderService;
  readonly fulfillmentService: FulfillmentService;
  readonly authorizationService: AuthorizationService;
}

export class TelegramCommandRouter {
  constructor(private readonly deps: TelegramCommandRouterDependencies) {}

  public async routeCommand(
    update: TelegramUpdateContext,
    store: ResolvedTelegramStore,
    caller: TelegramCallerContext,
  ): Promise<string> {
    const command = update.command?.toLowerCase();

    switch (command) {
      case '/start':
        return this.handleStart(update, store);

      case '/products':
      case '/katalog':
        return this.handleProducts(update, store);

      case '/orders':
      case '/pesanan':
        return this.handleOrders(update, store, caller);

      case '/order':
        return this.handleOrderDetail(update, store, caller);

      case '/help':
      case '/bantuan':
        return this.handleHelp(update, store);

      case '/admin':
      case '/seller':
        return this.handleSellerCommand(update, store, caller);

      default:
        throw new TelegramCommandUnknownError(command || 'unknown');
    }
  }

  private async handleStart(
    update: TelegramUpdateContext,
    store: ResolvedTelegramStore,
  ): Promise<string> {
    const payload = this.deps.outbound.formatWelcomeMessage(
      update.chatId,
      store.storeName,
      store.miniAppUrl,
    );
    await this.deps.adapter.sendMessage(update.botId, payload);
    return 'CMD_START_SUCCESS';
  }

  private async handleProducts(
    update: TelegramUpdateContext,
    store: ResolvedTelegramStore,
  ): Promise<string> {
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
    return 'CMD_PRODUCTS_SUCCESS';
  }

  private async handleOrders(
    update: TelegramUpdateContext,
    store: ResolvedTelegramStore,
    caller: TelegramCallerContext,
  ): Promise<string> {
    const orderCaller: OrderCaller =
      caller.type === 'CUSTOMER'
        ? { type: 'CUSTOMER', context: caller.context }
        : { type: 'SELLER', context: caller.context };

    // Customers only see their own orders within the store
    const orders = await this.deps.orderService.listOrders(orderCaller, {
      customerId: caller.type === 'CUSTOMER' ? caller.customerId : undefined,
    });

    const payload = this.deps.outbound.formatOrderList(update.chatId, orders, store.miniAppUrl);
    await this.deps.adapter.sendMessage(update.botId, payload);
    return 'CMD_ORDERS_SUCCESS';
  }

  private async handleOrderDetail(
    update: TelegramUpdateContext,
    store: ResolvedTelegramStore,
    caller: TelegramCallerContext,
  ): Promise<string> {
    const orderId = update.commandArgs?.trim();
    if (!orderId) {
      const errPayload = this.deps.outbound.formatErrorMessage(
        update.chatId,
        'Format perintah: /order <id_pesanan>',
      );
      await this.deps.adapter.sendMessage(update.botId, errPayload);
      return 'CMD_ORDER_MISSING_ID';
    }

    const orderCaller: OrderCaller =
      caller.type === 'CUSTOMER'
        ? { type: 'CUSTOMER', context: caller.context }
        : { type: 'SELLER', context: caller.context };

    try {
      const order = await this.deps.orderService.getOrderById(orderCaller, orderId);

      // Query fulfillment if exists
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
      return 'CMD_ORDER_DETAIL_SUCCESS';
    } catch {
      throw new TelegramResourceNotFoundError('Pesanan tidak ditemukan atau akses tidak tersedia.');
    }
  }

  private async handleHelp(
    update: TelegramUpdateContext,
    store: ResolvedTelegramStore,
  ): Promise<string> {
    const payload = this.deps.outbound.formatHelpMessage(update.chatId, store.storeName);
    await this.deps.adapter.sendMessage(update.botId, payload);
    return 'CMD_HELP_SUCCESS';
  }

  private async handleSellerCommand(
    update: TelegramUpdateContext,
    store: ResolvedTelegramStore,
    caller: TelegramCallerContext,
  ): Promise<string> {
    if (caller.type !== 'SELLER') {
      throw new TelegramSellerAccessDeniedError();
    }

    // Assert seller authorization using M04 AuthorizationService
    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: caller.context,
      permission: 'store.settings.read',
      targetStoreId: store.storeId,
    });

    const payload = {
      chatId: update.chatId,
      text:
        `*Panel Penjual — ${store.storeName}* 🛡️\n\n` +
        `ID Toko: \`${store.storeId}\`\n` +
        `Peran Anda: *${caller.context.role}*\n` +
        `Status: Terverifikasi. Silakan kelola toko melalui Seller Dashboard.`,
      parseMode: 'Markdown' as const,
    };

    await this.deps.adapter.sendMessage(update.botId, payload);
    return 'CMD_SELLER_SUCCESS';
  }
}

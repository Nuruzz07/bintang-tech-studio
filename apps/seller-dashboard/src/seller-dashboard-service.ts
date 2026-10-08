/**
 * Bintang Tech Studio — Seller Dashboard Application Service.
 * Baseline: Milestone M12 Seller Dashboard Foundation.
 *
 * Central application service coordinating all 13 Seller Dashboard sections:
 * 1. Overview
 * 2. Products
 * 3. Categories
 * 4. Inventory
 * 5. Orders
 * 6. Customers
 * 7. Vouchers
 * 8. Payments
 * 9. Fulfillment
 * 10. Telegram / Channels
 * 11. Team
 * 12. Store Settings
 * 13. Subscription Visibility
 *
 * Invariant: Every method strictly resolves Store Context from sessionToken
 * and asserts M04 AuthorizationService permissions before execution.
 */

import {
  AuthorizationService,
  EntitlementResolver,
  STANDARD_ENTITLEMENT_KEYS,
} from '@bintang/authorization';
import {
  CatalogService,
  CategoryRepository,
  ProductRepository,
  Product,
  Category,
  ProductStatus,
} from '@bintang/commerce';
import { InventoryService, InventoryRepository, InventoryItemRepository } from '@bintang/inventory';
import {
  OrderService,
  OrderRepository,
  CustomerRepository,
  Order,
  OrderStatus,
} from '@bintang/orders';
import { PaymentService, PaymentAccountRepository, addMoney } from '@bintang/payments';
import { FulfillmentService, FulfillmentCaller, PublicFulfillment } from '@bintang/fulfillment';
import { TelegramBotRepository } from '@bintang/telegram';
import { StoreRepository, StoreMemberRepository } from '@bintang/tenancy';
import { SellerSessionManager } from './session-manager.js';
import { VoucherRepository } from './voucher-repository.js';
import {
  DashboardOverview,
  SellerProductView,
  CreateProductInput,
  UpdateProductInput,
  SellerCategoryView,
  CreateCategoryInput,
  UpdateCategoryInput,
  SellerInventoryLevelView,
  StockAdjustmentInput,
  SellerInventoryItemSummary,
  SellerOrderSummaryView,
  SellerOrderDetailView,
  SellerOrderItemView,
  CancelOrderInput,
  SellerCustomerSummaryView,
  SellerVoucherView,
  CreateVoucherInput,
  UpdateVoucherInput,
  Voucher,
  SellerPaymentAccountView,
  ConfigurePaymentAccountInput,
  SellerFulfillmentSummaryView,
  SellerFulfillmentDetailView,
  SellerChannelView,
  SellerBotBindingView,
  SellerTeamMemberView,
  InviteMemberInput,
  UpdateMemberRoleInput,
  SellerStoreSettingsView,
  UpdateStoreSettingsInput,
  SellerSubscriptionVisibilityView,
} from './types.js';
import {
  ProductLimitExceededError,
  StaffLimitExceededError,
  OwnerDemotionForbiddenError,
  SellerResourceNotFoundError,
  ChannelFeatureDisabledError,
} from './errors.js';

export interface SellerDashboardServiceDependencies {
  readonly sessionManager: SellerSessionManager;
  readonly authorizationService: AuthorizationService;
  readonly entitlementResolver: EntitlementResolver;
  readonly catalogService: CatalogService;
  readonly categoryRepository: CategoryRepository;
  readonly productRepository: ProductRepository;
  readonly inventoryService: InventoryService;
  readonly inventoryRepository: InventoryRepository;
  readonly inventoryItemRepository: InventoryItemRepository;
  readonly orderService: OrderService;
  readonly orderRepository: OrderRepository;
  readonly customerRepository: CustomerRepository;
  readonly voucherRepository: VoucherRepository;
  readonly paymentService: PaymentService;
  readonly paymentAccountRepository: PaymentAccountRepository;
  readonly fulfillmentService: FulfillmentService;
  readonly telegramBotRepository: TelegramBotRepository;
  readonly storeRepository: StoreRepository;
  readonly storeMemberRepository: StoreMemberRepository;
}

export class SellerDashboardService {
  constructor(private readonly deps: SellerDashboardServiceDependencies) {}

  // ==========================================================================
  // 1. OVERVIEW
  // ==========================================================================

  public async getOverview(sessionToken: string): Promise<DashboardOverview> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'analytics.read',
      targetStoreId: ctx.storeId,
    });

    const orders = await this.deps.orderRepository.list(ctx.storeId);
    let pendingCount = 0;
    let paidCount = 0;
    let fulfilledCount = 0;
    let grossRevenue = '0.00';

    for (const ord of orders) {
      if (ord.status === 'PENDING_PAYMENT') pendingCount++;
      if (ord.status === 'PAID') paidCount++;
      if (ord.status === 'FULFILLED') fulfilledCount++;

      if (ord.status === 'PAID' || ord.status === 'FULFILLED') {
        grossRevenue = addMoney(grossRevenue, ord.grandTotal);
      }
    }

    const inventoryLevels = await this.deps.inventoryRepository.list(ctx.storeId);
    let lowStockCount = 0;
    for (const inv of inventoryLevels) {
      if (inv.quantityOnHand <= 5) {
        lowStockCount++;
      }
    }

    const recentOrders = orders.slice(0, 5).map((o) => this.toOrderSummaryView(o));

    return {
      storeId: ctx.storeId,
      storeName: ctx.storeName,
      currency: ctx.currency,
      totalOrders: orders.length,
      pendingOrders: pendingCount,
      paidOrders: paidCount,
      fulfilledOrders: fulfilledCount,
      grossRevenue,
      formattedGrossRevenue: this.formatCurrency(grossRevenue),
      lowStockCount,
      recentOrders,
      storeStatus: 'ACTIVE',
    };
  }

  // ==========================================================================
  // 2. PRODUCTS
  // ==========================================================================

  public async listProducts(
    sessionToken: string,
    filter?: { categoryId?: string; status?: string },
  ): Promise<readonly SellerProductView[]> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'products.read',
      targetStoreId: ctx.storeId,
    });

    const products = await this.deps.productRepository.list(ctx.storeId, {
      ...(filter?.categoryId ? { categoryId: filter.categoryId } : {}),
      ...(filter?.status ? { status: filter.status as ProductStatus } : {}),
    });

    const categories = await this.deps.categoryRepository.list(ctx.storeId);
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const views: SellerProductView[] = [];
    for (const p of products) {
      const inv = await this.deps.inventoryRepository.findByProductId(ctx.storeId, p.id);
      const onHand = inv?.quantityOnHand ?? 0;
      const reserved = inv?.quantityReserved ?? 0;
      const availableStock = Math.max(0, onHand - reserved);

      views.push(
        this.toProductView(
          p,
          categoryMap.get(p.categoryId || ''),
          onHand,
          reserved,
          availableStock,
        ),
      );
    }

    return views;
  }

  public async getProduct(sessionToken: string, productId: string): Promise<SellerProductView> {
    return this.getProductById(sessionToken, productId);
  }

  public async getProductById(sessionToken: string, productId: string): Promise<SellerProductView> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'products.read',
      targetStoreId: ctx.storeId,
    });

    const product = await this.deps.productRepository.findById(ctx.storeId, productId);
    if (!product || product.storeId !== ctx.storeId) {
      throw new SellerResourceNotFoundError('Produk tidak ditemukan pada toko ini.');
    }

    let categoryName: string | undefined;
    if (product.categoryId) {
      const cat = await this.deps.categoryRepository.findById(ctx.storeId, product.categoryId);
      categoryName = cat?.name;
    }

    const inv = await this.deps.inventoryRepository.findByProductId(ctx.storeId, product.id);
    const onHand = inv?.quantityOnHand ?? 0;
    const reserved = inv?.quantityReserved ?? 0;
    const availableStock = Math.max(0, onHand - reserved);

    return this.toProductView(product, categoryName, onHand, reserved, availableStock);
  }

  public async createProduct(
    sessionToken: string,
    input: CreateProductInput,
  ): Promise<SellerProductView> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'products.create',
      targetStoreId: ctx.storeId,
    });

    // Check Entitlement limit
    const productLimit = await this.deps.entitlementResolver.getLimit(
      ctx.storeId,
      STANDARD_ENTITLEMENT_KEYS.PRODUCTS_MAX,
    );
    const existingProducts = await this.deps.productRepository.list(ctx.storeId);
    if (existingProducts.length >= productLimit) {
      throw new ProductLimitExceededError(productLimit);
    }

    const now = new Date().toISOString();
    const id = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const slug = input.slug || input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const newProduct: Product = {
      id,
      storeId: ctx.storeId,
      categoryId: input.categoryId || null,
      name: input.name,
      slug,
      description: input.description || null,
      productType: 'DIGITAL',
      price: input.price,
      compareAtPrice: input.compareAtPrice || null,
      stockMode: 'TRACKED',
      status: 'ACTIVE',
      metadata: input.metadata || {},
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.deps.productRepository.create(ctx.storeId, newProduct);

    // Initialize inventory level if requested
    const initialQty = input.initialStock ?? 0;
    const invId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await this.deps.inventoryRepository.create(ctx.storeId, {
      id: invId,
      storeId: ctx.storeId,
      productId: saved.id,
      quantityOnHand: initialQty,
      quantityReserved: 0,
      updatedAt: now,
    });

    return this.toProductView(saved, undefined, initialQty, 0, initialQty);
  }

  public async updateProduct(
    sessionToken: string,
    productId: string,
    input: UpdateProductInput,
  ): Promise<SellerProductView> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'products.update',
      targetStoreId: ctx.storeId,
    });

    const product = await this.deps.productRepository.findById(ctx.storeId, productId);
    if (!product || product.storeId !== ctx.storeId) {
      throw new SellerResourceNotFoundError('Produk tidak ditemukan.');
    }

    const updated = await this.deps.productRepository.update(ctx.storeId, productId, {
      ...(input.name ? { name: input.name } : {}),
      ...(input.slug ? { slug: input.slug } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.price ? { price: input.price } : {}),
      ...(input.compareAtPrice !== undefined ? { compareAtPrice: input.compareAtPrice } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    });

    const inv = await this.deps.inventoryRepository.findByProductId(ctx.storeId, productId);
    const onHand = inv?.quantityOnHand ?? 0;
    const reserved = inv?.quantityReserved ?? 0;

    return this.toProductView(updated, undefined, onHand, reserved, Math.max(0, onHand - reserved));
  }

  public async deleteProduct(sessionToken: string, productId: string): Promise<void> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'products.delete',
      targetStoreId: ctx.storeId,
    });

    const product = await this.deps.productRepository.findById(ctx.storeId, productId);
    if (!product || product.storeId !== ctx.storeId) {
      throw new SellerResourceNotFoundError('Produk tidak ditemukan.');
    }

    await this.deps.productRepository.archive(ctx.storeId, productId);
  }

  public async archiveProduct(sessionToken: string, productId: string): Promise<SellerProductView> {
    await this.deleteProduct(sessionToken, productId);
    return this.getProductById(sessionToken, productId);
  }

  // ==========================================================================
  // 3. CATEGORIES
  // ==========================================================================

  public async listCategories(sessionToken: string): Promise<readonly SellerCategoryView[]> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'products.read',
      targetStoreId: ctx.storeId,
    });

    const categories = await this.deps.categoryRepository.list(ctx.storeId);
    const products = await this.deps.productRepository.list(ctx.storeId);

    const countMap = new Map<string, number>();
    for (const p of products) {
      if (p.categoryId) {
        countMap.set(p.categoryId, (countMap.get(p.categoryId) ?? 0) + 1);
      }
    }

    return categories.map((c) => ({
      id: c.id,
      storeId: c.storeId,
      name: c.name,
      slug: c.slug,
      description: c.description,
      sortOrder: c.sortOrder,
      isActive: c.status === 'ACTIVE',
      productCount: countMap.get(c.id) ?? 0,
    }));
  }

  public async createCategory(
    sessionToken: string,
    input: CreateCategoryInput,
  ): Promise<SellerCategoryView> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'products.create',
      targetStoreId: ctx.storeId,
    });

    const now = new Date().toISOString();
    const id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const slug = input.slug || input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const newCategory: Category = {
      id,
      storeId: ctx.storeId,
      name: input.name,
      slug,
      description: input.description || null,
      sortOrder: input.sortOrder ?? 1,
      status: 'ACTIVE',
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.deps.categoryRepository.create(ctx.storeId, newCategory);
    return {
      id: saved.id,
      storeId: saved.storeId,
      name: saved.name,
      slug: saved.slug,
      description: saved.description,
      sortOrder: saved.sortOrder,
      isActive: true,
      productCount: 0,
    };
  }

  public async updateCategory(
    sessionToken: string,
    categoryId: string,
    input: UpdateCategoryInput,
  ): Promise<SellerCategoryView> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'products.update',
      targetStoreId: ctx.storeId,
    });

    const cat = await this.deps.categoryRepository.findById(ctx.storeId, categoryId);
    if (!cat || cat.storeId !== ctx.storeId) {
      throw new SellerResourceNotFoundError('Kategori tidak ditemukan.');
    }

    const updated = await this.deps.categoryRepository.update(ctx.storeId, categoryId, {
      ...(input.name ? { name: input.name } : {}),
      ...(input.slug ? { slug: input.slug } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    });

    return {
      id: updated.id,
      storeId: updated.storeId,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      sortOrder: updated.sortOrder,
      isActive: updated.status === 'ACTIVE',
    };
  }

  public async deleteCategory(sessionToken: string, categoryId: string): Promise<void> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'products.delete',
      targetStoreId: ctx.storeId,
    });

    const cat = await this.deps.categoryRepository.findById(ctx.storeId, categoryId);
    if (!cat || cat.storeId !== ctx.storeId) {
      throw new SellerResourceNotFoundError('Kategori tidak ditemukan.');
    }

    await this.deps.categoryRepository.archive(ctx.storeId, categoryId);
  }

  public async archiveCategory(
    sessionToken: string,
    categoryId: string,
  ): Promise<SellerCategoryView> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);
    await this.deleteCategory(sessionToken, categoryId);
    const cat = await this.deps.categoryRepository.findById(ctx.storeId, categoryId);
    if (!cat) throw new SellerResourceNotFoundError('Kategori tidak ditemukan.');
    return {
      id: cat.id,
      storeId: cat.storeId,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      sortOrder: cat.sortOrder,
      isActive: false,
      status: cat.status,
    };
  }

  // ==========================================================================
  // 4. INVENTORY
  // ==========================================================================

  public async listInventory(sessionToken: string): Promise<readonly SellerInventoryLevelView[]> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'inventory.read',
      targetStoreId: ctx.storeId,
    });

    const levels = await this.deps.inventoryRepository.list(ctx.storeId);
    const products = await this.deps.productRepository.list(ctx.storeId);
    const productMap = new Map(products.map((p) => [p.id, p.name]));

    return levels.map((lvl) => {
      const threshold = 5;
      const available = Math.max(0, lvl.quantityOnHand - lvl.quantityReserved);
      return {
        id: lvl.id,
        storeId: lvl.storeId,
        productId: lvl.productId,
        productName: productMap.get(lvl.productId) || 'Produk',
        onHand: lvl.quantityOnHand,
        reserved: lvl.quantityReserved,
        available,
        availableStock: available,
        lowStockThreshold: threshold,
        isLowStock: lvl.quantityOnHand <= threshold,
        updatedAt: lvl.updatedAt,
      };
    });
  }

  public async getInventoryByProductId(
    sessionToken: string,
    productId: string,
  ): Promise<SellerInventoryLevelView> {
    const list = await this.listInventory(sessionToken);
    const item = list.find((i) => i.productId === productId);
    if (!item) {
      throw new SellerResourceNotFoundError('Data stok produk tidak ditemukan.');
    }
    return item;
  }

  public async adjustStock(
    sessionToken: string,
    inputOrProductId: StockAdjustmentInput | string,
    options?: {
      quantity?: number;
      adjustmentType?: 'INCREASE' | 'DECREASE' | 'SET';
      reason?: string;
    },
  ): Promise<SellerInventoryLevelView> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'inventory.update',
      targetStoreId: ctx.storeId,
    });

    let productId: string;
    let adjustmentType: 'INCREASE' | 'DECREASE' | 'SET';
    let quantity: number;
    let reason: string;

    if (typeof inputOrProductId === 'string') {
      productId = inputOrProductId;
      reason = options?.reason || 'Stock adjustment';
      const type = options?.adjustmentType || 'INCREASE';
      quantity = options?.quantity ?? 0;
      if (type === 'INCREASE') {
        adjustmentType = 'INCREASE';
      } else if (type === 'DECREASE') {
        adjustmentType = 'DECREASE';
      } else {
        adjustmentType = 'SET';
      }
    } else {
      productId = inputOrProductId.productId;
      reason = inputOrProductId.reason;
      adjustmentType = inputOrProductId.deltaQuantity >= 0 ? 'INCREASE' : 'DECREASE';
      quantity = Math.abs(inputOrProductId.deltaQuantity);
    }

    const lvl = await this.deps.inventoryRepository.findByProductId(ctx.storeId, productId);
    if (!lvl || lvl.storeId !== ctx.storeId) {
      throw new SellerResourceNotFoundError('Data stok produk tidak ditemukan.');
    }

    const updated = await this.deps.inventoryRepository.atomicAdjustStock(ctx.storeId, productId, {
      type: adjustmentType,
      quantity,
      reason,
    });

    const product = await this.deps.productRepository.findById(ctx.storeId, productId);
    const threshold = 5;
    const available = Math.max(0, updated.quantityOnHand - updated.quantityReserved);

    return {
      id: updated.id,
      storeId: updated.storeId,
      productId: updated.productId,
      productName: product?.name || 'Produk',
      onHand: updated.quantityOnHand,
      reserved: updated.quantityReserved,
      available,
      availableStock: available,
      lowStockThreshold: threshold,
      isLowStock: updated.quantityOnHand <= threshold,
      updatedAt: updated.updatedAt,
    };
  }

  public async getInventoryItemSummary(
    sessionToken: string,
    productId?: string,
  ): Promise<SellerInventoryItemSummary> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'inventory.read',
      targetStoreId: ctx.storeId,
    });

    let products = await this.deps.productRepository.list(ctx.storeId);
    if (productId) {
      products = products.filter((p) => p.id === productId);
    }

    let available = 0;
    let reserved = 0;
    let assigned = 0;

    for (const p of products) {
      available += await this.deps.inventoryItemRepository.countByStatus(
        ctx.storeId,
        p.id,
        'AVAILABLE',
      );
      reserved += await this.deps.inventoryItemRepository.countByStatus(
        ctx.storeId,
        p.id,
        'RESERVED',
      );
      assigned += await this.deps.inventoryItemRepository.countByStatus(
        ctx.storeId,
        p.id,
        'ASSIGNED',
      );
    }

    return {
      productId,
      totalItems: available + reserved + assigned,
      availableItems: available,
      reservedItems: reserved,
      assignedItems: assigned,
      availableCount: available,
      reservedCount: reserved,
      consumedCount: assigned,
    };
  }

  public async getDigitalInventorySummary(
    sessionToken: string,
    productId?: string,
  ): Promise<SellerInventoryItemSummary> {
    return this.getInventoryItemSummary(sessionToken, productId);
  }

  // ==========================================================================
  // 5. ORDERS
  // ==========================================================================

  public async listOrders(
    sessionToken: string,
    filter?: { status?: string },
  ): Promise<readonly SellerOrderSummaryView[]> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'orders.read',
      targetStoreId: ctx.storeId,
    });

    const orders = await this.deps.orderRepository.list(ctx.storeId, {
      ...(filter?.status ? { status: filter.status as OrderStatus } : {}),
    });

    return orders.map((o) => this.toOrderSummaryView(o));
  }

  public async getOrderById(sessionToken: string, orderId: string): Promise<SellerOrderDetailView> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'orders.read',
      targetStoreId: ctx.storeId,
    });

    const order = await this.deps.orderRepository.findById(ctx.storeId, orderId);
    if (!order || order.storeId !== ctx.storeId) {
      throw new SellerResourceNotFoundError('Pesanan tidak ditemukan.');
    }

    const itemViews: SellerOrderItemView[] = order.items.map((it) => ({
      id: it.id,
      productId: it.productId || '',
      productName: it.productName,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      formattedUnitPrice: this.formatCurrency(it.unitPrice),
      subtotal: it.subtotal,
      formattedSubtotal: this.formatCurrency(it.subtotal),
    }));

    let customerName: string | undefined;
    let customerEmail: string | undefined;
    if (order.customerId) {
      const cust = await this.deps.customerRepository.findById(ctx.storeId, order.customerId);
      customerName = cust?.name;
      customerEmail = cust?.email || undefined;
    }

    return {
      id: order.id,
      storeId: order.storeId,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName,
      customerEmail,
      status: order.status,
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      grandTotal: order.grandTotal,
      formattedGrandTotal: this.formatCurrency(order.grandTotal),
      fulfillmentStatus: order.fulfillmentStatus,
      createdAt: order.createdAt,
      items: itemViews,
      voucherId: order.voucherId,
    };
  }

  public async cancelOrder(
    sessionToken: string,
    input: CancelOrderInput,
  ): Promise<SellerOrderDetailView> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'orders.cancel',
      targetStoreId: ctx.storeId,
    });

    const existingOrder = await this.deps.orderRepository.findById(ctx.storeId, input.orderId);
    if (!existingOrder || existingOrder.storeId !== ctx.storeId) {
      throw new SellerResourceNotFoundError('Pesanan tidak ditemukan.');
    }

    // Transition status strictly through M07 OrderService state machine
    await this.deps.orderService.transitionStatus(
      ctx.authenticatedContext,
      input.orderId,
      'CANCELLED',
    );

    return this.getOrderById(sessionToken, input.orderId);
  }

  // ==========================================================================
  // 6. CUSTOMERS
  // ==========================================================================

  public async listCustomers(sessionToken: string): Promise<readonly SellerCustomerSummaryView[]> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'customers.read',
      targetStoreId: ctx.storeId,
    });

    const customers = await this.deps.customerRepository.list(ctx.storeId);
    return customers.map((c) => ({
      id: c.id,
      storeId: c.storeId,
      name: c.name,
      email: c.email,
      phone: c.phone,
      telegramId: c.telegramId,
      totalOrders: c.totalOrders,
      totalSpent: c.totalSpent,
      formattedTotalSpent: this.formatCurrency(c.totalSpent),
      lastOrderAt: c.lastOrderAt,
      createdAt: c.createdAt,
    }));
  }

  public async getCustomerById(
    sessionToken: string,
    customerId: string,
  ): Promise<SellerCustomerSummaryView> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'customers.read',
      targetStoreId: ctx.storeId,
    });

    const customer = await this.deps.customerRepository.findById(ctx.storeId, customerId);
    if (!customer || customer.storeId !== ctx.storeId) {
      throw new SellerResourceNotFoundError('Pelanggan tidak ditemukan.');
    }

    return {
      id: customer.id,
      storeId: customer.storeId,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      telegramId: customer.telegramId,
      totalOrders: customer.totalOrders,
      totalSpent: customer.totalSpent,
      formattedTotalSpent: this.formatCurrency(customer.totalSpent),
      lastOrderAt: customer.lastOrderAt,
      createdAt: customer.createdAt,
    };
  }

  // ==========================================================================
  // 7. VOUCHERS
  // ==========================================================================

  public async listVouchers(sessionToken: string): Promise<readonly SellerVoucherView[]> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'vouchers.read',
      targetStoreId: ctx.storeId,
    });

    const vouchers = await this.deps.voucherRepository.listByStore(ctx.storeId);
    return vouchers.map((v) => this.toVoucherView(v));
  }

  public async createVoucher(
    sessionToken: string,
    input: CreateVoucherInput,
  ): Promise<SellerVoucherView> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'vouchers.manage',
      targetStoreId: ctx.storeId,
    });

    // Check voucher entitlement
    const hasVoucher = await this.deps.entitlementResolver.hasFeature(
      ctx.storeId,
      STANDARD_ENTITLEMENT_KEYS.FEATURES_VOUCHER,
    );
    if (!hasVoucher) {
      throw new ChannelFeatureDisabledError('Fitur Voucher');
    }

    const now = new Date().toISOString();
    const id = `vch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const code = input.code.trim().toUpperCase();

    const voucher: Voucher = {
      id,
      storeId: ctx.storeId,
      code,
      discountType: input.discountType,
      discountValue: input.discountValue,
      minimumPurchase: input.minimumPurchase || '0.00',
      maximumDiscount: input.maximumDiscount || null,
      usageLimit: input.usageLimit || null,
      usedCount: 0,
      status: 'ACTIVE',
      startsAt: now,
      expiresAt: input.expiresAt || null,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.deps.voucherRepository.create(ctx.storeId, voucher);
    return this.toVoucherView(saved);
  }

  public async updateVoucher(
    sessionToken: string,
    voucherId: string,
    input: UpdateVoucherInput,
  ): Promise<SellerVoucherView> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'vouchers.manage',
      targetStoreId: ctx.storeId,
    });

    const existing = await this.deps.voucherRepository.findById(ctx.storeId, voucherId);
    if (!existing || existing.storeId !== ctx.storeId) {
      throw new SellerResourceNotFoundError('Voucher tidak ditemukan.');
    }

    const updated = await this.deps.voucherRepository.update(ctx.storeId, voucherId, {
      ...(input.discountType ? { discountType: input.discountType } : {}),
      ...(input.discountValue ? { discountValue: input.discountValue } : {}),
      ...(input.minimumPurchase ? { minimumPurchase: input.minimumPurchase } : {}),
      ...(input.maximumDiscount !== undefined ? { maximumDiscount: input.maximumDiscount } : {}),
      ...(input.usageLimit !== undefined ? { usageLimit: input.usageLimit } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
    });

    return this.toVoucherView(updated);
  }

  public async deleteVoucher(sessionToken: string, voucherId: string): Promise<void> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'vouchers.manage',
      targetStoreId: ctx.storeId,
    });

    const existing = await this.deps.voucherRepository.findById(ctx.storeId, voucherId);
    if (!existing || existing.storeId !== ctx.storeId) {
      throw new SellerResourceNotFoundError('Voucher tidak ditemukan.');
    }

    await this.deps.voucherRepository.delete(ctx.storeId, voucherId);
  }

  // ==========================================================================
  // 8. PAYMENTS
  // ==========================================================================

  public async listPaymentAccounts(
    sessionToken: string,
  ): Promise<readonly SellerPaymentAccountView[]> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'payments.read',
      targetStoreId: ctx.storeId,
    });

    const accounts = await this.deps.paymentAccountRepository.list(ctx.storeId);
    return accounts.map((a) => ({
      id: a.id,
      storeId: a.storeId,
      provider: a.provider,
      accountIdentifier: a.displayName,
      status: a.status,
      isActive: a.status === 'ACTIVE',
      capabilities: a.capabilities,
      createdAt: a.createdAt,
    }));
  }

  public async configurePaymentAccount(
    sessionToken: string,
    input: ConfigurePaymentAccountInput,
  ): Promise<SellerPaymentAccountView> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'payments.manage',
      targetStoreId: ctx.storeId,
    });

    const now = new Date().toISOString();
    const id = `pac_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const saved = await this.deps.paymentAccountRepository.create(ctx.storeId, {
      id,
      storeId: ctx.storeId,
      provider: input.provider,
      displayName: input.accountIdentifier,
      currency: ctx.currency,
      credentialReference: `sec_ref_${id}`,
      status: 'ACTIVE',
      capabilities: ['createPayment'],
      configuration: input.configData || {},
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: saved.id,
      storeId: saved.storeId,
      provider: saved.provider,
      accountIdentifier: saved.displayName,
      status: saved.status,
      isActive: true,
      capabilities: saved.capabilities,
      createdAt: saved.createdAt,
    };
  }

  // ==========================================================================
  // 9. FULFILLMENT
  // ==========================================================================

  public async listFulfillments(
    sessionToken: string,
  ): Promise<readonly SellerFulfillmentSummaryView[]> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'fulfillment.read',
      targetStoreId: ctx.storeId,
    });

    const caller: FulfillmentCaller = {
      type: 'SELLER',
      context: ctx.authenticatedContext,
    };

    const fulfillments = await this.deps.fulfillmentService.listFulfillments(caller);

    return fulfillments.map((f) => ({
      id: f.id,
      storeId: f.storeId,
      orderId: f.orderId,
      strategy: f.strategy,
      status: f.status,
      trackingInfo: f.trackingInfo,
      failureReason: null,
      createdAt: f.createdAt,
    }));
  }

  public async getFulfillmentById(
    sessionToken: string,
    fulfillmentId: string,
  ): Promise<SellerFulfillmentDetailView> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'fulfillment.read',
      targetStoreId: ctx.storeId,
    });

    const caller: FulfillmentCaller = {
      type: 'SELLER',
      context: ctx.authenticatedContext,
    };

    let fulfillment: PublicFulfillment | null = null;
    try {
      fulfillment = await this.deps.fulfillmentService.getFulfillment(caller, fulfillmentId);
    } catch {
      throw new SellerResourceNotFoundError('Data fulfillment tidak ditemukan.');
    }
    if (!fulfillment || fulfillment.storeId !== ctx.storeId) {
      throw new SellerResourceNotFoundError('Data fulfillment tidak ditemukan.');
    }

    return {
      id: fulfillment.id,
      storeId: fulfillment.storeId,
      orderId: fulfillment.orderId,
      strategy: fulfillment.strategy,
      status: fulfillment.status,
      trackingInfo: fulfillment.trackingInfo,
      failureReason: null,
      createdAt: fulfillment.createdAt,
      items: fulfillment.items.map((it) => ({
        id: it.id,
        orderItemId: it.orderItemId,
        itemType: it.itemType,
        status: it.status,
        payloadReference: it.payloadReference,
      })),
    };
  }

  // ==========================================================================
  // 10. CHANNELS / TELEGRAM
  // ==========================================================================

  public async listChannels(sessionToken: string): Promise<readonly SellerChannelView[]> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'channels.read',
      targetStoreId: ctx.storeId,
    });

    const bots = await this.deps.telegramBotRepository.listByStore(ctx.storeId);
    const channels: SellerChannelView[] = [];

    for (const bot of bots) {
      channels.push({
        id: bot.id,
        storeId: ctx.storeId,
        channelType: 'TELEGRAM',
        isActive: bot.status === 'ACTIVE',
        botUsername: bot.username,
        botId: bot.telegramBotId,
        connectedAt: bot.createdAt,
      });
    }

    return channels;
  }

  public async getTelegramBotBinding(sessionToken: string): Promise<SellerBotBindingView | null> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'channels.read',
      targetStoreId: ctx.storeId,
    });

    // Check telegram channel entitlement
    const isTelegramAllowed = await this.deps.entitlementResolver.hasFeature(
      ctx.storeId,
      STANDARD_ENTITLEMENT_KEYS.CHANNELS_TELEGRAM,
    );
    if (!isTelegramAllowed) {
      throw new ChannelFeatureDisabledError('Telegram Bot Channel');
    }

    const bots = await this.deps.telegramBotRepository.listByStore(ctx.storeId);
    if (bots.length === 0) {
      return null;
    }

    const bot = bots[0]!;

    // Strictly omit webhookSecret and botToken
    return {
      id: bot.id,
      storeId: bot.storeId,
      botId: bot.telegramBotId,
      botUsername: bot.username,
      isActive: bot.status === 'ACTIVE',
      miniAppUrl: bot.miniAppUrl,
      createdAt: bot.createdAt,
    };
  }

  // ==========================================================================
  // 11. TEAM / MEMBERS
  // ==========================================================================

  public async listTeamMembers(sessionToken: string): Promise<readonly SellerTeamMemberView[]> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'staff.read',
      targetStoreId: ctx.storeId,
    });

    const members = await this.deps.storeMemberRepository.findByStoreId(ctx.storeId);
    return members.map((m) => ({
      membershipId: m.id,
      storeId: m.storeId,
      userId: m.userId,
      userEmail: `${m.userId}@store.bintang.tech`,
      userName: `Staf ${m.role}`,
      role: m.role,
      status: m.status as SellerTeamMemberView['status'],
      joinedAt: m.createdAt,
    }));
  }

  public async inviteMember(
    sessionToken: string,
    input: InviteMemberInput,
  ): Promise<SellerTeamMemberView> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'staff.invite',
      targetStoreId: ctx.storeId,
    });

    // Check staff count limit
    const staffLimit = await this.deps.entitlementResolver.getLimit(
      ctx.storeId,
      STANDARD_ENTITLEMENT_KEYS.STAFF_MAX,
    );
    const existingMembers = await this.deps.storeMemberRepository.findByStoreId(ctx.storeId);
    if (existingMembers.length >= staffLimit) {
      throw new StaffLimitExceededError(staffLimit);
    }

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const saved = await this.deps.storeMemberRepository.create({
      storeId: ctx.storeId,
      userId,
      role: input.role,
      status: 'ACTIVE',
    });

    return {
      membershipId: saved.id,
      storeId: saved.storeId,
      userId: saved.userId,
      userEmail: input.email,
      userName: input.name,
      role: saved.role,
      status: 'ACTIVE',
      joinedAt: saved.createdAt,
    };
  }

  public async updateMemberRole(
    sessionToken: string,
    input: UpdateMemberRoleInput,
  ): Promise<SellerTeamMemberView> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'staff.update',
      targetStoreId: ctx.storeId,
    });

    const member = await this.deps.storeMemberRepository.findById(input.membershipId);
    if (!member || member.storeId !== ctx.storeId) {
      throw new SellerResourceNotFoundError('Anggota tim tidak ditemukan.');
    }

    // Critical Owner Invariant: STORE_OWNER cannot be modified through generic member updates
    if (member.role === 'STORE_OWNER') {
      throw new OwnerDemotionForbiddenError();
    }

    const updated = await this.deps.storeMemberRepository.update(input.membershipId, {
      role: input.role,
    });

    return {
      membershipId: updated.id,
      storeId: updated.storeId,
      userId: updated.userId,
      userEmail: `${updated.userId}@store.bintang.tech`,
      userName: `Staf ${updated.role}`,
      role: updated.role,
      status: updated.status as SellerTeamMemberView['status'],
      joinedAt: updated.createdAt,
    };
  }

  public async removeMember(sessionToken: string, membershipId: string): Promise<void> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'staff.remove',
      targetStoreId: ctx.storeId,
    });

    const member = await this.deps.storeMemberRepository.findById(membershipId);
    if (!member || member.storeId !== ctx.storeId) {
      throw new SellerResourceNotFoundError('Anggota tim tidak ditemukan.');
    }

    // Critical Owner Invariant: STORE_OWNER cannot be removed
    if (member.role === 'STORE_OWNER') {
      throw new OwnerDemotionForbiddenError('Pemilik toko tidak dapat dihapus dari toko.');
    }

    await this.deps.storeMemberRepository.delete(membershipId);
  }

  // ==========================================================================
  // 12. STORE SETTINGS
  // ==========================================================================

  public async getStoreSettings(sessionToken: string): Promise<SellerStoreSettingsView> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'store.settings.read',
      targetStoreId: ctx.storeId,
    });

    const store = await this.deps.storeRepository.findById(ctx.storeId);
    if (!store) {
      throw new SellerResourceNotFoundError('Toko tidak ditemukan.');
    }

    return {
      id: store.id,
      name: store.name,
      slug: store.slug,
      domain: (store.settings?.['domain'] as string) || null,
      currency: store.currency || 'IDR',
      status: store.status as SellerStoreSettingsView['status'],
      createdAt: store.createdAt,
    };
  }

  public async updateStoreSettings(
    sessionToken: string,
    input: UpdateStoreSettingsInput,
  ): Promise<SellerStoreSettingsView> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'store.settings.update',
      targetStoreId: ctx.storeId,
    });

    const store = await this.deps.storeRepository.findById(ctx.storeId);
    if (!store) {
      throw new SellerResourceNotFoundError('Toko tidak ditemukan.');
    }

    const updated = await this.deps.storeRepository.update(ctx.storeId, {
      ...(input.name ? { name: input.name } : {}),
      settings: {
        ...store.settings,
        ...(input.domain !== undefined ? { domain: input.domain } : {}),
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      domain: (updated.settings?.['domain'] as string) || null,
      currency: updated.currency || 'IDR',
      status: updated.status as SellerStoreSettingsView['status'],
      createdAt: updated.createdAt,
    };
  }

  // ==========================================================================
  // 13. SUBSCRIPTION VISIBILITY
  // ==========================================================================

  public async getSubscriptionVisibility(
    sessionToken: string,
  ): Promise<SellerSubscriptionVisibilityView> {
    const ctx = await this.deps.sessionManager.resolveActiveContext(sessionToken);

    await this.deps.authorizationService.assertAuthorizedStoreAction({
      context: ctx.authenticatedContext,
      permission: 'subscription.read',
      targetStoreId: ctx.storeId,
    });

    const entitlements = await this.deps.entitlementResolver.getEffectiveEntitlements(ctx.storeId);
    const productLimit = Number(entitlements[STANDARD_ENTITLEMENT_KEYS.PRODUCTS_MAX] ?? 20);
    const staffLimit = Number(entitlements[STANDARD_ENTITLEMENT_KEYS.STAFF_MAX] ?? 3);
    const telegramAllowed = Boolean(
      entitlements[STANDARD_ENTITLEMENT_KEYS.CHANNELS_TELEGRAM] ?? true,
    );
    const whatsappAllowed = Boolean(
      entitlements[STANDARD_ENTITLEMENT_KEYS.CHANNELS_WHATSAPP] ?? false,
    );
    const voucherAllowed = Boolean(
      entitlements[STANDARD_ENTITLEMENT_KEYS.FEATURES_VOUCHER] ?? true,
    );
    const advancedAnalyticsAllowed = Boolean(
      entitlements[STANDARD_ENTITLEMENT_KEYS.FEATURES_ADVANCED_ANALYTICS] ?? false,
    );

    const products = await this.deps.productRepository.list(ctx.storeId);
    const members = await this.deps.storeMemberRepository.findByStoreId(ctx.storeId);

    return {
      storeId: ctx.storeId,
      planSlug: 'starter',
      planName: 'Starter Merchant',
      status: 'ACTIVE',
      productLimit,
      currentProducts: products.length,
      staffLimit,
      currentStaff: members.length,
      telegramAllowed,
      whatsappAllowed,
      voucherAllowed,
      advancedAnalyticsAllowed,
    };
  }

  // ==========================================================================
  // HELPER MAPPERS
  // ==========================================================================

  private toOrderSummaryView(o: Order): SellerOrderSummaryView {
    return {
      id: o.id,
      storeId: o.storeId,
      orderNumber: o.orderNumber,
      customerId: o.customerId,
      status: o.status,
      subtotal: o.subtotal,
      discountTotal: o.discountTotal,
      grandTotal: o.grandTotal,
      formattedGrandTotal: this.formatCurrency(o.grandTotal),
      fulfillmentStatus: o.fulfillmentStatus,
      createdAt: o.createdAt,
    };
  }

  private toProductView(
    p: Product,
    categoryName: string | undefined,
    onHand: number,
    reserved: number,
    availableStock: number,
  ): SellerProductView {
    return {
      id: p.id,
      storeId: p.storeId,
      name: p.name,
      slug: p.slug,
      categoryId: p.categoryId,
      categoryName,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      formattedPrice: this.formatCurrency(p.price),
      status: p.status,
      onHand,
      reserved,
      availableStock,
      description: p.description,
      duration: (p.metadata as Record<string, unknown>)?.duration as string | undefined,
      warranty: (p.metadata as Record<string, unknown>)?.warranty as string | undefined,
    };
  }

  private toVoucherView(v: Voucher): SellerVoucherView {
    const formattedDiscount =
      v.discountType === 'PERCENTAGE'
        ? `${v.discountValue}%`
        : this.formatCurrency(v.discountValue);

    return {
      id: v.id,
      storeId: v.storeId,
      code: v.code,
      discountType: v.discountType,
      discountValue: v.discountValue,
      formattedDiscount,
      minimumPurchase: v.minimumPurchase,
      formattedMinimumPurchase: this.formatCurrency(v.minimumPurchase),
      usageLimit: v.usageLimit,
      usedCount: v.usedCount,
      status: v.status,
      expiresAt: v.expiresAt,
    };
  }

  private formatCurrency(amount: string): string {
    const num = Math.round(parseFloat(amount) || 0);
    return `Rp ${num.toLocaleString('id-ID')}`;
  }
}

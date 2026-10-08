/**
 * Bintang Tech Studio — Customer Storefront Application Service.
 * Baseline: Milestone M10 Customer Store Migration.
 *
 * Coordinates Store Context, Customer Identity, Catalog (M05),
 * Inventory (M06), Orders (M07), Payments (M08), and Fulfillment (M09).
 *
 * Golden Rules:
 * 1. Every operation runs inside an explicit, validated StoreContext.
 * 2. Never trust client-supplied price, total, stock, or status.
 * 3. Never trust client-supplied customerId or storeId.
 * 4. Fulfillment projections to customers are strictly sanitized.
 */

import { AuthenticatedStoreContext, createAuthenticatedStoreContext } from '@bintang/tenancy';
import { CatalogService, Product, Category } from '@bintang/commerce';
import { InventoryService } from '@bintang/inventory';
import { OrderService, OrderCaller, OrderWithItems } from '@bintang/orders';
import { PaymentService, PaymentCaller, PaymentIntent } from '@bintang/payments';
import { FulfillmentService, FulfillmentCaller, PublicFulfillment } from '@bintang/fulfillment';

import {
  ResolvedStoreContext,
  CustomerSession,
  CustomerCategoryView,
  CustomerProductView,
  CustomerProductDetailView,
  CartItemInput,
  CartValuationLine,
  CartValuationResult,
  CustomerCheckoutInput,
  CustomerCheckoutResult,
  InitiatePaymentInput,
  CustomerPaymentResult,
  CustomerFulfillmentView,
  CustomerOrderSummaryView,
  CustomerPromotionalVoucherView,
} from './types.js';
import {
  CustomerAccessDeniedError,
  ProductNotAvailableError,
  CartValidationError,
  CheckoutValidationError,
  PaymentNotAllowedError,
  CrossTenantAccessError,
} from './errors.js';
import { StoreContextResolver, CustomerSessionManager } from './context-resolver.js';
import { TEMPLATE_01_PROMOTIONAL_VOUCHERS } from './catalog-seed.js';

export interface CustomerStoreServiceOptions {
  readonly storeContextResolver: StoreContextResolver;
  readonly customerSessionManager: CustomerSessionManager;
  readonly catalogService: CatalogService;
  readonly orderService: OrderService;
  readonly paymentService: PaymentService;
  readonly fulfillmentService: FulfillmentService;
  readonly inventoryService?: InventoryService | undefined;
}

/**
 * Format numeric/string amount to standard Indonesian Rupiah display string.
 * Example: "19000.00" -> "Rp 19.000"
 */
export function formatRupiah(amount: string | number): string {
  const numeric = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numeric)) return 'Rp 0';
  return `Rp ${Math.round(numeric).toLocaleString('id-ID')}`;
}

export class CustomerStoreService {
  private readonly contextResolver: StoreContextResolver;
  private readonly sessionManager: CustomerSessionManager;
  private readonly catalogService: CatalogService;
  private readonly orderService: OrderService;
  private readonly paymentService: PaymentService;
  private readonly fulfillmentService: FulfillmentService;
  private readonly inventoryService?: InventoryService | undefined;

  constructor(options: CustomerStoreServiceOptions) {
    this.contextResolver = options.storeContextResolver;
    this.sessionManager = options.customerSessionManager;
    this.catalogService = options.catalogService;
    this.orderService = options.orderService;
    this.paymentService = options.paymentService;
    this.fulfillmentService = options.fulfillmentService;
    this.inventoryService = options.inventoryService;
  }

  /**
   * Helper to construct internal seller/admin context for internal system operations
   * (e.g. creating payment attempt or testing webhook settlement).
   */
  private getSystemStoreContext(storeId: string): AuthenticatedStoreContext {
    return createAuthenticatedStoreContext({
      storeId,
      userId: `system:customer-store:${storeId}`,
      membershipId: `sys_mem_${storeId}`,
      role: 'STORE_ADMIN',
    });
  }

  // =========================================================================
  // 1. CATALOG BROWSING & PRODUCT DETAIL (M05 Integration)
  // =========================================================================

  /**
   * Retrieves categories and products for storefront display.
   * Only returns ACTIVE products and categories.
   */
  async getCatalog(
    store: ResolvedStoreContext,
    filter?: { categorySlug?: string | undefined; search?: string | undefined },
  ): Promise<{
    readonly categories: readonly CustomerCategoryView[];
    readonly products: readonly CustomerProductView[];
  }> {
    const storeContext = this.contextResolver.toStoreContext(store);

    // Fetch active categories
    const categories = await this.catalogService.listCategories(storeContext, {
      status: 'ACTIVE',
    });

    const categoryMap = new Map<string, Category>();
    const categoryViewList: CustomerCategoryView[] = [];

    for (const cat of categories) {
      categoryMap.set(cat.id, cat);
      const meta = cat.metadata as Record<string, unknown>;
      categoryViewList.push({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: typeof meta?.icon === 'string' ? meta.icon : undefined,
        badge: typeof meta?.badge === 'string' ? meta.badge : undefined,
      });
    }

    // Fetch active products
    const products = await this.catalogService.listProducts(storeContext, {
      status: 'ACTIVE',
    });

    let filtered = products;

    // Category filtering
    if (filter?.categorySlug && filter.categorySlug !== 'semua' && filter.categorySlug !== 'all') {
      const targetCategory = categories.find(
        (c) => c.slug.toLowerCase() === filter.categorySlug!.toLowerCase(),
      );
      if (targetCategory) {
        filtered = filtered.filter((p) => p.categoryId === targetCategory.id);
      } else {
        filtered = [];
      }
    }

    // Text search filtering
    if (filter?.search?.trim()) {
      const q = filter.search.toLowerCase().trim();
      filtered = filtered.filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(q);
        const descMatch = p.description?.toLowerCase().includes(q) ?? false;
        const meta = p.metadata as Record<string, unknown>;
        const shortDescMatch =
          typeof meta?.shortDescription === 'string' &&
          meta.shortDescription.toLowerCase().includes(q);
        return nameMatch || descMatch || shortDescMatch;
      });
    }

    const productViewList: CustomerProductView[] = filtered.map((p) => {
      const meta = p.metadata as Record<string, unknown>;
      const cat = p.categoryId ? categoryMap.get(p.categoryId) : undefined;

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        categoryId: p.categoryId,
        categoryName: cat?.name,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        formattedPrice: formatRupiah(p.price),
        formattedCompareAtPrice: p.compareAtPrice ? formatRupiah(p.compareAtPrice) : undefined,
        isAvailable: p.status === 'ACTIVE',
        duration: typeof meta?.duration === 'string' ? meta.duration : undefined,
        shortDescription:
          typeof meta?.shortDescription === 'string' ? meta.shortDescription : undefined,
        monogram: typeof meta?.monogram === 'string' ? meta.monogram : undefined,
        badge: typeof meta?.badge === 'string' ? meta.badge : undefined,
        rating: typeof meta?.rating === 'number' ? meta.rating : 5.0,
        soldCount: typeof meta?.soldCount === 'number' ? meta.soldCount : 0,
      };
    });

    return {
      categories: categoryViewList,
      products: productViewList,
    };
  }

  /**
   * Retrieves authoritative product details for product modal or detail page.
   */
  async getProductDetail(
    store: ResolvedStoreContext,
    productId: string,
  ): Promise<CustomerProductDetailView> {
    const storeContext = this.contextResolver.toStoreContext(store);

    const product = await this.catalogService.getProductById(storeContext, productId);
    if (product.storeId !== store.storeId) {
      throw new CrossTenantAccessError(
        `Product "${productId}" does not belong to store "${store.storeId}"`,
      );
    }

    if (product.status !== 'ACTIVE') {
      throw new ProductNotAvailableError(productId, `Product status is ${product.status}`);
    }

    let categoryName: string | undefined;
    if (product.categoryId) {
      try {
        const cat = await this.catalogService.getCategoryById(storeContext, product.categoryId);
        categoryName = cat.name;
      } catch {
        // Optional category lookup
      }
    }

    // Query inventory quantity
    let stockQuantity = 999;
    if (this.inventoryService && product.stockMode === 'TRACKED') {
      try {
        const inv = await this.inventoryService.getInventory(storeContext, product.id);
        stockQuantity = Math.max(0, inv.quantityOnHand - inv.quantityReserved);
      } catch {
        // Fallback to metadata stock
        const meta = product.metadata as Record<string, unknown>;
        if (typeof meta?.stock === 'number') {
          stockQuantity = meta.stock;
        }
      }
    }

    const meta = product.metadata as Record<string, unknown>;

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      categoryId: product.categoryId,
      categoryName,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      formattedPrice: formatRupiah(product.price),
      formattedCompareAtPrice: product.compareAtPrice
        ? formatRupiah(product.compareAtPrice)
        : undefined,
      isAvailable: product.status === 'ACTIVE' && stockQuantity > 0,
      duration: typeof meta?.duration === 'string' ? meta.duration : undefined,
      shortDescription:
        typeof meta?.shortDescription === 'string' ? meta.shortDescription : undefined,
      monogram: typeof meta?.monogram === 'string' ? meta.monogram : undefined,
      badge: typeof meta?.badge === 'string' ? meta.badge : undefined,
      rating: typeof meta?.rating === 'number' ? meta.rating : 5.0,
      soldCount: typeof meta?.soldCount === 'number' ? meta.soldCount : 0,
      description: product.description,
      benefits: Array.isArray(meta?.benefits) ? (meta.benefits as string[]) : [],
      importantInfo: typeof meta?.importantInfo === 'string' ? meta.importantInfo : null,
      stockQuantity,
      stockMode: product.stockMode,
    };
  }

  // =========================================================================
  // 2. AUTHORITATIVE CART VALUATION (Client Draft -> Server Truth)
  // =========================================================================

  /**
   * Calculates authoritative pricing and inventory availability for a draft cart.
   * Client-supplied prices and totals are completely ignored and recomputed server-side.
   */
  async getCartValuation(
    store: ResolvedStoreContext,
    items: readonly CartItemInput[],
  ): Promise<CartValuationResult> {
    const storeContext = this.contextResolver.toStoreContext(store);

    if (!items || items.length === 0) {
      return {
        storeId: store.storeId,
        currency: store.currency,
        lines: [],
        subtotal: '0.00',
        discountTotal: '0.00',
        grandTotal: '0.00',
        isValid: true,
        validationIssues: [],
      };
    }

    const lines: CartValuationLine[] = [];
    const validationIssues: string[] = [];
    let subtotalCents = 0;

    for (const item of items) {
      if (item.quantity <= 0) {
        validationIssues.push(`Quantity for product "${item.productId}" must be greater than zero`);
        continue;
      }

      let product: Product;
      try {
        product = await this.catalogService.getProductById(storeContext, item.productId);
      } catch {
        validationIssues.push(`Product "${item.productId}" not found in store`);
        continue;
      }

      if (product.storeId !== store.storeId) {
        validationIssues.push(`Product "${item.productId}" belongs to a different store`);
        continue;
      }

      if (product.status !== 'ACTIVE') {
        validationIssues.push(`Product "${product.name}" is no longer active`);
        continue;
      }

      // Check stock
      let availableQuantity = 999;
      let stockIssue: string | undefined;

      if (this.inventoryService && product.stockMode === 'TRACKED') {
        try {
          const inv = await this.inventoryService.getInventory(storeContext, product.id);
          availableQuantity = Math.max(0, inv.quantityOnHand - inv.quantityReserved);
          if (item.quantity > availableQuantity) {
            stockIssue = `Requested ${item.quantity}, but only ${availableQuantity} available`;
            validationIssues.push(
              `Stok "${product.name}" tidak mencukupi (${availableQuantity} tersisa)`,
            );
          }
        } catch {
          // Inventory lookup failure
        }
      }

      const unitPriceCents = Math.round(parseFloat(product.price) * 100);
      const lineTotalCents = unitPriceCents * item.quantity;
      subtotalCents += lineTotalCents;

      lines.push({
        productId: product.id,
        productName: product.name,
        requestedQuantity: item.quantity,
        availableQuantity,
        unitPrice: (unitPriceCents / 100).toFixed(2),
        lineTotal: (lineTotalCents / 100).toFixed(2),
        isAvailable: availableQuantity >= item.quantity,
        stockIssue,
      });
    }

    const subtotal = (subtotalCents / 100).toFixed(2);
    const discountTotal = '0.00'; // Vouchers deferred
    const grandTotal = subtotal;

    return {
      storeId: store.storeId,
      currency: store.currency,
      lines,
      subtotal,
      discountTotal,
      grandTotal,
      isValid: validationIssues.length === 0,
      validationIssues,
    };
  }

  // =========================================================================
  // 3. CHECKOUT & ORDER CREATION (M07 Integration)
  // =========================================================================

  /**
   * Executes authoritative customer checkout.
   * Creates an authoritative order via M07 OrderService, reserving inventory.
   */
  async checkout(
    store: ResolvedStoreContext,
    session: CustomerSession,
    input: CustomerCheckoutInput,
  ): Promise<CustomerCheckoutResult> {
    if (session.storeId !== store.storeId) {
      throw new CustomerAccessDeniedError('Customer session does not match store context');
    }

    if (!input.items || input.items.length === 0) {
      throw new CheckoutValidationError('Checkout requires at least one item');
    }

    if (!input.customerName?.trim()) {
      throw new CheckoutValidationError('Customer name is required');
    }

    // Perform authoritative cart valuation
    const valuation = await this.getCartValuation(store, input.items);
    if (!valuation.isValid) {
      throw new CartValidationError(
        'Cannot checkout: cart contains validation issues',
        valuation.validationIssues,
      );
    }

    // Build customer caller
    const customerContext = this.sessionManager.toCustomerContext(session);
    const caller: OrderCaller = {
      type: 'CUSTOMER',
      context: customerContext,
    };

    // Call M07 OrderService
    const orderWithItems: OrderWithItems = await this.orderService.createOrder(caller, {
      customerId: session.customerId,
      items: input.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
      currency: store.currency,
      idempotencyKey: input.idempotencyKey,
      metadata: {
        customerName: input.customerName.trim(),
        customerEmail: input.customerEmail?.trim(),
        customerPhone: input.customerPhone?.trim(),
        notes: input.notes?.trim(),
        checkoutSource: 'CUSTOMER_STOREFRONT_M10',
      },
    });

    return {
      orderId: orderWithItems.id,
      orderNumber: orderWithItems.orderNumber,
      status: orderWithItems.status,
      subtotal: orderWithItems.subtotal,
      grandTotal: orderWithItems.grandTotal,
      currency: orderWithItems.currency,
      createdAt: orderWithItems.createdAt,
      items: orderWithItems.items.map((it) => ({
        id: it.id,
        productId: it.productId,
        productName: it.productName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        subtotal: it.subtotal,
      })),
    };
  }

  // =========================================================================
  // 4. PAYMENT BOUNDARY (M08 Integration)
  // =========================================================================

  /**
   * Initiates payment for an order via M08 PaymentService.
   */
  async initiatePayment(
    store: ResolvedStoreContext,
    session: CustomerSession,
    input: InitiatePaymentInput,
  ): Promise<CustomerPaymentResult> {
    if (session.storeId !== store.storeId) {
      throw new CustomerAccessDeniedError('Customer session does not match store context');
    }

    const customerContext = this.sessionManager.toCustomerContext(session);
    const caller: PaymentCaller = {
      type: 'CUSTOMER',
      context: customerContext,
    };

    // Verify order exists and belongs to customer
    const order = await this.orderService.getOrderById(
      { type: 'CUSTOMER', context: customerContext },
      input.orderId,
    );

    if (order.status !== 'PENDING_PAYMENT') {
      throw new PaymentNotAllowedError(`Order cannot be paid: status is ${order.status}`);
    }

    // Create PaymentIntent via M08
    const intent: PaymentIntent = await this.paymentService.createPaymentIntent(caller, {
      orderId: input.orderId,
      idempotencyKey: input.idempotencyKey,
    });

    // Create PaymentAttempt via system seller context
    const sellerContext = this.getSystemStoreContext(store.storeId);
    try {
      await this.paymentService.createPaymentAttempt(
        { type: 'SELLER', context: sellerContext },
        {
          paymentIntentId: intent.id,
        },
      );
    } catch {
      // Attempt creation best effort
    }

    // Realistic QRIS payload representation for presentation
    const qrPayload = `00020101021226600016ID.CO.QRIS.WWW01189360099812984102930214BINTANG0015802ID5913BINTANG STORE6007JAKARTA61051219062070703A016304${intent.id.slice(0, 4).toUpperCase()}`;

    return {
      paymentIntentId: intent.id,
      orderId: order.id,
      amount: intent.amount,
      currency: intent.currency,
      status: intent.status,
      provider: intent.provider,
      qrPayload,
      instructions:
        'Pindai kode QRIS menggunakan GoPay, OVO, Dana, BCA, atau Mobile Banking apa pun.',
      expiresAt: intent.expiresAt,
    };
  }

  /**
   * DEMO/SIMULATION HELPER: Simulates settlement of a payment intent.
   * Coordinates via the approved M08 webhook/settlement path to transition PaymentIntent to SUCCEEDED
   * and update Order to PAID.
   */
  async simulatePaymentSuccess(
    store: ResolvedStoreContext,
    paymentIntentId: string,
  ): Promise<{
    readonly success: boolean;
    readonly paymentIntentStatus: string;
    readonly orderId: string;
  }> {
    const sellerContext = this.getSystemStoreContext(store.storeId);
    const intent = await this.paymentService.getPaymentIntentById(
      { type: 'SELLER', context: sellerContext },
      paymentIntentId,
    );

    // Call M08 webhook processing simulation
    const webhookResult = await this.paymentService.processPaymentWebhook({
      provider: intent.provider,
      eventId: `sim_evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      eventType: 'payment.succeeded',
      storeId: store.storeId,
      paymentIntentId: intent.id,
      amount: intent.amount,
      currency: intent.currency,
      signature: 'valid_signature',
      payload: {
        simulation: true,
        settledAt: new Date().toISOString(),
      },
    });

    return {
      success: webhookResult.processingStatus === 'PROCESSED',
      paymentIntentStatus: webhookResult.currentStatus ?? 'SUCCEEDED',
      orderId: intent.orderId,
    };
  }

  // =========================================================================
  // 5. FULFILLMENT BOUNDARY (M09 Integration)
  // =========================================================================

  /**
   * Retrieves sanitized customer-facing fulfillment status.
   * Strips internal inventoryItemId, failure metadata, and provider secret credentials.
   */
  async getOrderFulfillment(
    store: ResolvedStoreContext,
    session: CustomerSession,
    orderId: string,
  ): Promise<CustomerFulfillmentView | null> {
    if (session.storeId !== store.storeId) {
      throw new CustomerAccessDeniedError('Customer session does not match store context');
    }

    const customerContext = this.sessionManager.toCustomerContext(session);
    const caller: FulfillmentCaller = {
      type: 'CUSTOMER',
      context: customerContext,
    };

    // Ensure customer owns the order
    await this.orderService.getOrderById(caller, orderId);

    // Query fulfillments
    const fulfillments: readonly PublicFulfillment[] =
      await this.fulfillmentService.listFulfillments(caller, {
        orderId,
      });

    if (fulfillments.length === 0) {
      return null;
    }

    const f = fulfillments[0]!;
    return {
      id: f.id,
      orderId: f.orderId,
      status: f.status,
      strategy: f.strategy,
      trackingInfo: f.trackingInfo,
      items: f.items.map((it) => ({
        id: it.id,
        orderItemId: it.orderItemId,
        itemType: it.itemType,
        status: it.status,
        payloadReference: it.payloadReference,
      })),
    };
  }

  // =========================================================================
  // 6. ORDER HISTORY & ORDER DETAIL (M07 Integration)
  // =========================================================================

  /**
   * Retrieves order history strictly scoped to the authenticated customer.
   */
  async listCustomerOrders(
    store: ResolvedStoreContext,
    session: CustomerSession,
    filter?: { limit?: number; offset?: number },
  ): Promise<readonly CustomerOrderSummaryView[]> {
    if (session.storeId !== store.storeId) {
      throw new CustomerAccessDeniedError('Customer session does not match store context');
    }

    const customerContext = this.sessionManager.toCustomerContext(session);
    const caller: OrderCaller = {
      type: 'CUSTOMER',
      context: customerContext,
    };

    const orders = await this.orderService.listOrders(caller, {
      customerId: session.customerId,
      limit: filter?.limit ?? 50,
      offset: filter?.offset ?? 0,
    });

    return orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      grandTotal: o.grandTotal,
      currency: o.currency,
      itemCount: 0, // Summary projection
      fulfillmentStatus: o.fulfillmentStatus,
      createdAt: o.createdAt,
    }));
  }

  /**
   * Retrieves single order details strictly scoped to the authenticated customer.
   */
  async getCustomerOrder(
    store: ResolvedStoreContext,
    session: CustomerSession,
    orderId: string,
  ): Promise<OrderWithItems> {
    if (session.storeId !== store.storeId) {
      throw new CustomerAccessDeniedError('Customer session does not match store context');
    }

    const customerContext = this.sessionManager.toCustomerContext(session);
    const caller: OrderCaller = {
      type: 'CUSTOMER',
      context: customerContext,
    };

    return this.orderService.getOrderById(caller, orderId);
  }

  // =========================================================================
  // 7. PROMOTIONAL VOUCHERS (Informational Presentation)
  // =========================================================================

  /**
   * Returns promotional vouchers for customer informational display.
   */
  listPromotionalVouchers(): readonly CustomerPromotionalVoucherView[] {
    return TEMPLATE_01_PROMOTIONAL_VOUCHERS;
  }
}

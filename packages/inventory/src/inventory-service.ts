import { AuthenticatedStoreContext, StoreContext } from '@bintang/tenancy';
import { AuthorizationService } from '@bintang/authorization';
import { ProductRepository } from '@bintang/commerce';
import { InventoryRepository } from './inventory-repository.js';
import { InventoryItemRepository, CreateInventoryItemInput } from './inventory-item-repository.js';
import {
  Inventory,
  InventoryItem,
  InventoryItemStatus,
  InventoryAvailability,
  AdjustStockInput,
  ReserveStockInput,
  ReleaseStockInput,
  ConsumeStockInput,
} from './types.js';
import {
  InventoryNotFoundError,
  CrossTenantInventoryError,
  UnsupportedStockModeError,
} from './errors.js';
import { generateUUID, validateQuantity, validatePositiveAmount } from './validation.js';

export interface InventoryServiceOptions {
  readonly inventoryRepository: InventoryRepository;
  readonly productRepository: ProductRepository;
  readonly authorizationService: AuthorizationService;
  readonly inventoryItemRepository?: InventoryItemRepository | undefined;
}

/**
 * Tenant-scoped Inventory Service coordinating aggregate stock levels,
 * stock modes (TRACKED vs UNLIMITED), atomic reservations, releases,
 * consumptions, and individual credential items.
 *
 * Enforces Zero Client Trust: StoreContext from server authentication
 * is the sole boundary of authorization and tenant isolation.
 */
export class InventoryService {
  private readonly inventoryRepo: InventoryRepository;
  private readonly productRepo: ProductRepository;
  private readonly authService: AuthorizationService;
  private readonly itemRepo?: InventoryItemRepository | undefined;

  constructor(options: InventoryServiceOptions) {
    this.inventoryRepo = options.inventoryRepository;
    this.productRepo = options.productRepository;
    this.authService = options.authorizationService;
    this.itemRepo = options.inventoryItemRepository;
  }

  /**
   * Initializes an inventory tracking record for a product within the authenticated store.
   */
  async initializeInventory(
    context: AuthenticatedStoreContext | StoreContext,
    productId: string,
    initialOnHand = 0,
  ): Promise<Inventory> {
    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'inventory.update',
      targetStoreId: context.storeId,
    });

    const product = await this.productRepo.findById(context.storeId, productId);
    if (!product) {
      throw new CrossTenantInventoryError(
        `Product ${productId} does not belong to store ${context.storeId} or does not exist`,
      );
    }

    const existing = await this.inventoryRepo.findByProductId(context.storeId, productId);
    if (existing) {
      return existing;
    }

    const validatedOnHand = validateQuantity(initialOnHand, 'initial quantity on hand');

    const now = new Date().toISOString();
    return this.inventoryRepo.create(context.storeId, {
      id: generateUUID(),
      storeId: context.storeId,
      productId,
      quantityOnHand: validatedOnHand,
      quantityReserved: 0,
      updatedAt: now,
    });
  }

  /**
   * Retrieves the inventory aggregate record for a product within the store boundary.
   */
  async getInventory(
    context: AuthenticatedStoreContext | StoreContext,
    productId: string,
  ): Promise<Inventory> {
    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'inventory.read',
      targetStoreId: context.storeId,
    });

    const product = await this.productRepo.findById(context.storeId, productId);
    if (!product) {
      throw new CrossTenantInventoryError(
        `Product ${productId} does not belong to store ${context.storeId} or does not exist`,
      );
    }

    const record = await this.inventoryRepo.findByProductId(context.storeId, productId);
    if (!record) {
      throw new InventoryNotFoundError(productId);
    }

    return record;
  }

  /**
   * Lists all inventory records within the store boundary.
   */
  async listInventory(
    context: AuthenticatedStoreContext | StoreContext,
  ): Promise<readonly Inventory[]> {
    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'inventory.read',
      targetStoreId: context.storeId,
    });

    return this.inventoryRepo.list(context.storeId);
  }

  /**
   * Evaluates current availability for a product, honoring its stockMode.
   * UNLIMITED returns infinite availability without finite quantity constraints.
   * TRACKED computes available = quantityOnHand - quantityReserved.
   */
  async getAvailability(
    context: AuthenticatedStoreContext | StoreContext,
    productId: string,
  ): Promise<InventoryAvailability> {
    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'inventory.read',
      targetStoreId: context.storeId,
    });

    const product = await this.productRepo.findById(context.storeId, productId);
    if (!product) {
      throw new CrossTenantInventoryError(
        `Product ${productId} does not belong to store ${context.storeId} or does not exist`,
      );
    }

    if (product.stockMode === 'UNLIMITED') {
      return {
        productId: product.id,
        storeId: context.storeId,
        stockMode: 'UNLIMITED',
        quantityOnHand: 0,
        quantityReserved: 0,
        availableQuantity: Number.POSITIVE_INFINITY,
        isAvailable: true,
      };
    }

    const record = await this.inventoryRepo.findByProductId(context.storeId, productId);
    const onHand = record ? record.quantityOnHand : 0;
    const reserved = record ? record.quantityReserved : 0;
    const available = Math.max(0, onHand - reserved);

    return {
      productId: product.id,
      storeId: context.storeId,
      stockMode: 'TRACKED',
      quantityOnHand: onHand,
      quantityReserved: reserved,
      availableQuantity: available,
      isAvailable: available > 0,
    };
  }

  /**
   * Atomically adjusts stock quantity on hand (INCREASE, DECREASE, SET).
   * Prohibited for UNLIMITED stockMode products.
   */
  async adjustStock(
    context: AuthenticatedStoreContext | StoreContext,
    productId: string,
    input: AdjustStockInput,
  ): Promise<Inventory> {
    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'inventory.update',
      targetStoreId: context.storeId,
    });

    const product = await this.productRepo.findById(context.storeId, productId);
    if (!product) {
      throw new CrossTenantInventoryError(
        `Product ${productId} does not belong to store ${context.storeId} or does not exist`,
      );
    }

    if (product.stockMode === 'UNLIMITED') {
      throw new UnsupportedStockModeError('UNLIMITED', 'adjustStock');
    }

    // Ensure inventory record exists before adjustment
    let record = await this.inventoryRepo.findByProductId(context.storeId, productId);
    if (!record) {
      record = await this.inventoryRepo.create(context.storeId, {
        id: generateUUID(),
        storeId: context.storeId,
        productId,
        quantityOnHand: 0,
        quantityReserved: 0,
        updatedAt: new Date().toISOString(),
      });
    }

    return this.inventoryRepo.atomicAdjustStock(context.storeId, productId, input);
  }

  /**
   * Atomically reserves stock.
   * If stockMode === UNLIMITED, reservation succeeds trivially without depleting stock.
   * If stockMode === TRACKED, increments quantityReserved if available >= amount.
   */
  async reserveStock(
    context: AuthenticatedStoreContext | StoreContext,
    productId: string,
    input: ReserveStockInput,
  ): Promise<Inventory> {
    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'inventory.update',
      targetStoreId: context.storeId,
    });

    const product = await this.productRepo.findById(context.storeId, productId);
    if (!product) {
      throw new CrossTenantInventoryError(
        `Product ${productId} does not belong to store ${context.storeId} or does not exist`,
      );
    }

    validatePositiveAmount(input.amount, 'reservation amount');

    if (product.stockMode === 'UNLIMITED') {
      let record = await this.inventoryRepo.findByProductId(context.storeId, productId);
      if (!record) {
        record = await this.inventoryRepo.create(context.storeId, {
          id: generateUUID(),
          storeId: context.storeId,
          productId,
          quantityOnHand: 0,
          quantityReserved: 0,
          updatedAt: new Date().toISOString(),
        });
      }
      return record;
    }

    return this.inventoryRepo.atomicReserve(context.storeId, productId, input.amount);
  }

  /**
   * Atomically releases a previously reserved stock quantity.
   * If stockMode === UNLIMITED, release is a no-op.
   * If stockMode === TRACKED, decrements quantityReserved.
   */
  async releaseStock(
    context: AuthenticatedStoreContext | StoreContext,
    productId: string,
    input: ReleaseStockInput,
  ): Promise<Inventory> {
    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'inventory.update',
      targetStoreId: context.storeId,
    });

    const product = await this.productRepo.findById(context.storeId, productId);
    if (!product) {
      throw new CrossTenantInventoryError(
        `Product ${productId} does not belong to store ${context.storeId} or does not exist`,
      );
    }

    validatePositiveAmount(input.amount, 'release amount');

    if (product.stockMode === 'UNLIMITED') {
      let record = await this.inventoryRepo.findByProductId(context.storeId, productId);
      if (!record) {
        record = await this.inventoryRepo.create(context.storeId, {
          id: generateUUID(),
          storeId: context.storeId,
          productId,
          quantityOnHand: 0,
          quantityReserved: 0,
          updatedAt: new Date().toISOString(),
        });
      }
      return record;
    }

    return this.inventoryRepo.atomicRelease(context.storeId, productId, input.amount);
  }

  /**
   * Atomically consumes/deducts stock.
   * fromReserved === true: deducts from both quantityReserved and quantityOnHand.
   * fromReserved === false: deducts directly from quantityOnHand (available >= amount).
   */
  async consumeStock(
    context: AuthenticatedStoreContext | StoreContext,
    productId: string,
    input: ConsumeStockInput,
  ): Promise<Inventory> {
    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'inventory.update',
      targetStoreId: context.storeId,
    });

    const product = await this.productRepo.findById(context.storeId, productId);
    if (!product) {
      throw new CrossTenantInventoryError(
        `Product ${productId} does not belong to store ${context.storeId} or does not exist`,
      );
    }

    validatePositiveAmount(input.amount, 'consumption amount');

    if (product.stockMode === 'UNLIMITED') {
      let record = await this.inventoryRepo.findByProductId(context.storeId, productId);
      if (!record) {
        record = await this.inventoryRepo.create(context.storeId, {
          id: generateUUID(),
          storeId: context.storeId,
          productId,
          quantityOnHand: 0,
          quantityReserved: 0,
          updatedAt: new Date().toISOString(),
        });
      }
      return record;
    }

    return this.inventoryRepo.atomicConsume(
      context.storeId,
      productId,
      input.amount,
      input.fromReserved,
    );
  }

  /**
   * Convenience method to consume reserved stock (e.g. order fulfillment after checkout reservation).
   */
  async consumeReserved(
    context: AuthenticatedStoreContext | StoreContext,
    productId: string,
    amount: number,
    orderId?: string | undefined,
  ): Promise<Inventory> {
    return this.consumeStock(context, productId, {
      amount,
      fromReserved: true,
      orderId,
    });
  }

  /**
   * Convenience method to consume available stock directly (e.g. immediate purchase without prior reservation).
   */
  async consumeAvailable(
    context: AuthenticatedStoreContext | StoreContext,
    productId: string,
    amount: number,
    orderId?: string | undefined,
  ): Promise<Inventory> {
    return this.consumeStock(context, productId, {
      amount,
      fromReserved: false,
      orderId,
    });
  }

  // --- Inventory Item Operations (Serialized digital credentials/keys) ---

  /**
   * Creates an individual digital item / credential for a product.
   */
  async createInventoryItem(
    context: AuthenticatedStoreContext | StoreContext,
    input: CreateInventoryItemInput,
  ): Promise<InventoryItem> {
    if (!this.itemRepo) {
      throw new Error('InventoryItemRepository is not configured on InventoryService');
    }

    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'inventory.update',
      targetStoreId: context.storeId,
    });

    const product = await this.productRepo.findById(context.storeId, input.productId);
    if (!product) {
      throw new CrossTenantInventoryError(
        `Product ${input.productId} does not belong to store ${context.storeId} or does not exist`,
      );
    }

    const now = new Date().toISOString();
    const item: InventoryItem = {
      id: generateUUID(),
      storeId: context.storeId,
      productId: input.productId,
      inventoryId: input.inventoryId ?? null,
      itemType: input.itemType ?? 'CREDENTIAL',
      secretReference: input.secretReference,
      status: 'AVAILABLE',
      reservedOrderId: null,
      assignedOrderId: null,
      reservedAt: null,
      reservedUntil: null,
      assignedAt: null,
      metadata: Object.freeze({ ...(input.metadata ?? {}) }),
      createdAt: now,
      updatedAt: now,
    };

    return this.itemRepo.create(context.storeId, item);
  }

  /**
   * Lists inventory items for a product within the store boundary.
   */
  async listInventoryItems(
    context: AuthenticatedStoreContext | StoreContext,
    productId: string,
    status?: InventoryItemStatus,
  ): Promise<readonly InventoryItem[]> {
    if (!this.itemRepo) {
      throw new Error('InventoryItemRepository is not configured on InventoryService');
    }

    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'inventory.read',
      targetStoreId: context.storeId,
    });

    const product = await this.productRepo.findById(context.storeId, productId);
    if (!product) {
      throw new CrossTenantInventoryError(
        `Product ${productId} does not belong to store ${context.storeId} or does not exist`,
      );
    }

    return this.itemRepo.listByProductId(context.storeId, productId, status);
  }

  /**
   * Updates an inventory item's lifecycle status.
   */
  async updateInventoryItemStatus(
    context: AuthenticatedStoreContext | StoreContext,
    itemId: string,
    status: InventoryItemStatus,
    patch?: {
      readonly reservedOrderId?: string | null | undefined;
      readonly assignedOrderId?: string | null | undefined;
      readonly reservedAt?: string | null | undefined;
      readonly reservedUntil?: string | null | undefined;
      readonly assignedAt?: string | null | undefined;
    },
  ): Promise<InventoryItem> {
    if (!this.itemRepo) {
      throw new Error('InventoryItemRepository is not configured on InventoryService');
    }

    await this.authService.assertAuthorizedStoreAction({
      context,
      permission: 'inventory.update',
      targetStoreId: context.storeId,
    });

    const item = await this.itemRepo.findById(context.storeId, itemId);
    if (!item) {
      throw new InventoryNotFoundError(`Item ${itemId}`);
    }

    return this.itemRepo.updateStatus(context.storeId, itemId, status, patch);
  }
}

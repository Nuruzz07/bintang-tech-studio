import { AuthorizationService } from '@bintang/authorization';
import { OrderService } from '@bintang/orders';
import { InventoryService } from '@bintang/inventory';
import {
  Fulfillment,
  FulfillmentItem,
  FulfillmentWithItems,
  PublicFulfillment,
  FulfillmentCaller,
  FulfillmentFilter,
  CreateFulfillmentInput,
  ExecuteFulfillmentInput,
  RetryFulfillmentInput,
  FulfillmentDeliveryResult,
} from './types.js';
import { FulfillmentRepository } from './fulfillment-repository.js';
import { FulfillmentItemRepository } from './fulfillment-item-repository.js';
import { FulfillmentIdempotencyRepository } from './idempotency-repository.js';
import { FulfillmentProviderAdapter } from './provider-adapter.js';
import { MockFulfillmentProviderAdapter } from './mock-provider-adapter.js';
import {
  FulfillmentNotFoundError,
  FulfillmentOrderNotPayableError,
  FulfillmentOrderInvalidStateError,
  FulfillmentStoreMismatchError,
  FulfillmentCustomerAccessDeniedError,
  FulfillmentStateTransitionError,
  FulfillmentAlreadyCompletedError,
  FulfillmentAlreadyExistsError,
  FulfillmentProviderUnsupportedError,
  FulfillmentExecutionError,
  FulfillmentRetryNotAllowedError,
  FulfillmentIdempotencyConflictError,
} from './errors.js';
import {
  generateUUID,
  validateFulfillmentStrategy,
  validateFulfillmentStateTransition,
} from './validation.js';

export interface FulfillmentServiceOptions {
  readonly fulfillmentRepository: FulfillmentRepository;
  readonly fulfillmentItemRepository: FulfillmentItemRepository;
  readonly orderService: OrderService;
  readonly authorizationService: AuthorizationService;
  readonly inventoryService?: InventoryService | undefined;
  readonly idempotencyRepository?: FulfillmentIdempotencyRepository | undefined;
  readonly providers?: readonly FulfillmentProviderAdapter[] | undefined;
}

function hashPayload(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

function toPublicFulfillment(f: FulfillmentWithItems): PublicFulfillment {
  return {
    id: f.id,
    storeId: f.storeId,
    orderId: f.orderId,
    strategy: f.strategy,
    status: f.status,
    trackingInfo: f.trackingInfo,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    items: f.items.map((i) => ({
      id: i.id,
      orderItemId: i.orderItemId,
      itemType: i.itemType,
      status: i.status,
      payloadReference: i.payloadReference,
      createdAt: i.createdAt,
    })),
  };
}

export class FulfillmentService {
  private readonly fulfillmentRepo: FulfillmentRepository;
  private readonly fulfillmentItemRepo: FulfillmentItemRepository;
  private readonly orderService: OrderService;
  private readonly authService: AuthorizationService;
  private readonly inventoryService?: InventoryService | undefined;
  private readonly idempotencyRepo?: FulfillmentIdempotencyRepository | undefined;
  private readonly providers = new Map<string, FulfillmentProviderAdapter>();
  private readonly inFlightLocks = new Map<string, Promise<void>>();

  constructor(options: FulfillmentServiceOptions) {
    this.fulfillmentRepo = options.fulfillmentRepository;
    this.fulfillmentItemRepo = options.fulfillmentItemRepository;
    this.orderService = options.orderService;
    this.authService = options.authorizationService;
    this.inventoryService = options.inventoryService;
    this.idempotencyRepo = options.idempotencyRepository;

    if (options.providers && options.providers.length > 0) {
      for (const provider of options.providers) {
        this.providers.set(provider.providerName, provider);
      }
    } else {
      const defaultMock = new MockFulfillmentProviderAdapter();
      this.providers.set(defaultMock.providerName, defaultMock);
    }
  }

  private async acquireInFlightLock(key: string): Promise<() => void> {
    while (this.inFlightLocks.has(key)) {
      await this.inFlightLocks.get(key);
    }

    let release!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      release = () => {
        this.inFlightLocks.delete(key);
        resolve();
      };
    });

    this.inFlightLocks.set(key, lockPromise);
    return release;
  }

  private deriveActorId(caller: FulfillmentCaller): string {
    if (caller.type === 'SELLER') {
      if ('userId' in caller.context && caller.context.userId) {
        return caller.context.userId;
      }
      return `seller:${caller.context.storeId}`;
    }
    return caller.context.customerId;
  }

  /**
   * Creates a new fulfillment for an order.
   * Prerequisites: Order must belong to the store and be in PAID or PROCESSING status.
   * Assigns digital inventory items if available and product is tracked.
   */
  async createFulfillment(
    caller: FulfillmentCaller,
    input: CreateFulfillmentInput,
  ): Promise<FulfillmentWithItems> {
    if (caller.type === 'CUSTOMER') {
      throw new FulfillmentCustomerAccessDeniedError(
        'Customers are not permitted to create fulfillments',
      );
    }

    const storeId = caller.context.storeId;

    await this.authService.assertAuthorizedStoreAction({
      context: caller.context,
      permission: 'fulfillment.process',
      targetStoreId: storeId,
    });

    const strategy = input.strategy ?? 'DIGITAL_AUTO';
    validateFulfillmentStrategy(strategy);

    const lockKey = `${storeId}:create:${input.orderId}`;
    const releaseLock = await this.acquireInFlightLock(lockKey);

    try {
      const actorId = this.deriveActorId(caller);
      const payloadHash = hashPayload({
        orderId: input.orderId,
        strategy,
        metadata: input.metadata,
      });

      // Idempotency check
      if (input.idempotencyKey && this.idempotencyRepo) {
        const existingRecord = await this.idempotencyRepo.get(
          storeId,
          actorId,
          input.idempotencyKey,
        );
        if (existingRecord) {
          if (existingRecord.requestHash !== payloadHash) {
            throw new FulfillmentIdempotencyConflictError(input.idempotencyKey);
          }
          return existingRecord.response as FulfillmentWithItems;
        }
      }

      // Fetch and validate order
      const order = await this.orderService.getOrderById(caller, input.orderId);
      if (order.storeId !== storeId) {
        throw new FulfillmentStoreMismatchError(
          `Order store "${order.storeId}" does not match context store "${storeId}"`,
        );
      }

      // Check payment prerequisite
      if (order.status === 'PENDING_PAYMENT') {
        throw new FulfillmentOrderNotPayableError(order.id, order.status);
      }
      if (order.status === 'CANCELLED' || order.status === 'EXPIRED') {
        throw new FulfillmentOrderInvalidStateError(order.id, order.status);
      }
      if (order.status === 'FULFILLED') {
        throw new FulfillmentAlreadyCompletedError(order.id);
      }

      // Invariant: single active fulfillment per order
      const existingFulfillment = await this.fulfillmentRepo.findActiveByOrderId(storeId, order.id);
      if (existingFulfillment) {
        throw new FulfillmentAlreadyExistsError(order.id, existingFulfillment.id);
      }

      const fulfillmentId = generateUUID();
      const now = new Date().toISOString();

      // Create fulfillment items with optional digital item assignment
      const fulfillmentItems: FulfillmentItem[] = [];
      const assignedItemIdsInBatch = new Set<string>();

      for (const orderItem of order.items) {
        let assignedInventoryItemId: string | null = null;

        if (this.inventoryService && strategy === 'DIGITAL_AUTO' && orderItem.productId) {
          try {
            const productLockKey = `${storeId}:inventory:${orderItem.productId}`;
            const releaseProductLock = await this.acquireInFlightLock(productLockKey);
            try {
              const availableItems = await this.inventoryService.listInventoryItems(
                caller.context,
                orderItem.productId,
                'AVAILABLE',
              );
              const candidate = availableItems.find(
                (item) => item.status === 'AVAILABLE' && !assignedItemIdsInBatch.has(item.id),
              );
              if (candidate) {
                assignedItemIdsInBatch.add(candidate.id);
                await this.inventoryService.updateInventoryItemStatus(
                  caller.context,
                  candidate.id,
                  'ASSIGNED',
                  {
                    assignedOrderId: order.id,
                    assignedAt: now,
                  },
                );
                assignedInventoryItemId = candidate.id;
              }
            } finally {
              releaseProductLock();
            }
          } catch {
            // Inventory items may not be configured for non-serialized products
          }
        }

        const itemType =
          strategy === 'DIGITAL_AUTO' || strategy === 'DIGITAL_MANUAL'
            ? 'CREDENTIAL'
            : strategy === 'PHYSICAL'
              ? 'PHYSICAL'
              : 'SERVICE';

        fulfillmentItems.push({
          id: generateUUID(),
          storeId,
          fulfillmentId,
          orderItemId: orderItem.id,
          inventoryItemId: assignedInventoryItemId,
          itemType,
          status: 'PENDING',
          payloadReference: null,
          createdAt: now,
        });
      }

      const fulfillment: Fulfillment = {
        id: fulfillmentId,
        storeId,
        orderId: order.id,
        strategy,
        status: 'PENDING',
        trackingInfo: {},
        failureReason: null,
        metadata: input.metadata ? Object.freeze({ ...input.metadata }) : {},
        createdAt: now,
        updatedAt: now,
      };

      const result = await this.fulfillmentRepo.create(storeId, fulfillment, fulfillmentItems);

      // Save idempotency record if requested
      if (input.idempotencyKey && this.idempotencyRepo) {
        await this.idempotencyRepo.set({
          storeId,
          actorId,
          key: input.idempotencyKey,
          requestHash: payloadHash,
          response: result,
          createdAt: now,
        });
      }

      return result;
    } finally {
      releaseLock();
    }
  }

  /**
   * Executes a fulfillment delivery via configured provider adapter.
   * On successful delivery, transitions fulfillment to FULFILLED, updates item payloads,
   * and coordinates with OrderService to transition order to FULFILLED.
   */
  async executeFulfillment(
    caller: FulfillmentCaller,
    input: ExecuteFulfillmentInput,
  ): Promise<FulfillmentWithItems> {
    if (caller.type === 'CUSTOMER') {
      throw new FulfillmentCustomerAccessDeniedError(
        'Customers are not permitted to execute fulfillments',
      );
    }

    const storeId = caller.context.storeId;

    await this.authService.assertAuthorizedStoreAction({
      context: caller.context,
      permission: 'fulfillment.process',
      targetStoreId: storeId,
    });

    const lockKey = `${storeId}:execute:${input.fulfillmentId}`;
    const releaseLock = await this.acquireInFlightLock(lockKey);

    try {
      const actorId = this.deriveActorId(caller);
      const payloadHash = hashPayload({
        fulfillmentId: input.fulfillmentId,
        providerName: input.providerName,
        manualPayloads: input.manualPayloads,
      });

      // Idempotency check
      if (input.idempotencyKey && this.idempotencyRepo) {
        const existingRecord = await this.idempotencyRepo.get(
          storeId,
          actorId,
          input.idempotencyKey,
        );
        if (existingRecord) {
          if (existingRecord.requestHash !== payloadHash) {
            throw new FulfillmentIdempotencyConflictError(input.idempotencyKey);
          }
          return existingRecord.response as FulfillmentWithItems;
        }
      }

      // Fetch fulfillment
      const fulfillment = await this.fulfillmentRepo.findById(storeId, input.fulfillmentId);
      if (!fulfillment) {
        throw new FulfillmentNotFoundError(input.fulfillmentId);
      }

      if (fulfillment.status === 'FULFILLED') {
        throw new FulfillmentAlreadyCompletedError(fulfillment.id);
      }
      if (fulfillment.status === 'CANCELLED') {
        throw new FulfillmentStateTransitionError(fulfillment.status, 'PROCESSING');
      }

      // If executing a retry from FAILED or MANUAL_REVIEW, reset FAILED items to PENDING under lock
      if (fulfillment.status === 'FAILED' || fulfillment.status === 'MANUAL_REVIEW') {
        for (const item of fulfillment.items) {
          if (item.status === 'FAILED') {
            await this.fulfillmentItemRepo.updateItem(storeId, item.id, {
              status: 'PENDING',
            });
          }
        }
      }

      // Fetch order
      const order = await this.orderService.getOrderById(caller, fulfillment.orderId);
      if (order.status === 'PENDING_PAYMENT') {
        throw new FulfillmentOrderNotPayableError(order.id, order.status);
      }
      if (order.status === 'CANCELLED' || order.status === 'EXPIRED') {
        throw new FulfillmentOrderInvalidStateError(order.id, order.status);
      }

      // Transition fulfillment to PROCESSING
      await this.fulfillmentRepo.updateStatus(storeId, fulfillment.id, 'PROCESSING');

      // If order is in PAID, advance order to PROCESSING as well
      if (order.status === 'PAID') {
        await this.orderService.transitionStatus(caller.context, order.id, 'PROCESSING');
      }

      // Resolve provider adapter
      const providerName = input.providerName ?? 'MOCK_DIGITAL';
      const provider = this.providers.get(providerName);
      if (!provider) {
        throw new FulfillmentProviderUnsupportedError(providerName);
      }

      // Execute delivery with ambiguous outcome protection
      let deliveryResult: FulfillmentDeliveryResult;
      try {
        deliveryResult = await provider.deliver({
          fulfillment,
          order,
          items: fulfillment.items,
          manualPayloads: input.manualPayloads,
        });
      } catch (err) {
        // Ambiguous external provider outcome (network drop, socket timeout, uncaught provider error)
        // Mark as MANUAL_REVIEW to prevent blind automatic retries and duplicate deliveries
        const errorMsg = err instanceof Error ? err.message : String(err);
        await this.fulfillmentRepo.updateStatus(storeId, fulfillment.id, 'MANUAL_REVIEW', {
          failureReason: `Ambiguous provider outcome: ${errorMsg}`,
        });
        throw new FulfillmentExecutionError(
          `Ambiguous provider outcome: ${errorMsg}`,
          'AMBIGUOUS_PROVIDER_ERROR',
          false,
        );
      }

      if (deliveryResult.success) {
        // Update line items to DELIVERED
        for (const item of fulfillment.items) {
          const payload =
            deliveryResult.deliveryPayloads[item.orderItemId] ??
            input.manualPayloads?.[item.orderItemId] ??
            null;

          await this.fulfillmentItemRepo.updateItem(storeId, item.id, {
            status: 'DELIVERED',
            payloadReference: payload,
          });
        }

        // Update fulfillment to FULFILLED
        const fulfilledRecord = await this.fulfillmentRepo.updateStatus(
          storeId,
          fulfillment.id,
          'FULFILLED',
          {
            trackingInfo: deliveryResult.trackingInfo ?? {},
            failureReason: null,
          },
        );

        // Coordinate with OrderService to transition order to FULFILLED
        // This triggers M06/M07 inventory consumption
        await this.orderService.transitionStatus(caller.context, order.id, 'FULFILLED');

        // Record idempotency
        if (input.idempotencyKey && this.idempotencyRepo) {
          await this.idempotencyRepo.set({
            storeId,
            actorId,
            key: input.idempotencyKey,
            requestHash: payloadHash,
            response: fulfilledRecord,
            createdAt: new Date().toISOString(),
          });
        }

        return fulfilledRecord;
      } else {
        // Delivery failed
        for (const item of fulfillment.items) {
          if (item.status === 'PENDING') {
            await this.fulfillmentItemRepo.updateItem(storeId, item.id, {
              status: 'FAILED',
            });
          }
        }

        const targetStatus = deliveryResult.retryable ? 'FAILED' : 'MANUAL_REVIEW';
        await this.fulfillmentRepo.updateStatus(storeId, fulfillment.id, targetStatus, {
          failureReason: deliveryResult.failureReason,
        });

        throw new FulfillmentExecutionError(
          deliveryResult.failureReason,
          deliveryResult.failureCode,
          deliveryResult.retryable,
        );
      }
    } finally {
      releaseLock();
    }
  }

  /**
   * Retries a failed or manual review fulfillment.
   */
  async retryFulfillment(
    caller: FulfillmentCaller,
    input: RetryFulfillmentInput,
  ): Promise<FulfillmentWithItems> {
    if (caller.type === 'CUSTOMER') {
      throw new FulfillmentCustomerAccessDeniedError(
        'Customers are not permitted to retry fulfillments',
      );
    }

    const storeId = caller.context.storeId;

    await this.authService.assertAuthorizedStoreAction({
      context: caller.context,
      permission: 'fulfillment.process',
      targetStoreId: storeId,
    });

    const fulfillment = await this.fulfillmentRepo.findById(storeId, input.fulfillmentId);
    if (!fulfillment) {
      throw new FulfillmentNotFoundError(input.fulfillmentId);
    }

    if (fulfillment.status !== 'FAILED' && fulfillment.status !== 'MANUAL_REVIEW') {
      throw new FulfillmentRetryNotAllowedError(fulfillment.status);
    }

    return this.executeFulfillment(caller, {
      fulfillmentId: input.fulfillmentId,
      idempotencyKey: input.idempotencyKey,
    });
  }

  /**
   * Cancels a fulfillment and revokes unconsumed items.
   */
  async cancelFulfillment(
    caller: FulfillmentCaller,
    fulfillmentId: string,
    reason?: string,
  ): Promise<FulfillmentWithItems> {
    if (caller.type === 'CUSTOMER') {
      throw new FulfillmentCustomerAccessDeniedError(
        'Customers are not permitted to cancel fulfillments',
      );
    }

    const storeId = caller.context.storeId;

    await this.authService.assertAuthorizedStoreAction({
      context: caller.context,
      permission: 'fulfillment.process',
      targetStoreId: storeId,
    });

    const fulfillment = await this.fulfillmentRepo.findById(storeId, fulfillmentId);
    if (!fulfillment) {
      throw new FulfillmentNotFoundError(fulfillmentId);
    }

    if (fulfillment.status === 'FULFILLED') {
      throw new FulfillmentAlreadyCompletedError(fulfillment.id);
    }
    if (fulfillment.status === 'CANCELLED') {
      throw new FulfillmentStateTransitionError(fulfillment.status, 'CANCELLED');
    }

    validateFulfillmentStateTransition(fulfillment.status, 'CANCELLED');

    // Revoke line items and release assigned digital inventory items back to AVAILABLE
    for (const item of fulfillment.items) {
      if (item.status !== 'REVOKED') {
        await this.fulfillmentItemRepo.updateItem(storeId, item.id, {
          status: 'REVOKED',
        });
      }

      // Digital inventory safety:
      // A credential must NEVER be returned to AVAILABLE if:
      // 1. item was already DELIVERED (the secret is exposed to customer)
      // 2. fulfillment was in MANUAL_REVIEW (ambiguous outcome: delivery may have occurred)
      const canSafelyReturnCredential =
        item.inventoryItemId &&
        this.inventoryService &&
        item.status !== 'DELIVERED' &&
        fulfillment.status !== 'MANUAL_REVIEW';

      if (canSafelyReturnCredential && item.inventoryItemId) {
        try {
          await this.inventoryService.updateInventoryItemStatus(
            caller.context,
            item.inventoryItemId,
            'AVAILABLE',
            {
              assignedOrderId: null,
              assignedAt: null,
            },
          );
        } catch {
          // Best effort inventory return
        }
      }
    }

    return this.fulfillmentRepo.updateStatus(storeId, fulfillmentId, 'CANCELLED', {
      failureReason: reason ?? 'Fulfillment cancelled by seller',
    });
  }

  /**
   * Retrieves a fulfillment with full line items (for sellers) or customer-safe projection (for customers).
   */
  async getFulfillment(
    caller: FulfillmentCaller,
    fulfillmentId: string,
  ): Promise<FulfillmentWithItems | PublicFulfillment> {
    const storeId = caller.context.storeId;

    if (caller.type === 'SELLER') {
      await this.authService.assertAuthorizedStoreAction({
        context: caller.context,
        permission: 'fulfillment.read',
        targetStoreId: storeId,
      });

      const fulfillment = await this.fulfillmentRepo.findById(storeId, fulfillmentId);
      if (!fulfillment) {
        throw new FulfillmentNotFoundError(fulfillmentId);
      }
      return fulfillment;
    }

    // Customer caller
    const fulfillment = await this.fulfillmentRepo.findById(storeId, fulfillmentId);
    if (!fulfillment) {
      throw new FulfillmentNotFoundError(fulfillmentId);
    }

    // Verify order customer ownership
    try {
      const order = await this.orderService.getOrderById(caller, fulfillment.orderId);
      if (order.customerId !== caller.context.customerId) {
        throw new FulfillmentCustomerAccessDeniedError();
      }
    } catch {
      throw new FulfillmentCustomerAccessDeniedError();
    }

    return toPublicFulfillment(fulfillment);
  }

  /**
   * Lists fulfillments matching filter criteria within the caller's authorization boundary.
   */
  async listFulfillments(
    caller: FulfillmentCaller,
    filter?: FulfillmentFilter,
  ): Promise<readonly (FulfillmentWithItems | PublicFulfillment)[]> {
    const storeId = caller.context.storeId;

    if (caller.type === 'SELLER') {
      await this.authService.assertAuthorizedStoreAction({
        context: caller.context,
        permission: 'fulfillment.read',
        targetStoreId: storeId,
      });

      return this.fulfillmentRepo.list(storeId, filter);
    }

    // Customer caller: strictly filter to orders owned by the customer
    const customerOrders = await this.orderService.listOrders(caller);
    const orderIdSet = new Set(customerOrders.map((o) => o.id));

    const storeFulfillments = await this.fulfillmentRepo.list(storeId, filter);
    return storeFulfillments.filter((f) => orderIdSet.has(f.orderId)).map(toPublicFulfillment);
  }
}

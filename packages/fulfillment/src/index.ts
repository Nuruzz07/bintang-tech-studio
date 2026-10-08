/**
 * Bintang Tech Studio — Fulfillment Foundation Package.
 * Milestone M09: Domain & Service Foundation.
 */

// Types & DTOs
export {
  type Fulfillment,
  type FulfillmentItem,
  type FulfillmentWithItems,
  type PublicFulfillment,
  type PublicFulfillmentItem,
  type FulfillmentCaller,
  type FulfillmentFilter,
  type CreateFulfillmentInput,
  type ExecuteFulfillmentInput,
  type RetryFulfillmentInput,
  type FulfillmentStrategy,
  type FulfillmentStatus,
  type FulfillmentItemStatus,
  type FulfillmentItemType,
  type FulfillmentProviderCapabilities,
  type FulfillmentDeliveryInput,
  type FulfillmentDeliverySuccess,
  type FulfillmentDeliveryFailure,
  type FulfillmentDeliveryResult,
  FULFILLMENT_STRATEGIES,
  FULFILLMENT_STATUSES,
  FULFILLMENT_ITEM_STATUSES,
  FULFILLMENT_ITEM_TYPES,
} from './types.js';

// Errors
export {
  FulfillmentError,
  FulfillmentNotFoundError,
  FulfillmentOrderNotFoundError,
  FulfillmentOrderNotPayableError,
  FulfillmentOrderInvalidStateError,
  FulfillmentStoreMismatchError,
  FulfillmentCustomerAccessDeniedError,
  FulfillmentStateTransitionError,
  FulfillmentItemStateTransitionError,
  FulfillmentAlreadyCompletedError,
  FulfillmentAlreadyExistsError,
  FulfillmentProviderUnsupportedError,
  FulfillmentExecutionError,
  FulfillmentRetryNotAllowedError,
  FulfillmentInventoryItemUnavailableError,
  FulfillmentCrossTenantItemError,
  FulfillmentIdempotencyConflictError,
  FulfillmentDuplicateDeliveryError,
} from './errors.js';

// Validation & Generators
export {
  generateUUID,
  validateFulfillmentStrategy,
  validateFulfillmentStatus,
  validateFulfillmentItemStatus,
  validateFulfillmentStateTransition,
  validateFulfillmentItemStateTransition,
} from './validation.js';

// Repositories & In-Memory Adapters
export {
  type FulfillmentRepository,
  type UpdateFulfillmentStatusPatch,
} from './fulfillment-repository.js';
export {
  type FulfillmentItemRepository,
  type UpdateFulfillmentItemPatch,
} from './fulfillment-item-repository.js';
export {
  type FulfillmentIdempotencyRepository,
  type FulfillmentIdempotencyRecord,
} from './idempotency-repository.js';
export {
  InMemoryFulfillmentRepository,
  InMemoryFulfillmentItemRepository,
  InMemoryFulfillmentIdempotencyRepository,
} from './memory-repository.js';

// Provider Adapters
export { type FulfillmentProviderAdapter } from './provider-adapter.js';
export {
  MockFulfillmentProviderAdapter,
  type MockProviderOptions,
} from './mock-provider-adapter.js';

// Service
export { FulfillmentService, type FulfillmentServiceOptions } from './fulfillment-service.js';

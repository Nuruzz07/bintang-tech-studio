/**
 * Bintang Tech Studio — Payment Foundation Package.
 * Milestone M08: Domain & Service Foundation with in-memory persistence adapter.
 */

// Types & DTOs
export {
  type PaymentAccount,
  type PublicPaymentAccount,
  type PaymentProviderCapability,
  type PaymentProviderCapabilities,
  type PaymentAccountStatus,
  type PaymentIntent,
  type PaymentIntentStatus,
  type PaymentAttempt,
  type PaymentAttemptStatus,
  type PaymentEvent,
  type PaymentEventProcessingStatus,
  type Refund,
  type RefundStatus,
  type PaymentCaller,
  type CreatePaymentAccountInput,
  type CreatePaymentIntentInput,
  type CreatePaymentAttemptInput,
  type ProcessPaymentWebhookInput,
  type WebhookProcessingResult,
  type CreateRefundInput,
  type PaymentIntentFilter,
  PAYMENT_ACCOUNT_STATUSES,
  PAYMENT_PROVIDER_CAPABILITIES,
  PAYMENT_INTENT_STATUSES,
  PAYMENT_ATTEMPT_STATUSES,
  PAYMENT_EVENT_PROCESSING_STATUSES,
  REFUND_STATUSES,
} from './types.js';

// Errors
export {
  PaymentError,
  PaymentNotFoundError,
  PaymentAccountNotFoundError,
  PaymentIntentNotFoundError,
  PaymentAttemptNotFoundError,
  PaymentEventDuplicateError,
  PaymentEventConflictError,
  PaymentAmountMismatchError,
  PaymentCurrencyMismatchError,
  PaymentStoreMismatchError,
  PaymentOrderMismatchError,
  PaymentCustomerAccessDeniedError,
  PaymentStateTransitionError,
  PaymentProviderUnsupportedError,
  PaymentCapabilityUnsupportedError,
  PaymentIdempotencyConflictError,
  PaymentAlreadyProcessedError,
  RefundAmountExceededError,
  RefundUnsupportedError,
  InvalidPaymentProviderEventError,
  PaymentSignatureVerificationError,
  OrderNotPayableError,
} from './errors.js';

// Money & Math
export { normalizeMoney, multiplyMoney, addMoney, subtractMoney, compareMoney } from './money.js';

// Validation & State Machine
export {
  validatePaymentIntentStateTransition,
  validatePaymentAttemptStateTransition,
  validatePositiveAmount,
  generateUUID,
} from './validation.js';

// Provider Adapter Abstraction & Mock
export {
  type PaymentProviderAdapter,
  type CreateProviderPaymentInput,
  type ProviderPaymentResult,
  type VerifyProviderPaymentInput,
  type ProviderPaymentStatusResult,
  type VerifyWebhookSignatureInput,
  type ParseWebhookEventInput,
  type ParsedWebhookEvent,
  type CreateProviderRefundInput,
  type ProviderRefundResult,
} from './provider-adapter.js';

export {
  MockPaymentProviderAdapter,
  type MockPaymentProviderAdapterOptions,
} from './mock-provider-adapter.js';

// Repositories
export { type PaymentAccountRepository } from './payment-account-repository.js';
export { type PaymentIntentRepository } from './payment-intent-repository.js';
export { type PaymentAttemptRepository } from './payment-attempt-repository.js';
export { type PaymentEventRepository } from './payment-event-repository.js';
export { type RefundRepository } from './refund-repository.js';
export {
  type PaymentIdempotencyRepository,
  type PaymentIdempotencyRecord,
} from './idempotency-repository.js';

export {
  InMemoryPaymentAccountRepository,
  InMemoryPaymentIntentRepository,
  InMemoryPaymentAttemptRepository,
  InMemoryPaymentEventRepository,
  InMemoryRefundRepository,
  InMemoryPaymentIdempotencyRepository,
} from './memory-repository.js';

// Application Service
export { PaymentService, type PaymentServiceOptions } from './payment-service.js';

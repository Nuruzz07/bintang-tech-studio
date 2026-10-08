/**
 * Bintang Tech Studio — Multi-Tenant Telegram Channel Engine.
 * Milestone M11: Telegram Engine Foundation.
 */

// Types & DTOs
export {
  type TelegramUpdateType,
  type TelegramSender,
  type TelegramUpdateContext,
  type TelegramBotStatus,
  type TelegramBotBinding,
  type TelegramCustomerIdentity,
  type TelegramCallerContext,
  type TelegramUpdateProcessingStatus,
  type TelegramUpdateRecord,
  type TelegramInlineButton,
  type TelegramMessagePayload,
  type TelegramCallbackAnswer,
  type TelegramProcessResult,
} from './types.js';

// Errors
export {
  TelegramEngineError,
  TelegramBotNotFoundError,
  TelegramBotInactiveError,
  TelegramStoreMismatchError,
  TelegramInvalidUpdateError,
  TelegramDuplicateUpdateError,
  TelegramCustomerAccessDeniedError,
  TelegramSellerAccessDeniedError,
  TelegramCommandUnknownError,
  TelegramCallbackMalformedError,
  TelegramResourceNotFoundError,
  TelegramRateLimitError,
  TelegramAdapterError,
} from './errors.js';

// Transport Adapter & Mock
export {
  type TelegramAdapter,
  type SentMessageRecord,
  type AnsweredCallbackRecord,
  type EditedMessageRecord,
  MockTelegramAdapter,
} from './adapter.js';

// Update Normalization
export { normalizeTelegramUpdate } from './update-normalizer.js';

// Update Idempotency
export {
  type TelegramUpdateRepository,
  InMemoryTelegramUpdateRepository,
} from './update-idempotency.js';

// Bot Binding
export { type TelegramBotRepository, InMemoryTelegramBotRepository } from './bot-binding.js';

// Store Resolution
export { type ResolvedTelegramStore, TelegramStoreResolver } from './store-resolver.js';

// Customer Identity
export { TelegramCustomerIdentityManager } from './customer-identity.js';

// Context Classification
export { type TelegramSellerMapping, TelegramContextClassifier } from './context-classifier.js';

// Mini App Integration
export { type MiniAppConfig, TelegramMiniAppHelper } from './mini-app.js';

// Outbound Presentation
export { TelegramOutboundService } from './outbound.js';

// Routing
export { type TelegramCommandRouterDependencies, TelegramCommandRouter } from './command-router.js';

export {
  type TelegramCallbackRouterDependencies,
  TelegramCallbackRouter,
} from './callback-router.js';

// Application Engine Service
export { type TelegramEngineServiceDependencies, TelegramEngineService } from './service.js';

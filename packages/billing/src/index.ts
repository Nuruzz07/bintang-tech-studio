/**
 * Bintang Tech Studio — Billing & Customer Onboarding Foundation Package.
 * Milestone M13: SaaS Plans, Subscriptions, Invoices, Billing Payments & Store Provisioning.
 */

// Types & DTOs
export {
  type Plan,
  type PlanFeatures,
  type PlanStatus,
  type PublicPlanView,
  type Subscription,
  type SubscriptionStatus,
  type PublicSubscriptionView,
  type Invoice,
  type InvoiceItem,
  type InvoiceItemType,
  type InvoiceStatus,
  type InvoiceWithItems,
  type PublicInvoiceView,
  type BillingPayment,
  type BillingPaymentStatus,
  type PublicBillingPaymentView,
  type Addon,
  type AddonStatus,
  type StoreAddon,
  type StoreAddonStatus,
  type OnboardingSession,
  type OnboardingStatus,
  type OnboardingChecklist,
  type ProvisioningRecord,
  type ProvisioningStatus,
  type ProvisionStoreInput,
  type BillingWebhookEvent,
  type WebhookProcessingResult,
  type BillingCaller,
  type SelectPlanInput,
  type CreateSubscriptionInput,
  type CreateBillingPaymentInput,
  SUBSCRIPTION_STATUSES,
  INVOICE_STATUSES,
  INVOICE_ITEM_TYPES,
  BILLING_PAYMENT_STATUSES,
  ONBOARDING_STATUSES,
} from './types.js';

// Errors
export {
  BillingError,
  PlanNotFoundError,
  InvalidPlanError,
  SubscriptionNotFoundError,
  SubscriptionStateTransitionError,
  SubscriptionCancelledError,
  InvoiceNotFoundError,
  InvoiceAlreadyPaidError,
  InvoiceStateTransitionError,
  BillingPaymentNotFoundError,
  BillingPaymentStateTransitionError,
  BillingPaymentAmountMismatchError,
  BillingPaymentCurrencyMismatchError,
  BillingPaymentStoreMismatchError,
  BillingPaymentDuplicateEventError,
  BillingPaymentConflictEventError,
  BillingSignatureVerificationError,
  BillingWebhookSignatureError,
  BillingIdempotencyConflictError,
  FinancialImmutabilityError,
  BillingStoreAccessDeniedError,
  ProvisioningError,
  ProvisioningAlreadyCompletedError,
  OnboardingError,
  OnboardingSessionNotFoundError,
  OnboardingInvalidStateTransitionError,
} from './errors.js';

// Money & Math
export {
  normalizeMoney,
  addMoney,
  subtractMoney,
  multiplyMoney,
  compareMoney,
  formatCurrency,
} from './money.js';

// Validation & State Machines
export {
  validateSubscriptionStateTransition,
  validateInvoiceStateTransition,
  validateBillingPaymentStateTransition,
  validateOnboardingStateTransition,
  validateProvisioningStateTransition,
  generateUUID,
} from './validation.js';

// Plan Catalog & Entitlements
export {
  STANDARD_PLAN_SLUGS,
  DEFAULT_PLANS,
  STARTER_PLAN_BASELINE,
  PRO_PLAN_BASELINE,
  BUSINESS_PLAN_BASELINE,
  toPublicPlanView,
} from './plan-catalog.js';

export {
  resolveEffectiveStoreEntitlements,
  type EffectiveStoreEntitlements,
} from './entitlement-resolver.js';

// Provider Adapters
export {
  type BillingPaymentAdapter,
  type ProviderBillingPaymentResult,
  MockBillingPaymentAdapter,
} from './provider-adapter.js';

// Repositories
export {
  type PlanRepository,
  type SubscriptionRepository,
  type InvoiceRepository,
  type BillingPaymentRepository,
  type AddonRepository,
  type StoreAddonRepository,
  type OnboardingRepository,
  type ProvisioningRepository,
  type BillingIdempotencyRepository,
} from './repositories/interfaces.js';

export {
  InMemoryPlanRepository,
  InMemorySubscriptionRepository,
  InMemoryInvoiceRepository,
  InMemoryBillingPaymentRepository,
  InMemoryAddonRepository,
  InMemoryStoreAddonRepository,
  InMemoryOnboardingRepository,
  InMemoryProvisioningRepository,
  InMemoryBillingIdempotencyRepository,
} from './repositories/memory-repository.js';

// Application Services
export { BillingService, type BillingServiceDeps } from './billing-service.js';

export { ProvisioningService, type ProvisioningServiceDeps } from './provisioning-service.js';

export { OnboardingService, type OnboardingServiceDeps } from './onboarding-service.js';

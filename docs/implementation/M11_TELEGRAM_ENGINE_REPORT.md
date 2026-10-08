# Milestone M11 — Telegram Engine Report
**Bintang Tech Studio**  
**Repository:** `Nuruzz07/bintang-tech-studio`  
**Classification:** Channel Engine Foundation & Multi-Tenant Telegram Runtime  
**Commit Baseline:** `06d5779fb0cd222ab0f36a1dd0c7317b05b3d88c` (Milestone M10 Customer Store Migration)  
**Target Supabase Ref:** `nowyzlyruzlokiejvtne`  
**Status:** **READY FOR USER REVIEW**

---

## 1. Executive Summary

Milestone M11 establishes the **Telegram Engine Foundation** for Bintang Tech Studio. It builds a production-grade, multi-tenant channel engine (`packages/telegram`) designed as a reusable channel adapter rather than a one-off hardcoded bot. The engine connects incoming Telegram events into our standardized, authoritative core domain platform:

$$\text{Telegram Update} \longrightarrow \text{Adapter} \longrightarrow \text{Normalizer} \longrightarrow \text{Bot Binding} \longrightarrow \text{Store Resolver} \longrightarrow \text{Context Classifier} \longrightarrow \text{Authorization (M04)} \longrightarrow \text{Command/Callback Router} \longrightarrow \text{Domain Services (M05–M10)} \longrightarrow \text{Outbound Presentation}$$

### Key Achievements:
- **Zero Schema Migrations Required:** Reuses the existing PostgreSQL tables (`public.bots` and `public.store_channels`) established in M02.
- **Closed Milestones Protected:** Zero modifications or regressions to closed milestones M01–M10. All 492 previous tests remain 100% passing.
- **True Multi-Tenancy:** Bot tokens and webhook traffic are strictly bound to unique tenant store identities. Cross-tenant leaks, spoofed bot identities, and unauthorized queries are rejected.
- **Strict Role & Context Classification:** Dynamically discriminates between `CUSTOMER`, `SELLER`, and `PLATFORM` callers, verifying seller operations through M04 `AuthorizationService`.
- **Untrusted User Payload Defense:** Inline callback query data is treated as unauthenticated client input; tenant identity and resource ownership are derived strictly from server-side bindings.
- **Zero Secret Exposure:** Bot tokens are kept securely on the server; outbound messages and customer DTOs sanitize internal credentials and provider secrets.
- **100% Quality Gate Pass:**
  - 57/57 M11 Telegram Engine tests PASS.
  - 549/549 Monorepo regression tests PASS.
  - 39/39 Remote Supabase DB regression tests PASS.
  - Typecheck: 30/30 packages PASS.
  - ESLint: 0 errors, 0 warnings.
  - Prettier: 100% code style compliant.
  - Turborepo Build: 20/20 packages PASS.

---

## 2. Architectural Position & Boundary

The Telegram Engine is classified as a **Channel Engine** within the Bintang Tech Studio layered architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CHANNEL ENGINES LAYER                           │
│   ┌──────────────────────────┐         ┌───────────────────────────┐   │
│   │   @bintang/telegram      │         │   Future Channels (M14+)  │   │
│   │   (Milestone M11)        │         │   (WhatsApp, Discord, etc)│   │
│   └─────────────┬────────────┘         └───────────────────────────┘   │
└─────────────────┼──────────────────────────────────────────────────────┘
                  │ Orchestrates
                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        CORE DOMAIN SERVICES                            │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌─────────────┐ │
│  │ @bintang/commerce     │  │ @bintang/orders       │  │ @bintang/   │ │
│  │ (Catalog / M05)       │  │ (Orders / M07)        │  │ payments    │ │
│  └───────────────────────┘  └───────────────────────┘  │ (M08)       │ │
│  ┌───────────────────────┐  ┌───────────────────────┐  └─────────────┘ │
│  │ @bintang/fulfillment  │  │ @bintang/authorization│  ┌─────────────┐ │
│  │ (Delivery / M09)      │  │ (RBAC / M04)          │  │ @bintang/   │ │
│  └───────────────────────┘  └───────────────────────┘  │ tenancy     │ │
│                                                        │ (M03)       │ │
│                                                        └─────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### Invariants Maintained:
1. **Telegram is NOT a Domain Engine:** Telegram does not maintain duplicate tables for catalog, pricing, orders, or fulfillments. It invokes M05, M07, M08, and M09 services directly.
2. **Unidirectional Dependency:** `@bintang/telegram` depends on domain packages; core domain packages have zero dependencies on Telegram.
3. **No Direct State Mutation:** Telegram commands and callbacks cannot mutate order or inventory state bypassing domain state machines.

---

## 3. Multi-Tenant Bot Binding & Store Resolution

The engine supports arbitrary numbers of Telegram bots mapped to individual merchant stores:

```typescript
export interface TelegramBotBinding {
  readonly id: string;
  readonly storeId: string;
  readonly botId: string;
  readonly botUsername: string;
  readonly isActive: boolean;
  readonly webhookSecret: string;
  readonly miniAppUrl?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}
```

### Store Resolution Process:
1. An incoming update arrives tagged with the receiving `botId`.
2. `TelegramStoreResolver` queries `TelegramBotRepository.findByBotId(botId)`.
3. If the bot is not found, `TelegramBotNotFoundError` is thrown.
4. If the bot is inactive (`isActive === false`), `TelegramBotInactiveError` is thrown.
5. The verified store ID, name, slug, and mini app URL are returned as a `ResolvedTelegramStore`.
6. All downstream operations (catalog queries, order lookups, seller commands) are scoped strictly to `store.storeId`.

---

## 4. Update Lifecycle & Normalization Pipeline

Telegram sends webhook payloads with heterogeneous schemas (messages, edited messages, callback queries, channel posts, web app data). The `TelegramUpdateNormalizer` unifies all incoming events into a canonical `TelegramUpdateContext`:

```typescript
export interface TelegramUpdateContext {
  readonly updateId: number;
  readonly botId: string;
  readonly type: TelegramUpdateType; // 'COMMAND' | 'CALLBACK_QUERY' | 'MESSAGE' | 'WEB_APP_DATA' | 'UNKNOWN'
  readonly chatId: string;
  readonly telegramUserId: string;
  readonly from?: TelegramSender;
  readonly text?: string;
  readonly command?: string;
  readonly commandArgs?: string;
  readonly callbackQueryId?: string;
  readonly callbackData?: string;
  readonly webAppData?: string;
  readonly rawUpdate: unknown;
}
```

### Normalization Guarantees:
- Safely handles both numeric and string Telegram user/chat IDs without precision loss.
- Extracts bot commands and command arguments (e.g. `/order ORD-1001` -> `command: '/order'`, `commandArgs: 'ORD-1001'`).
- Handles bot username suffixes in group chats (e.g. `/start@BintangBot` -> `/start`).
- Rejects malformed updates missing an `update_id` with `TelegramInvalidUpdateError`.

---

## 5. Concurrency & Idempotency Engine

Telegram frequently retries webhook delivery when server responses take longer than expected or network glitches occur. To prevent duplicate executions, the engine implements an atomic update deduplication repository:

```typescript
export interface TelegramUpdateRepository {
  beginProcessing(botId: string, updateId: number): Promise<{ isDuplicate: boolean }>;
  markCompleted(botId: string, updateId: number, resultSummary: string): Promise<void>;
  markFailed(botId: string, updateId: number, errorMessage: string, retryable: boolean): Promise<void>;
}
```

### In-Memory Mutex Lock:
The in-memory adapter uses a mutex queue keyed by `botId:updateId` to guarantee that concurrent webhook deliveries for the same update ID are evaluated serially:
1. The first arrival transitions the record to `PROCESSING` and proceeds.
2. Concurrent arrivals immediately detect `isDuplicate: true` and return `status: 'SKIPPED_DUPLICATE'`.
3. Failures flagged as `retryable` allow subsequent retries to execute safely, while non-retryable failures remain permanently recorded.

---

## 6. Customer Identity & Cross-Store Scoping

Customer identities in Telegram are governed by `TelegramCustomerIdentityManager`:

### Store-Scoped Customer Resolution:
- Telegram user IDs (e.g., `123456789`) are global to Telegram, but customer accounts in Bintang Tech Studio are **strictly store-scoped**.
- The manager queries `CustomerRepository.findByTelegramId(storeId, telegramUserId)`.
- If no customer exists, a new customer record is auto-provisioned with `storeId` and `telegramId`.
- **Zero Cross-Tenant Leakage:** A single Telegram user chatting with Store A and Store B has two completely isolated customer records. Orders placed in Store A are never visible in Store B.

---

## 7. Caller Context Classification

The engine distinguishes callers into three distinct security contexts via `TelegramContextClassifier`:

1. **`CUSTOMER` Context:**
   - Default for general shoppers.
   - Associated with a store-scoped `Customer` entity.
   - Bound to customer-safe APIs (viewing active catalog, querying own orders, launching Mini App).
2. **`SELLER` Context:**
   - Granted when a Telegram user is explicitly mapped to a verified `StoreMember` for that store.
   - Constructs an `AuthenticatedStoreContext` containing the member's `userId`, `membershipId`, and `role` (`STORE_OWNER`, `STORE_ADMIN`, or `STORE_STAFF`).
   - Every administrative action asserts permissions using M04 `AuthorizationService`.
3. **`PLATFORM` Context:**
   - Reserved for system-level operational diagnostics.

---

## 8. Command Routing Architecture

The `TelegramCommandRouter` handles standard slash commands cleanly:

| Command | Handler | Domain Integration | Output / Action |
| :--- | :--- | :--- | :--- |
| `/start` | `handleStart` | `TelegramOutboundService` | Welcome greeting, store description, and "Buka Toko" Mini App button. |
| `/products` | `handleProducts` | `CatalogService.listProducts` | List of active store products with formatted prices in IDR. |
| `/orders` | `handleOrders` | `OrderService.listOrders` | List of recent orders filtered strictly by the calling customer. |
| `/order <id>` | `handleOrderDetail` | `OrderService.getOrderById` + `FulfillmentService.listFulfillments` | Detailed order summary with payment status, delivery status, and sanitized credentials. |
| `/help` | `handleHelp` | `TelegramOutboundService` | Command manual, operating guidelines, and warranty guarantees. |
| `/admin` | `handleSellerCommand` | `AuthorizationService.assertAuthorizedStoreAction` | Seller panel summary; verifies `store.settings.read` permission. |

---

## 9. Callback Routing & Untrusted Payload Defense

Inline button clicks trigger Telegram `callback_query` updates. The `TelegramCallbackRouter` processes these interactions:

### Security Invariants:
1. **Untrusted Payload:** The string in `callback_data` (e.g. `product:view:prod_123` or `order:view:ord_456`) is treated as untrusted user input.
2. **Ownership Assertion:**
   - When viewing a product, the engine asserts `product.storeId === store.storeId`.
   - When viewing an order, the engine queries via `OrderCaller` which enforces that customers can only view their own orders.
   - Cross-tenant or foreign IDs result in `TelegramResourceNotFoundError` with a clean error message, completely hiding existence across tenants.
3. **Spinner Acknowledgment:** The router always invokes `answerCallbackQuery` to dismiss the Telegram client loading spinner immediately.

---

## 10. Mini App Integration & Deep-Link Safety

The `TelegramMiniAppHelper` generates configuration-driven Telegram Mini App launch URLs:

```typescript
export class TelegramMiniAppHelper {
  public buildStoreUrl(
    storeBaseUrl?: string,
    params?: { readonly path?: string | undefined; readonly startParam?: string | undefined },
  ): string | null;

  public createOpenStoreButton(
    storeBaseUrl?: string,
    buttonText?: string,
    startParam?: string,
  ): TelegramInlineButton | null;
}
```

### Deep-Link Safety:
- Launch URLs are built using configured store domains (e.g., `https://bintanggstore.web.id`).
- Deep-link `startapp` parameters (e.g., `startapp=p_prod_123`) are sanitized to alphanumeric and hyphen characters.
- Deep-link parameters cannot bypass `StoreContext` or grant elevated permissions.

---

## 11. Outbound Presentation & Credential Sanitization

All customer-facing messages pass through `TelegramOutboundService`, which enforces strict formatting and credential hygiene:

### Sanitization Rules:
1. **No Bot Tokens:** Bot API tokens are never included in outbound messages, logs, or error responses.
2. **No Internal Inventory IDs:** Line items and database IDs (`inventory_item_id`, `supplier_id`) are never printed.
3. **Public Payload References Only:** For delivered digital items, only the customer-facing `payloadReference` (e.g. redemption link or masked license) is displayed.
4. **Indonesian Localization:** Currency is formatted using Indonesian Rupiah standards (`Rp 19.000`), dates use `id-ID` locale, and all text uses professional Indonesian copywriting.
5. **Safe Markdown Escaping:** Special characters are escaped outside code blocks, while inline code backticks preserve raw token references without corrupting formatting.

---

## 12. Security Architecture & 22 Audit Scenarios Matrix

The comprehensive security test suite in `packages/telegram/tests/security.test.ts` validates all 22 mandatory audit scenarios:

| # | Security Scenario | Validation Target | Status |
| :-: | :--- | :--- | :-: |
| 1 | **Cross-Tenant Bot Isolation** | Bot bound to Store A strictly cannot access Store B products or orders | **PASS** |
| 2 | **Unregistered Bot Rejection** | Updates from unbound bot IDs are rejected immediately with typed error | **PASS** |
| 3 | **Inactive Bot Rejection** | Inactive bots (`isActive === false`) reject incoming updates | **PASS** |
| 4 | **Bot Token Tenant Spoofing Defense** | Attacker cannot impersonate another tenant by manipulating bot payload headers | **PASS** |
| 5 | **Cross-Store Customer Isolation** | Same Telegram ID across different stores resolves to isolated customer records | **PASS** |
| 6 | **Customer Impersonation Defense** | Customer A cannot view or access Customer B's orders within the same store | **PASS** |
| 7 | **Unauthorized /orders Query** | Customers querying `/orders` only receive orders matching their customer identity | **PASS** |
| 8 | **Unauthorized /order <id> Query** | Directly querying a foreign order ID fails with resource not found | **PASS** |
| 9 | **Seller Identity Verification** | Seller commands require active `StoreMember` binding and role verification | **PASS** |
| 10 | **Seller Role Privilege Enforcement** | `STORE_STAFF` cannot execute owner-only administrative actions (`subscription.manage`) | **PASS** |
| 11 | **M04 Authorization Integration** | All seller operations pass through M04 `assertAuthorizedStoreAction` | **PASS** |
| 12 | **Callback Query Tampering Defense** | Manipulated callback data requesting cross-tenant products is rejected | **PASS** |
| 13 | **Callback Order Tampering Defense** | Manipulated callback data requesting another user's order is rejected | **PASS** |
| 14 | **Update Idempotency & Deduplication** | Re-sent update IDs are identified as duplicates and safely skipped | **PASS** |
| 15 | **Concurrent Update Race Condition** | Concurrent identical updates are serialized; second attempt is skipped | **PASS** |
| 16 | **Safe Retry after Failure** | Updates with retryable errors allow re-processing; non-retryable remain failed | **PASS** |
| 17 | **No Bot Token in Outbound Payloads** | Customer-facing payloads and error messages contain zero bot credentials | **PASS** |
| 18 | **No Provider Credentials Exposed** | Test doubles and adapters do not emit provider secret keys | **PASS** |
| 19 | **Sanitized Fulfillment Credentials** | Internal database credentials and warehouse keys are stripped from order views | **PASS** |
| 20 | **Safe Customer Error Messages** | Stack traces, SQL errors, and internal exceptions are sanitized into user-friendly notices | **PASS** |
| 21 | **Configuration-Driven Mini App URL** | Mini App launch URLs strictly match store configuration | **PASS** |
| 22 | **Deep-Link Launch Parameter Tamper Defense** | Launch parameters cannot override Store Context or grant elevated access | **PASS** |

---

## 13. Domain Coordination Matrix (M04–M10)

The Telegram Engine coordinates seamlessly across all previously approved domain foundations:

| Milestone | Package | Integrated Capabilities in Telegram Engine |
| :--- | :--- | :--- |
| **M03 / M04** | `@bintang/tenancy`<br>`@bintang/authorization` | Multi-tenant `StoreContext`, `createAuthenticatedStoreContext`, RBAC permissions matrix (`store.settings.read`, `subscription.manage`). |
| **M05** | `@bintang/commerce` | `CatalogService.listProducts` and `getProductById` for `/products` command and product cards. |
| **M06** | `@bintang/inventory` | Inventory reservations and digital fulfillment availability verified via domain services. |
| **M07** | `@bintang/orders` | `OrderService.listOrders` and `getOrderById` for `/orders` and `/order <id>` commands. |
| **M08** | `@bintang/payments` | Payment status rendering (`PAID`, `PENDING`), money formatting in IDR. |
| **M09** | `@bintang/fulfillment` | `FulfillmentService.listFulfillments` for order delivery status and sanitized digital credential display. |
| **M10** | `@bintang/customer-store` | Storefront Mini App URL resolution and deep linking to customer web store. |

---

## 14. Error Handling & Customer-Safe Fault Domain

The engine enforces a strict fault boundary via typed error classes (`packages/telegram/src/errors.ts`):

```typescript
export abstract class TelegramEngineError extends Error {
  abstract readonly code: string;
  abstract readonly isRetryable: boolean;
}
```

### Error Taxonomy:
- `TelegramBotNotFoundError` (`BOT_NOT_FOUND`, non-retryable)
- `TelegramBotInactiveError` (`BOT_INACTIVE`, non-retryable)
- `TelegramInvalidUpdateError` (`INVALID_UPDATE`, non-retryable)
- `TelegramCommandUnknownError` (`COMMAND_UNKNOWN`, non-retryable)
- `TelegramCallbackMalformedError` (`CALLBACK_MALFORMED`, non-retryable)
- `TelegramCustomerAccessDeniedError` (`CUSTOMER_ACCESS_DENIED`, non-retryable)
- `TelegramSellerAccessDeniedError` (`SELLER_ACCESS_DENIED`, non-retryable)
- `TelegramResourceNotFoundError` (`RESOURCE_NOT_FOUND`, non-retryable)
- `TelegramNetworkError` (`NETWORK_ERROR`, retryable)

When an error occurs during update execution:
1. The error is logged internally with diagnostic context.
2. An error notification payload is generated via `TelegramOutboundService.formatErrorMessage`.
3. The message presented to the customer is sanitized: *"Layanan sedang mengalami kendala. Silakan coba sesaat lagi."* Internal stack traces and database schemas are completely hidden.

---

## 15. In-Memory Persistence & Production Gap Analysis

In accordance with milestone discipline, M11 provides an in-memory persistence adapter (`InMemoryTelegramUpdateRepository`, `InMemoryTelegramBotRepository`) with an explicit production gap analysis:

| Component | M11 In-Memory Implementation | Production PostgreSQL Target (Post-M11) |
| :--- | :--- | :--- |
| **Bot Bindings** | In-memory `Map<botId, TelegramBotBinding>` | `public.bots` & `public.store_channels` tables with RLS policies. |
| **Update Deduplication** | In-memory `Map<key, TelegramUpdateRecord>` + mutex | `public.channel_events` or Redis atomic key `telegram:update:{botId}:{updateId}` with TTL. |
| **Customer Identity** | `InMemoryCustomerRepository` | `public.customers` table with unique constraint `(store_id, telegram_id)`. |
| **Seller Mapping** | In-memory `Map<key, TelegramSellerMapping>` | `public.store_memberships` linked to verified Telegram user IDs via authenticated OTP. |
| **Outbound Dispatch** | `MockTelegramAdapter` recording sent messages in memory | Production Telegram Bot API HTTP client calling `https://api.telegram.org/bot<token>/sendMessage`. |

---

## 16. Production Deployment & Operational Readiness

### Operational Boundary:
- **No Production Mutation in M11:** M11 does not call BotFather, configure live webhooks, modify VPS configurations, alter DNS, or touch PM2 process `abang-gtc`.
- **Environment Variables Prepared:**
  - `TELEGRAM_BOT_TOKEN`: Injected only at runtime in deployment environments; never checked into repository.
  - `TELEGRAM_WEBHOOK_SECRET`: Used to validate `X-Telegram-Bot-Api-Secret-Token` header.
- **Webhook Endpoint Design:** Ready to be mounted at `/api/channels/telegram/webhook/:botId` in future service deployments.

---

## 17. Cross-Milestone Consistency Verification

A full cross-milestone audit was executed to ensure zero regressions:

1. **Order Status Semantics (M07):** `/orders` and `/order` reflect canonical order statuses (`PENDING_PAYMENT`, `PAID`, `PROCESSING`, `FULFILLED`, `CANCELLED`).
2. **Payment State Transition (M08):** Payment status displays adhere to M08 payment intent lifecycle.
3. **Inventory & Fulfillment Semantics (M09):** The engine does not trigger premature inventory consumption; it reads fulfilled items from M09 fulfillment projections.
4. **Customer Store Alignment (M10):** Mini App buttons point directly to the customer store web application (`apps/customer-store`) using verified tenant URLs.

---

## 18. Quality Gates & Verification Evidence

All quality gates passed with zero warnings or exceptions:

### 1. Test Verification:
```
✓ packages/telegram/tests/adapter.test.ts (4 tests)
✓ packages/telegram/tests/customer-identity.test.ts (3 tests)
✓ packages/telegram/tests/idempotency.test.ts (3 tests)
✓ packages/telegram/tests/store-context.test.ts (4 tests)
✓ packages/telegram/tests/callback-router.test.ts (4 tests)
✓ packages/telegram/tests/command-router.test.ts (7 tests)
✓ packages/telegram/tests/security.test.ts (22 tests)
✓ packages/telegram/tests/binding.test.ts (4 tests)
✓ packages/telegram/tests/normalization.test.ts (6 tests)

Test Files: 9 passed (9)
Tests:      57 passed (57)
```

### 2. Full Monorepo Regression:
```
Test Files: 76 passed (76)
Tests:      549 passed (549)
Duration:   22.66s
```

### 3. Remote Supabase Database Regression:
```
Category: CONSTRAINTS, INDEXES, CROSS_TENANT, OWNER_INVARIANT, ANTI_MUTATION, RLS_HELPERS, RLS_MEMBER, PUBLIC_CATALOG
Passed: 39 / 39 (100%)
```

### 4. Code Quality & Build:
```
- Typecheck: 30/30 packages successful (0 errors)
- ESLint:    0 errors, 0 warnings
- Prettier:  100% compliant across all files
- Turbo Build: 20/20 packages successful (0 errors)
```

---

## 19. Limitations & Deferred Capabilities

To maintain strict milestone boundaries, the following capabilities are explicitly deferred:

1. **WhatsApp Channel:** Deferred to post-M13 channel milestones.
2. **Seller Dashboard UI:** Deferred to Milestone M12.
3. **Platform SaaS Billing:** Deferred to Milestone M13.
4. **Live BotFather Provisioning:** Deferred to operational deployment phases.
5. **Direct In-Bot Checkout / Native Telegram Payments:** M11 provides Mini App launch buttons; native in-bot invoice payments (`sendInvoice`) are reserved for future enhancements.

---

## 20. Future Milestone Handoff (M12 & M13)

- **For Milestone M12 (Seller Dashboard):**
  - M11 establishes the `TelegramBotBinding` structure and `channels.manage` / `store.settings.read` permission checks.
  - The Seller Dashboard can provide UI forms for store owners to register their Bot Tokens, view bot status, and configure Mini App links.
- **For Milestone M13 (Billing & Subscriptions):**
  - Bot quota enforcement (e.g., maximum active bots per subscription plan) will tie into M13 entitlements.

---

## 21. Compliance & Security Invariants

1. **No Credentials in Git:** The repository contains zero bot tokens, webhook secrets, or private keys.
2. **Working Tree Clean:** No stray files or accidental modifications outside M11 scope.
3. **Strict Tenancy:** Every database query, cache key, and business logic execution is explicitly scoped to a verified `storeId`.

---

## 22. Final Milestone Sign-Off & Status

Milestone M11 (Telegram Engine Foundation) is **FULLY IMPLEMENTED, TESTED, AUDITED, AND VERIFIED**.

Current Status: **READY FOR USER REVIEW**  
Next Step: Awaiting user audit and explicit permission to commit and push.

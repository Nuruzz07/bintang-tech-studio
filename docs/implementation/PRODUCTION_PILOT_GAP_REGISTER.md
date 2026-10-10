# Bintang Tech Studio - Production Pilot Gap Register

## Document Metadata
- **Project:** Bintang Tech Studio (`Nuruzz07/bintang-tech-studio`)
- **Milestone Baseline:** M15 - Production Pilot Hardening (Committed: `ce9e71e9c235b8bc15d5beedbffa2d2c07e320e8`)
- **Target Environments:**
  - Staging: `vaaixneyotrilqfkulqw` (Supabase PostgreSQL, 41/41 SQL assertions verified)
  - Production: `nowyzlyruzlokiejvtne` (Change-controlled, untouched)
- **Status Date:** 2026-10-10
- **Purpose:** Concrete, evidence-backed evaluation of system readiness for a controlled single-merchant Production Pilot release.

---

## Executive Summary

Milestone M15 successfully established the database persistence, transactional atomicity, and multi-tenant hardening foundation for Bintang Tech Studio. However, a passing test suite on staging does **not** equal production operational readiness.

This Gap Register objectively maps the 11 mission-critical subsystems required for the first live merchant pilot. It differentiates verified codebase/staging capabilities from unbuilt runtime integrations, placeholders, and operational risks.

### Subsystem Summary Table

| # | Subsystem Area | Status | Priority | Core Blocker / Finding |
| :- | :--- | :---: | :---: | :--- |
| **01** | Authentication & Multi-Tenant Isolation | **PARTIAL** | **HIGH** | Live Supabase Auth GoTrue login unlinked in UI; Node client uses service-role |
| **02** | Seller Onboarding & Store Configuration | **PARTIAL** | **BLOCKER** | Billing repo is in-memory; store slug resolution static in context resolver |
| **03** | Product, Inventory, Order & Fulfillment | **PARTIAL** | **BLOCKER** | DB RPCs & repos verified; HTTP REST/actions gateway in `services/api` is stub |
| **04** | Payment Adapter, Webhook & Idempotency | **PARTIAL** | **BLOCKER** | Idempotency verified; gateway adapter is mock-only; no live webhook ingress |
| **05** | Telegram / Bot Messaging Channel | **PARTIAL** | **HIGH** | `@bintang/telegram` library complete; daemon in `services/bot-engine` is stub |
| **06** | Worker, Retry, Dead-Letter & Observability | **PARTIAL** | **HIGH** | Worker loop polls DB jobs; handlers only log; retry backoff not scheduled |
| **07** | Secrets & Environment Separation | **PARTIAL** | **HIGH** | Spec documented; no `.env.staging.example` or fail-fast startup validator |
| **08** | Backup, Restore & Rollback Procedures | **PARTIAL** | **HIGH** | Procedures documented in `RECOVERY.md`; restore drill never executed on staging |
| **09** | CI, Build, Tests & Deployment Procedures | **PARTIAL** | **HIGH** | Unit CI passing (34 tasks); CI lacks SQL migration runner; deployment manual |
| **10** | End-to-End Pilot Acceptance Test Suite | **VERIFIED (Domain)** | **HIGH (Network Pending)** | In-memory golden path verified; live HTTP/DB network E2E pending |
| **11** | Monitoring & First Seller Pilot Ops | **PARTIAL** | **HIGH** | Structured logger ready; external uptime check and incident playbook missing |

---

## Detailed Subsystem Gap Evaluations

### 01. Authentication & Multi-Tenant Isolation

- **Status:** `PARTIAL`
- **Verified Evidence:**
  - `database/migrations/00001_initial_schema.sql`, `00002_harden_cross_tenant_integrity_and_rls.sql`, `00003_production_pilot_hardening.sql`.
  - Staging verification: 41/41 assertions pass on `vaaixneyotrilqfkulqw`, including Cases L and M verifying RLS blocks on cross-tenant and null store operations for `authenticated` role.
  - `@bintang/tenancy`: `StoreContext`, `createAuthenticatedStoreContext()`.
  - `@bintang/authorization`: RBAC matrices and role definitions.
  - `@bintang/database`: `SessionRepository` storing session records in `public.app_sessions`.
  - `apps/seller-dashboard/src/session-manager.ts` and `apps/customer-store/src/context-resolver.ts`.
- **Concrete Gap:**
  1. Live Supabase Auth (GoTrue) integration is not wired to frontend client login (no OAuth, magic-link, or password sign-in forms).
  2. The Node.js database client (`PostgrestClient` in `packages/database/src/client.ts`) uses `SUPABASE_SERVICE_ROLE_KEY` by default. Multi-tenant isolation at the Node.js application level relies entirely on application-level filtering (`store_id = ...`) in repository queries rather than forwarding the caller user JWT to PostgREST.
- **Impact if Unresolved:**
  - Pilot seller cannot log in via standard web authentication.
  - If any newly authored application query accidentally omits `store_id`, PostgREST executed under `service_role` will bypass RLS and potentially leak cross-tenant data.
- **Measurable Acceptance Criteria:**
  1. Frontend authentication flow exchanges credentials with Supabase Auth GoTrue API and obtains valid user JWT.
  2. Backend requests forward user JWT to PostgREST, ensuring PostgreSQL evaluates RLS policies under `authenticated` role.
  3. Querying store B records with a store A JWT returns 0 rows or HTTP 403.
- **Priority:** `HIGH`
- **Next Minimal Safe Step:**
  - Implement Supabase Auth exchange handler and JWT-forwarding support in `packages/database/src/client.ts`.

---

### 02. Seller Onboarding & Store Configuration

- **Status:** `PARTIAL`
- **Verified Evidence:**
  - `packages/billing/src/onboarding-service.ts` and `provisioning-service.ts`.
  - `apps/seller-dashboard/src/seller-dashboard-service.ts` (`updateStoreSettings`, `getOverview`).
  - `packages/database/src/repositories/store-repository.ts` and `store-member-repository.ts`.
- **Concrete Gap:**
  1. `packages/billing` still relies on `memory-repository.ts` for subscriptions and quotas; there is no PostgREST repository for `subscriptions`, `subscription_invoices`, and `tenant_quotas` in `packages/database`.
  2. No public self-service onboarding HTTP endpoint or web UI exists; merchant setup must be scripted.
  3. `StoreContextResolver` in `apps/customer-store/src/context-resolver.ts` relies on an in-memory map registry and does not dynamically query `public.stores` by tenant slug from the database.
- **Impact if Unresolved:**
  - Pilot merchant must be manually seeded via SQL; merchant subscription and quota states are volatile and lost upon process restart.
  - Dynamic store subdomains/slugs cannot be served without manual in-memory registration.
- **Measurable Acceptance Criteria:**
  1. Database repository for `subscriptions` and `tenant_quotas` implemented in `@bintang/database`.
  2. `StoreContextResolver` supports resolving store metadata directly from `StoreRepository`.
  3. Pilot merchant provisioning script creates `stores`, `store_members`, and active `subscriptions` record in PostgreSQL.
- **Priority:** `BLOCKER`
- **Next Minimal Safe Step:**
  - Wire dynamic store lookup in `apps/customer-store/src/context-resolver.ts` and provide a validated seed script for the pilot seller.

---

### 03. Product, Inventory, Order, Cancellation, & Fulfillment

- **Status:** `PARTIAL` (Database and Repositories: `VERIFIED`; HTTP Gateway: `NOT IMPLEMENTED`)
- **Verified Evidence:**
  - Stored procedures in `database/migrations/00003_production_pilot_hardening.sql`: `rpc_create_order_atomic`, `rpc_cancel_order_atomic`, `rpc_fulfill_order_atomic`.
  - Staging verification: 41/41 assertions pass on `vaaixneyotrilqfkulqw` covering server-authoritative line pricing, voucher validation, status flow (`PENDING_PAYMENT` -> `PAID` -> `FULFILLED`), atomic stock reservation/release, and idempotency.
  - `@bintang/database` repositories (`order-repository.ts`, `inventory-repository.ts`, `fulfillment-repository.ts`) with 47 unit/concurrency tests passing.
- **Concrete Gap:**
  1. Domain operations can only be executed by importing TypeScript packages in Node.js processes.
  2. `services/api` is a placeholder (`node -e "process.exit(0)"`), meaning there are no HTTP REST endpoints, GraphQL, or Next.js server actions to receive checkout or fulfillment requests over the network.
- **Impact if Unresolved:**
  - Web browsers or external clients cannot place orders or trigger fulfillment over HTTP.
- **Measurable Acceptance Criteria:**
  1. HTTP POST endpoint for `/api/v1/orders/checkout` executes `rpc_create_order_atomic` and returns created order details with status 201/200.
  2. HTTP POST endpoint for `/api/v1/orders/:id/fulfill` executes `rpc_fulfill_order_atomic` and updates status to `FULFILLED`.
- **Priority:** `BLOCKER`
- **Next Minimal Safe Step:**
  - Scaffold minimal HTTP route handlers in `services/api` or export Next.js-compatible server handlers connecting `@bintang/customer-store` to `@bintang/database`.

---

### 04. Payment Adapter, Real Webhook, Idempotency, & Reconciliation

- **Status:** `PARTIAL`
- **Verified Evidence:**
  - `packages/payments/src/payment-service.ts` and `mock-provider-adapter.ts`.
  - Idempotency table with partial unique indexes in `00003_production_pilot_hardening.sql`.
  - Staging SQL tests Case B1-B3 and L-M verify idempotency locking, duplicate prevention, and replay safety.
- **Concrete Gap:**
  1. Only `MockPaymentProviderAdapter` exists. No live payment gateway adapter (e.g. Midtrans, Tripay, Xendit, QRIS) exists in `packages/payments`.
  2. No live HTTP webhook ingress endpoint exists to receive provider callbacks and verify HMAC signatures.
  3. No automated background reconciliation job exists to poll or settle expired/unconfirmed pending payments.
- **Impact if Unresolved:**
  - Real customers cannot pay real money; pilot is strictly restricted to simulation/sandbox payments.
  - Missed webhook deliveries leave customer orders stuck in `PENDING_PAYMENT` without automated recovery.
- **Measurable Acceptance Criteria:**
  1. Live payment adapter implemented adhering to `PaymentProviderAdapter` contract with payload signing and webhook signature verification.
  2. Webhook receiver endpoint safely transitions payment and order state idempotenly upon valid callback.
  3. Reconciliation worker task checks pending payments exceeding 15 minutes and syncs provider status.
- **Priority:** `BLOCKER` (for live commercial pilot) / `HIGH` (if pilot starts with sandbox simulation)
- **Next Minimal Safe Step:**
  - Implement real payment gateway adapter (e.g. Tripay or Midtrans) in `packages/payments/src/` with signature validator.

---

### 05. Telegram / Bot Messaging Channel

- **Status:** `PARTIAL`
- **Verified Evidence:**
  - `packages/telegram/src/` contains complete command router (`/start`, `/status`, `/help`), callback router, outbound notifier, update normalizer, and mini-app auth validator (`validateInitData`).
  - 53 unit tests passing in `packages/telegram`.
- **Concrete Gap:**
  1. `services/bot-engine` is an empty stub (`node -e "process.exit(0)"`).
  2. No long-polling runner or webhook receiver process runs to ingest updates from Telegram Bot API.
  3. Outbound notifications (order placed, payment received) are not wired to a live bot instance.
- **Impact if Unresolved:**
  - Telegram bot is completely offline; customers cannot interact via bot, and sellers receive no Telegram alerts.
- **Measurable Acceptance Criteria:**
  1. `services/bot-engine` boots with valid `TELEGRAM_BOT_TOKEN` and successfully answers `/start` with seller store link.
  2. Webhook or polling runner receives messages without dropping updates.
  3. Order creation in store triggers an outbound notification message to the pilot seller chat ID.
- **Priority:** `HIGH`
- **Next Minimal Safe Step:**
  - Implement bootstrap runner in `services/bot-engine/src/index.ts` connecting `@bintang/telegram` to Telegram Bot API.

---

### 06. Worker, Retry, Dead-Letter, & Observability

- **Status:** `PARTIAL`
- **Verified Evidence:**
  - `services/worker/src/worker-runner.ts` and `index.ts` implement polling tick loop over `rpc_claim_job` with graceful shutdown.
  - `packages/database/src/repositories/job-repository.ts` and `outbox-repository.ts`.
  - `@bintang/observability`: `StructuredLogger` with credential masking and `evaluateHealth`.
- **Concrete Gap:**
  1. Job handlers registered in `services/worker/src/index.ts` (`sync_inventory`, `send_notification`, `order.created`, `payment.settled`) only execute `logger.info`; they do not perform real domain side-effects.
  2. Failed jobs do not compute exponential backoff or schedule future retry in `jobs.run_at`.
  3. Jobs exceeding `max_attempts` are marked failed, but no dead-letter alert notification is dispatched to operators.
- **Impact if Unresolved:**
  - Background async jobs produce logs but no real actions (e.g. notifications never send, outbox events never broadcast).
  - Repeated failures can cause silent dropped events.
- **Measurable Acceptance Criteria:**
  1. Worker job handlers execute actual domain side-effects (e.g. trigger email/telegram notification).
  2. Failure handler calculates retry backoff (`run_at = now() + (attempt * 60 seconds)`).
  3. Exhausted jobs record a dead-letter event and trigger a security/system log alert.
- **Priority:** `HIGH`
- **Next Minimal Safe Step:**
  - Wire concrete job handlers in `services/worker/src/index.ts` for notification delivery and event dispatching.

---

### 07. Secrets & Environment Separation

- **Status:** `PARTIAL`
- **Verified Evidence:**
  - `.env.example` and `.env.production.example` define required environment variables.
  - `.github/workflows/ci.yml` scans for private keys and Telegram bot tokens on PR and push.
  - Supabase staging (`vaaixneyotrilqfkulqw`) and production (`nowyzlyruzlokiejvtne`) references clearly separated.
- **Concrete Gap:**
  1. No `.env.staging.example` exists.
  2. There is no runtime environment validator (e.g. Zod / schema parser) executing at service startup; services fall back to hardcoded localhost strings (`http://127.0.0.1:54321`) or mock keys if variables are missing.
- **Impact if Unresolved:**
  - Server misconfigurations may silently run against default mock keys instead of failing fast during deployment.
- **Measurable Acceptance Criteria:**
  1. `.env.staging.example` authored and documented.
  2. Startup configuration validator throws descriptive error and halts process if required environment variables are absent in production mode.
- **Priority:** `HIGH`
- **Next Minimal Safe Step:**
  - Create `.env.staging.example` and a shared `validateEnvironment()` utility in `@bintang/observability` or `@bintang/shared`.

---

### 08. Backup, Restore, & Rollback Procedures

- **Status:** `PARTIAL` (Documented, Drill-Untested)
- **Verified Evidence:**
  - `infrastructure/vps/RECOVERY.md` documents `pg_dump`, `pg_restore`, and Git revert runbooks.
- **Concrete Gap:**
  1. Automated backup scripts are not scheduled via cron or automated job.
  2. Target RPO and RTO are explicitly marked `TBD` in `RECOVERY.md`.
  3. No restore drill has ever been executed against Supabase staging to verify that `pg_restore` succeeds without permission or schema constraint errors.
- **Impact if Unresolved:**
  - In the event of data corruption or disaster during the pilot, recovery could fail or encounter unexpected permission errors.
- **Measurable Acceptance Criteria:**
  1. Automated daily logical backup script executed and archived.
  2. Restore drill successfully executed on staging database with verified data integrity.
  3. Verified RPO <= 24 hours, RTO <= 60 minutes.
- **Priority:** `HIGH`
- **Next Minimal Safe Step:**
  - Create `scripts/backup-database.sh` and perform a dry-run logical restore test on staging.

---

### 09. CI, Build, Tests, & Deployment Procedures

- **Status:** `PARTIAL` (CI & Unit Build: `VERIFIED`; DB CI & Deployment: `NOT IMPLEMENTED`)
- **Verified Evidence:**
  - `.github/workflows/ci.yml` runs: `npm ci`, `format:check`, `lint`, `typecheck`, `test`, secret scan, and `build`.
  - 34/34 turbo tasks PASS on every commit.
- **Concrete Gap:**
  1. CI does not execute SQL migrations or SQL tests (no ephemeral PostgreSQL / Supabase CLI container in GitHub Actions).
  2. Deployment to VPS and Vercel is completely manual with no automated CD pipeline.
- **Impact if Unresolved:**
  - Malformed SQL migrations or broken database constraints could pass GitHub Actions CI and only be caught during staging deployment.
- **Measurable Acceptance Criteria:**
  1. CI workflow includes a database migration linter or ephemeral test runner.
  2. Documented pre-deployment and post-deployment verification checklist.
- **Priority:** `HIGH`
- **Next Minimal Safe Step:**
  - Add Supabase migration linting step or local verification script to the pre-deployment runbook.

---

### 10. End-to-End Pilot Acceptance Test Suite

- **Status:** `VERIFIED (Domain Layer In-Memory)` (Network/Live DB Layer: `PENDING`)
- **Verified Evidence:**
  - `tests/e2e/pilot-acceptance.test.ts` (1 test suite, 11 stages covering seller catalog, inventory balance, customer session, cart invariants, idempotent checkout, payment attempt, webhook signature verification with auto-paid transition, digital fulfillment, inventory consumption, and negative security boundaries).
  - Executed successfully via Vitest (`1 passed (1)`, 53ms).
- **Concrete Scope & Boundaries (What Was Tested vs What Is Pending):**
  1. **Persistence:** The test executes against in-memory repository adapters (`InMemoryProductRepository`, `InMemoryOrderRepository`, `InMemoryFulfillmentRepository`, etc.). It does **not** connect to live PostgreSQL / Supabase over the network.
  2. **Payment Gateway:** The payment provider is simulated via `MockPaymentProviderAdapter` with real HMAC signature validation executed in-process. External gateway APIs (Xendit/Midtrans/Tripay) were not invoked.
  3. **Fulfillment:** Serial keys and digital delivery are simulated via in-memory allocation and `MockFulfillmentProviderAdapter`.
  4. **Concurrency:** In-flight lock deduplication and cross-tenant boundaries are verified sequentially; high-concurrency race condition testing resides in dedicated unit tests (`packages/orders/tests/concurrency.test.ts`).
  5. **Network/HTTP Layer:** End-to-end HTTP request/response through `services/api` or Next.js API routes to live PostgreSQL is pending HTTP gateway implementation (Gap 03).
- **Impact if Unresolved:**
  - Cross-domain business logic and service orchestration are mathematically proven sound, but network transport serialization, CORS, live cookie propagation, and Supabase connection pool behaviors remain unverified over live HTTP.
- **Measurable Acceptance Criteria:**
  - [x] Automated in-memory acceptance test `tests/e2e/pilot-acceptance.test.ts` exists and passes 100% assertions.
  - [ ] Live network E2E test executing against staging API and database environment.
- **Priority:** `VERIFIED (Domain Layer)` / `HIGH (Network Layer Pending)`
- **Next Minimal Safe Step:**
  - Maintain `tests/e2e/pilot-acceptance.test.ts` in CI as the cross-package orchestration regression barrier.

---

### 11. Monitoring, Incident Handling, & First Seller Pilot Ops

- **Status:** `PARTIAL`
- **Verified Evidence:**
  - `@bintang/observability`: `StructuredLogger` (JSON format, ISO-8601, credential masking, security tags) and `evaluateHealth`.
  - `infrastructure/vps/RUNBOOK.md`: Scoped PM2 operations and process isolation rules (`abang-gtc` protected).
- **Concrete Gap:**
  1. No external uptime monitor (e.g. Healthchecks.io / UptimeRobot) pings healthcheck endpoints.
  2. Uncaught exceptions and critical error logs are not piped to an instant notification channel (e.g. Telegram alert group).
  3. No merchant incident playbook or emergency contact runbook exists for the first pilot seller.
- **Impact if Unresolved:**
  - Outages or background worker deadlocks during the pilot will only be discovered after customer complaints.
- **Measurable Acceptance Criteria:**
  1. Live HTTP `/health` endpoint returning component statuses.
  2. Alert hook notifying team on `[SECURITY:CRITICAL]` or `[FATAL]` logs.
  3. First seller pilot operational agreement and escalation protocol documented.
- **Priority:** `HIGH`
- **Next Minimal Safe Step:**
  - Author the Pilot Seller Incident Playbook in `docs/implementation/` and connect error logger to alert hook.

---

## Action Plan & Roadmap to Production Pilot

```
[ Phase A: Automated Pilot Proof ]
  ├── 1. Implement End-to-End Pilot Acceptance Test Suite (tests/e2e) [VERIFIED - In-Memory Domain]
  └── 2. Implement Dynamic Store Resolution in Context Resolver [BLOCKER]

[ Phase B: Gateway & Ingress Realization ]
  ├── 3. Wire HTTP API Gateway / Action routes (services/api) [PRIMARY RUNTIME BLOCKER]
  ├── 4. Implement Real Payment Gateway Adapter & Webhook Ingress [BLOCKER]
  └── 5. Bootstrap Telegram Bot Engine Runner (services/bot-engine) [HIGH]

[ Phase C: Operational & Pilot Deployment ]
  ├── 6. Wire real worker side-effects & backoff retry [HIGH]
  ├── 7. Execute staging restore drill & verify backup cadence [HIGH]
  ├── 8. Setup external healthcheck ping & error alerting [HIGH]
  └── 9. Deploy Pilot Seed & execute Controlled Pilot Onboarding [PILOT LAUNCH]
```

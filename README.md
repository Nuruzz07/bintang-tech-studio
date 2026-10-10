# Bintang Tech Studio

> **SaaS platform turning manual digital sales workflows into automated, multi-tenant commerce operations.**

---

## Architecture Overview

Bintang Tech Studio is structured as a **Modular Monolith ("Monorepo v1")** engineered for correctness, tenant isolation, and clear operational boundaries:

- **Frontend Tier:** Vercel (Customer Store / Mini App, Seller Dashboard, Owner Console).
- **Execution Tier:** VPS dedicated service processes (`bintang-api`, `bintang-worker`, `bintang-bot`, `bintang-webhook`).
- **Data & Auth Tier:** Supabase (PostgreSQL with Row Level Security, Supabase Auth, Storage).
- **Edge Layer:** Cloudflare (DNS, SSL, WAF, rate limiting).
- **Core Abstractions:**
  - **Multi-Tenant Isolation:** Enforced via `store_id`, explicit server-side Store Context, and PostgreSQL RLS.
  - **Payment Engine:** Abstracted adapter architecture (`PaymentAdapter`) executing strictly server-side.
  - **Channel Engine:** Decoupled bot and messaging orchestration (Telegram, WhatsApp).

---

## Current Status: M15 - Production Pilot Hardening (Staging-Verified & Committed)

**Current Baseline Commit:** `ce9e71e9c235b8bc15d5beedbffa2d2c07e320e8` (`main`)
**Staging Supabase Target:** `vaaixneyotrilqfkulqw` (41/41 SQL assertion suite passed)
**Production Supabase Target:** `nowyzlyruzlokiejvtne` (Change-controlled, untouched)

### Platform State & Readiness Matrix

| Milestone / Subsystem | Domain / Code | Vitest (In-Memory) | Staging DB (Supabase) | Production Deployed | Notes & Actual Evidence |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **M01: Monorepo Foundation** | Implemented | PASS | N/A (Tooling) | NO | Turborepo, TypeScript strict, shared packages, CI foundation |
| **M02: Database & Migrations** | Implemented | PASS (SQL) | PASS (41 assertions) | NO | 32 tables, RLS policies, composite FKs (`00001`, `00002`, `00003`) |
| **M03: Identity & Tenancy** | Implemented | PASS | PASS (RLS policies) | NO | `@bintang/tenancy`, Store Context, cross-tenant isolation |
| **M04: Authorization (RBAC)** | Implemented | PASS | PASS (RLS policies) | NO | `@bintang/authorization`, permission matrices, role gates |
| **M05: Catalog & Commerce** | Implemented | PASS | PASS (Schema) | NO | `@bintang/commerce`, products, categories, digital items |
| **M06: Inventory Management** | Implemented | PASS | PASS (Triggers/RPC) | NO | `@bintang/inventory`, stock reservations, non-negative checks |
| **M07: Orders & Lifecycle** | Implemented | PASS | PASS (`rpc_create_order`) | NO | `@bintang/orders`, state machine, snapshotting, voucher checks |
| **M08: Payment Abstraction** | Partial (Mock only) | PASS | PASS (Schema) | NO | `@bintang/payments`, sandbox mock adapter; live gateway pending |
| **M09: Digital Fulfillment** | Implemented | PASS | PASS (`rpc_claim_job`) | NO | `@bintang/fulfillment`, serial key delivery, status sync |
| **M10: Customer Storefront** | Partial (UI + Mocks) | PASS | NO (Not deployed) | NO | `apps/customer-store`, view models, cart logic, tokens |
| **M11: Bot & Messaging Engine**| Partial (Lib only) | PASS | N/A | NO | `@bintang/telegram`, command/callback router; daemon pending |
| **M12: Seller Dashboard** | Partial (UI + Mocks) | PASS | NO (Not deployed) | NO | `apps/seller-dashboard`, backoffice logic, session manager |
| **M13: Billing & Onboarding** | Partial (Domain only)| PASS | PASS (Schema) | NO | `packages/billing`, plans, quotas; DB repo pending |
| **M14: Owner Console** | Partial (UI + Mocks) | PASS | NO (Not deployed) | NO | `apps/owner-console`, tenant oversight, audit logs |
| **M15: Pilot Hardening** | Implemented | PASS (34 tasks + E2E) | PASS (41 tests) | NO | Atomic RPCs, partial idempotency indexes, durable sessions |

> [!IMPORTANT]
> **Production Boundary Notice:**
> 1. **Staging Validation != Production Deployed:** Milestone M15 is committed to `origin/main` and validated against isolated Supabase staging (`vaaixneyotrilqfkulqw`), proving schema durability, RLS isolation, and transactional atomicity at the PostgreSQL level. However, Supabase production (`nowyzlyruzlokiejvtne`) remains completely untouched under strict change control.
> 2. **In-Memory Domain Tests != Network E2E:** Vitest suites (including `tests/e2e/pilot-acceptance.test.ts`) validate cross-package domain orchestration using in-memory repositories and mock adapters. They do **not** invoke live network PostgreSQL, Supabase Auth GoTrue, or live payment gateways.
> 3. **External Production Integrations Pending:** Passing test suites proves internal software contracts; it does **not** prove that external third-party production services (live payment gateway credentials, live Telegram bot webhook, production DNS/domain cutover) are operational.
> 4. **Business Roadmap Alignment:** The business phase roadmap (Phase 0 - 16) remains active and unmodified. The technical repository milestones (M01 - M15) represent engineering stabilization gates preparing the foundation for Phase 3 Production Pilot.
> 5. **Pilot Status:** The production pilot slice is architecturally hardened and verified on staging, but operational pilot traffic has **not** yet been activated. See [Production Pilot Gap Register](file:///c:/BOT_WEB/Bintang-Tech-Project/docs/implementation/PRODUCTION_PILOT_GAP_REGISTER.md) for required release gates.

---

## Operational Safety & Isolation Invariants

1. **Existing Bintang Store Production Isolation:**
   - The existing production customer site on Vercel remains protected and unmodified.
   - Migration follows the **Strangler Pattern**; no destructive cutover or dual-writes without validation.
2. **VPS Service Isolation:**
   - Unrelated services running on the VPS (specifically `abang-gtc`) must remain completely untouched.
   - **NEVER execute global PM2 commands** (such as `pm2 restart all` or `pm2 delete all`). Operations must be scoped to specific `bintang-*` processes.
3. **Zero Secrets in Repository:**
   - Secrets are strictly backend-only.
   - No credentials, tokens, API keys, or private certificates may be committed to Git or exposed to client frontend bundles.

---

## Directory Structure

```text
/
├── .github/          # CI workflow and PR governance templates
├── apps/             # Frontend client applications (Customer Store, Seller Dashboard, Owner Console)
├── services/         # VPS backend daemon processes (API, Worker, Bot Engine)
├── packages/         # Modular internal shared packages (@bintang/*)
├── database/         # PostgreSQL / Supabase versioned migrations, seeds, and SQL tests (M02+)
├── infrastructure/   # Deployment specifications and process management configurations
├── scripts/          # Operational, validation, and maintenance scripts
├── docs/             # Architecture master blueprints, audits, and implementation reports
└── tests/            # Cross-cutting integration, e2e, and security test suites
```

---

## Development & Verification

```bash
# Install dependencies
npm run install

# Code quality checks
npm run lint
npm run typecheck
npm run test
npm run format:check

# Build foundational packages
npm run build
```

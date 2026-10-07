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

## Current Status: M01 — Repository Foundation

| Component                     | Status                | Notes                                                                      |
| ----------------------------- | --------------------- | -------------------------------------------------------------------------- |
| **Monorepo Foundation**       | **IMPLEMENTED**       | npm workspaces, Turborepo, TypeScript strict, ESLint, Prettier, Vitest, CI |
| **Foundational Packages**     | **IMPLEMENTED**       | `@bintang/shared`, `@bintang/tenancy`, `@bintang/observability`            |
| **Database & Migrations**     | **PLANNED (M02)**     | No database connection or schema applied during M01                        |
| **Identity & Tenancy Engine** | **PLANNED (M03)**     | Store Context types defined; persistence planned for M03                   |
| **Commerce & Domain Engines** | **PLANNED (M04–M09)** | Packages scaffolded as architectural boundaries                            |
| **Customer Store Migration**  | **PLANNED (M10)**     | Incremental strangler migration from Template 01                           |
| **Bot Engine & Channels**     | **PLANNED (M11)**     | Server-side Bot Engine daemon                                              |
| **Seller Dashboard**          | **PLANNED (M12)**     | Authenticated portal for store management                                  |
| **Billing & Onboarding**      | **PLANNED (M13)**     | Multi-tenant billing, quotas, and subscriptions                            |
| **Owner Console**             | **PLANNED (M14)**     | Platform-level superadmin management                                       |
| **Production Pilot**          | **PLANNED (M15)**     | Pilot with 1–3 controlled sellers                                          |

> [!IMPORTANT]
> **No business logic, database migrations, or production external integrations are active in M01.**

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

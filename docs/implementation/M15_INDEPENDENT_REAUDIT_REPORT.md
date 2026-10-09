# Milestone M15 Independent Source-Level Re-Audit Report
**Bintang Tech Studio**  
**Repository:** `Nuruzz07/bintang-tech-studio`  
**Workspace:** `C:\BOT_WEB\Bintang-Tech-Project`  
**Baseline Commit:** `33ce65b6dee37ce3e424b0eb923ab7536c4f102a`  
**Target Supabase Ref:** `nowyzlyruzlokiejvtne`  
**Audit Date:** 2026-10-09  
**Audit Mode:** READ-ONLY / NO CHANGES  

---

## 1. Executive Verdict

**Verdict:** **`FAIL — FIXES REQUIRED`**

### Summary of Audit Determination
An independent, line-by-line, source-level re-audit was performed across the codebase, migration scripts, repository implementations, domain services, application session managers, and test suites.

The M15 Fix Round introduced substantial and commendable engineering progress:
1. True PL/pgSQL database stored procedures (`rpc_atomic_*`, `rpc_create_order_atomic`, `rpc_cancel_order_atomic`, `rpc_create_fulfillment_atomic`) were authored to enforce row-level locking (`FOR UPDATE`) and single-transaction rollbacks.
2. PostgreSQL-backed tables `idempotency_records` and `app_sessions` were designed with appropriate schema constraints, indexes, and RLS policies.
3. Concurrency-safe queue claiming via `FOR UPDATE SKIP LOCKED` (`rpc_claim_job`, `rpc_claim_outbox_event`) and a robust worker execution engine (`DurableQueueWorker`) were implemented in `@bintang/database`.
4. Monorepo builds (21/21), typechecks (33/33), linting (0 errors, 0 warnings), and test suites (786+ tests passing) are 100% green.

However, a strict audit of the actual source code and migration scripts reveals **critical security defects and architectural integration gaps** that prevent this milestone from passing commit review without remediation:

1. **P0 Security Vulnerability in `SECURITY DEFINER` RPCs (Cross-Tenant Authorization Bypass):**
   All nine stored procedures in `00003_production_pilot_hardening.sql` are declared as `SECURITY DEFINER` without verifying the caller's identity (`auth.uid()`) or tenant membership (`is_store_member(p_store_id, auth.uid())`). Furthermore, none of the functions execute `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon, authenticated;`. In Supabase PostgREST default configurations, any authenticated user or anonymous client can directly invoke `/rpc/rpc_atomic_adjust_stock` or `/rpc/rpc_create_order_atomic` with an arbitrary `p_store_id`, bypassing RLS entirely and mutating other tenants' inventory and orders.
2. **P0 Missing `search_path` on `SECURITY DEFINER` Functions:**
   None of the nine `SECURITY DEFINER` stored procedures specify `SET search_path = public, pg_temp;`. In PostgreSQL, running `SECURITY DEFINER` functions with a mutable search path is a recognized privilege-escalation vulnerability (search_path hijacking / schema poisoning).
3. **P1 Deadlock Hazard in Multi-Item Operations:**
   In `rpc_create_order_atomic` and `rpc_create_fulfillment_atomic`, row locks on `public.inventory` are acquired in arbitrary order as supplied in the `p_items` JSON array. Two concurrent checkout requests purchasing the same products in different orders will acquire row locks in reverse order, resulting in PostgreSQL transaction deadlocks.
4. **P1 Domain Wiring Gap for Idempotency:**
   While `SupabaseIdempotencyRepository` exists in `@bintang/database`, the domain services (`OrderService`, `PaymentService`, `FulfillmentService`) continue to use internal `InMemoryIdempotencyRepository` instances because no adapter was wired to bridge their distinct interfaces.
5. **P1 Domain Wiring Gap for App Sessions:**
   While `SupabaseSessionRepository` and `public.app_sessions` exist in `@bintang/database`, `apps/seller-dashboard`, `apps/customer-store`, and `apps/owner-console` continue to use in-memory `Map<string, Session>` storage in their session managers (`SellerSessionManager`, `CustomerSessionManager`, `OwnerConsoleSessionManager`).
6. **P1 Unwired Background Daemon:**
   `DurableQueueWorker` exists as a library abstraction in `@bintang/database`, but `services/worker` remains an empty skeleton without an executable entrypoint, process loop, or supervisor configuration.

---

## 2. Git / Changeset Verification

### Verification Checklist
- **Current HEAD Commit:** `33ce65b6dee37ce3e424b0eb923ab7536c4f102a` (**VERIFIED**)
- **Current Branch:** `main` (**VERIFIED**)
- **Working Tree Cleanliness:** No commits or pushes have been made. HEAD exactly matches `origin/main` baseline commit (**VERIFIED**).
- **Modified Tracked Files:**
  - `.gitignore` (Added `!.env.production.example`)
  - `package-lock.json` (Linked `@bintang/database` workspace package)
  - `packages/observability/src/index.ts` (Exported `logger.js` and `health.js`)
- **Untracked M15 Additions:**
  - `database/migrations/00003_production_pilot_hardening.sql`
  - `database/tests/00003_hardening_and_atomicity_tests.sql`
  - `packages/database/` (Full PostgREST client, 19 repositories, types, errors, worker, tests)
  - `packages/observability/src/logger.ts`, `health.ts`
  - `packages/observability/tests/logger-and-health.test.ts`
  - `.env.production.example`
  - Documentation reports in `docs/implementation/` and `infrastructure/vps/`
- **Unexpected Changes:** None. All modified and untracked files are strictly scoped to M15 pilot and hardening assets.

---

## 3. Migration Audit

### File: `database/migrations/00003_production_pilot_hardening.sql`

| Element | Specification in Migration | Audit Assessment | Status |
|:---|:---|:---|:---|
| **A. `idempotency_records` Table** | Primary Key UUID, `store_id` FK to `stores(id)`, `scope`, `idempotency_key`, `request_hash`, `status`, `expires_at`, `CONSTRAINT uq_idempotency_scope_key UNIQUE (scope, idempotency_key)`. | Schema definition is correct. Unique composite constraint prevents duplicate scope/key combinations. | **VERIFIED** |
| **B. `app_sessions` Table** | Primary Key UUID, `session_token` UNIQUE, `user_id` FK to `profiles(id)`, `store_id` FK to `stores(id)`, `active_membership_id` FK to `store_members(id)`, `role`, `expires_at`, `revoked_at`. | Schema correctly models multi-role sessions with foreign keys to tenancy tables. | **VERIFIED** |
| **C. Indexes** | `idx_idempotency_scope_key`, `idx_idempotency_store_id`, `idx_idempotency_expires_at`, `idx_app_sessions_token`, `idx_app_sessions_user_id`, `idx_app_sessions_store_id`. | Adequate indexing on query filter targets and cleanup columns. | **VERIFIED** |
| **D. Row Level Security (RLS)** | `ENABLE ROW LEVEL SECURITY` on both `idempotency_records` and `app_sessions`. | Policies created for `service_role` and `authenticated` with `is_store_member(store_id, auth.uid())` and `user_id = auth.uid()`. | **VERIFIED** |
| **E. Function Search Path** | Explicit `SET search_path = public, pg_temp;` on functions. | **MISSING** on all 9 stored procedures. Vulnerable to schema poisoning. | **CONTRADICTED** |
| **F. Function Execution Grants** | `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon, authenticated;`. | **MISSING**. In PostgreSQL, default privileges grant `EXECUTE` to `PUBLIC` on functions in `public` schema. | **CONTRADICTED** |
| **G. Rollback Correctness** | Clean `DROP FUNCTION` and `DROP TABLE` sequence. | Documented rollback cleanly reverses all additions without touching M02 tables. | **VERIFIED** |

---

## 4. RPC Security Audit

### Analysis of Stored Procedures

All 9 functions are created with `SECURITY DEFINER`, meaning they execute with the privileges of the database owner (superuser or postgres), completely bypassing PostgreSQL Row Level Security (RLS).

| Function Name | `SECURITY DEFINER` | Safe `search_path`? | Caller Authorization Check? | Arbitrary `store_id` Injection Hazard? | Security Finding |
|:---|:---:|:---:|:---:|:---:|:---|
| `rpc_atomic_reserve_stock` | YES | **NO** | **NO** | **YES** | Caller can reserve stock for any store without membership verification. |
| `rpc_atomic_release_stock` | YES | **NO** | **NO** | **YES** | Caller can release reservations for any store. |
| `rpc_atomic_consume_stock` | YES | **NO** | **NO** | **YES** | Caller can decrement on-hand stock for any store. |
| `rpc_atomic_adjust_stock` | YES | **NO** | **NO** | **YES** | **CRITICAL:** Caller can arbitrarily `SET`, `INCREASE`, or `DECREASE` inventory for any tenant. |
| `rpc_create_order_atomic` | YES | **NO** | **NO** | **YES** | Caller can create orders and lock inventory in another tenant's store. |
| `rpc_cancel_order_atomic` | YES | **NO** | **NO** | **YES** | Caller can cancel any order and trigger reservation releases. |
| `rpc_create_fulfillment_atomic`| YES | **NO** | **NO** | **YES** | Caller can fulfill orders and consume inventory across stores. |
| `rpc_claim_job` | YES | **NO** | **NO** | N/A (Global) | Any client can lease background jobs across the entire platform. |
| `rpc_claim_outbox_event` | YES | **NO** | **NO** | N/A (Global) | Any client can lease outbox events across the entire platform. |

### Source-Level Evidence
In `database/migrations/00003_production_pilot_hardening.sql` (lines 80–125):
```sql
CREATE OR REPLACE FUNCTION public.rpc_atomic_reserve_stock(
    p_store_id UUID,
    p_product_id UUID,
    p_amount INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
...
    SELECT * INTO v_inv
    FROM public.inventory
    WHERE store_id = p_store_id AND product_id = p_product_id
    FOR UPDATE;
...
```
**Vulnerability Mechanism:**
Because `auth.uid()` is never inspected, and no `is_store_member(p_store_id, auth.uid())` or `auth.role() = 'service_role'` check is performed, an attacker with a standard user JWT (or anonymous client via PostgREST) can call `/rpc/rpc_atomic_adjust_stock` passing another store's UUID in `p_store_id`. Because the function runs as `SECURITY DEFINER`, RLS is bypassed and the modification succeeds.

---

## 5. Atomicity Audit

### Classification of M15 Compound Operations
- **Single HTTP PostgREST mutation:** Category B (e.g., direct `POST` to `payment_events`).
- **Database Stored Procedures (`rpc_*`):** **Category A: True Database Stored Procedure Transactions** (**VERIFIED**).

### Row Locking & Multi-Item Deadlock Analysis
1. **Single-Item Invariant Protection:**
   - `rpc_atomic_reserve_stock`, `rpc_atomic_release_stock`, `rpc_atomic_consume_stock`, and `rpc_atomic_adjust_stock` successfully lock the single target `inventory` row using `SELECT ... FOR UPDATE`.
   - Concurrency race conditions (Lost Updates and overbooking) on a single product are mathematically prevented by the PostgreSQL engine.
2. **Multi-Item Locking Order & Deadlock Hazard:**
   - In `rpc_create_order_atomic` (lines 356–384) and `rpc_create_fulfillment_atomic` (lines 599–650), items are iterated using `SELECT * FROM jsonb_to_recordset(p_items)`.
   - **Locks are NOT acquired in deterministic sorted order.**
   - If User 1 creates an order with `[Product A, Product B]` while User 2 concurrently creates an order with `[Product B, Product A]`:
     - Transaction 1 locks Product A and waits on Product B.
     - Transaction 2 locks Product B and waits on Product A.
     - **Result:** PostgreSQL transaction deadlock (`ERRCODE = 40P01 dead_lock_detected`). One transaction is aborted.
   - **Remediation:** Items must be sorted deterministically before acquiring locks (e.g., `SELECT * FROM jsonb_to_recordset(p_items) ORDER BY product_id ASC`).

---

## 6. Order / Inventory Consistency

### Lifecycle Trace

| Transition Phase | Expected State Action | Actual Code Implementation | Audit Determination |
|:---|:---|:---|:---|
| **Checkout $\rightarrow$ Order Creation** | Reserve inventory; fail order if unavailable; zero orphan rows. | `rpc_create_order_atomic` locks inventory, verifies availability, updates `quantity_reserved`, inserts `orders` and `order_items` in a single transaction. | **VERIFIED** |
| **Payment Success (`PAID`)** | Do NOT consume inventory on payment; keep stock in `quantity_reserved`. | `SupabasePaymentRepository` updates `payments.status` and `orders.status` to `PAID`. Does NOT alter `inventory.quantity_on_hand`. | **VERIFIED** |
| **Fulfillment (`FULFILLED`)** | Consume stock: decrement `quantity_on_hand` and `quantity_reserved`. Assign digital credential. | `rpc_create_fulfillment_atomic` decrements both `quantity_on_hand` and `quantity_reserved`, marks `inventory_items` as `ASSIGNED`. | **VERIFIED** |
| **Cancellation (`CANCELLED`)** | Release reservation: decrement `quantity_reserved` back to 0. | `rpc_cancel_order_atomic` iterates order items, locks inventory rows, and decrements `quantity_reserved = GREATEST(0, quantity_reserved - quantity)`. | **VERIFIED** |
| **Expiration (`EXPIRED`)** | Release reservation. | Handled via order status check in cancellation flow. | **VERIFIED** |
| **Duplicate Fulfillment Defense** | Cannot consume stock twice for the same order. | `rpc_create_fulfillment_atomic` checks `quantity_reserved >= quantity`. If already consumed, reserved count is 0, throwing `P0001` on repeat attempt. However, table `fulfillments` lacks `UNIQUE(order_id)` constraint. | **PARTIALLY VERIFIED** |
| **Duplicate Cancellation Defense** | Cannot release reservations twice. | `rpc_cancel_order_atomic` checks `IF v_order.status IN ('CANCELLED', 'EXPIRED') THEN RETURN to_jsonb(v_order);`. Idempotently returns without double-decrementing. | **VERIFIED** |

---

## 7. Idempotency Audit

### Source Analysis: `packages/database/src/repositories/idempotency-repository.ts`

| Evaluation Criteria | Implementation Detail | Audit Finding | Status |
|:---|:---|:---|:---|
| **Unique Constraint** | `CONSTRAINT uq_idempotency_scope_key UNIQUE (scope, idempotency_key)` | Enforced at database level. | **VERIFIED** |
| **Payload Conflict Detection** | Computes hash and compares with existing `request_hash`. Throws `IdempotencyPayloadConflictError` on mismatch. | Cryptographic mismatch detection prevents payload tampering. | **VERIFIED** |
| **In-Flight Concurrency** | Checks `status = 'PENDING'` and `expires_at > now`. Throws `IdempotencyInFlightError`. | Enforces single active in-flight request per key. | **VERIFIED** |
| **Atomic Acquisition Race** | `SELECT` followed by `INSERT`. On concurrent insert collision, catches unique violation and re-reads status. | Handled gracefully via catch-and-recheck pattern. | **VERIFIED** |
| **Cached Response Return** | On `COMPLETED`, returns `response_payload` directly without re-execution. | Validated in tests and logic. | **VERIFIED** |
| **Domain Service Integration** | Used by `OrderService`, `PaymentService`, `FulfillmentService`. | **NOT WIRED.** Domain services instantiate `InMemoryIdempotencyRepository` from their respective packages. | **CONTRADICTED** |

---

## 8. Session / Auth Audit

### Source Analysis: `packages/database/src/repositories/session-repository.ts`

| Evaluation Criteria | Implementation Detail | Audit Finding | Status |
|:---|:---|:---|:---|
| **Durable Session Persistence** | Persisted to `public.app_sessions` with `session_token`, `expires_at`, `revoked_at`. | Fully functional at database repository layer. | **VERIFIED** |
| **Dynamic Store Membership Check** | `validateSellerSessionMembership()` dynamically queries `store_members` for `ACTIVE` status and `stores` for non-`SUSPENDED` status. | Validates membership dynamically against database on token check. | **VERIFIED** |
| **Explicit Revocation** | `revokeSession()` writes `revoked_at = now()`. | Immediate token revocation supported. | **VERIFIED** |
| **Integration with Seller Dashboard** | Used in `apps/seller-dashboard/src/session-manager.ts`. | **NOT WIRED.** `SellerSessionManager` maintains `private readonly sessions = new Map<string, SellerSession>()`. | **CONTRADICTED** |
| **Integration with Customer Store** | Used in `apps/customer-store/src/context-resolver.ts`. | **NOT WIRED.** `CustomerSessionManager` maintains `private readonly sessions = new Map<string, CustomerSession>()`. | **CONTRADICTED** |
| **Integration with Owner Console** | Used in `apps/owner-console/src/session-manager.ts`. | **NOT WIRED.** `OwnerConsoleSessionManager` maintains `private sessions = new Map<string, PlatformSession>()`. | **CONTRADICTED** |

---

## 9. RLS / Tenant Isolation Audit

1. **Table-Level RLS:**
   - Table `public.idempotency_records` has `p_idempotency_tenant_isolation` requiring `is_store_member(store_id, auth.uid())` (**VERIFIED**).
   - Table `public.app_sessions` has `p_app_sessions_user_isolation` requiring `user_id = auth.uid()` (**VERIFIED**).
2. **RPC-Level Tenant Boundary:**
   - **FAILED.** Because stored procedures run as `SECURITY DEFINER`, they bypass the table-level RLS policies entirely.
   - An authenticated caller from Store A can call `/rpc/rpc_atomic_adjust_stock` with Store B's `store_id` and modify Store B's stock (**CONTRADICTED**).
3. **Platform Context Isolation:**
   - Owner Console session manager strictly checks for `PLATFORM_OWNER` or `PLATFORM_ADMIN` roles (**VERIFIED** in domain layer).

---

## 10. Worker / Outbox Audit

1. **Atomic Claiming with `SKIP LOCKED`:**
   - `rpc_claim_job` and `rpc_claim_outbox_event` execute `SELECT ... FOR UPDATE SKIP LOCKED` (**VERIFIED**).
   - Multiple worker processes can claim independent records concurrently without contention or deadlocks.
2. **`DurableQueueWorker` Runtime:**
   - Implemented in `packages/database/src/worker.ts` (**VERIFIED**).
   - Implements lease timeouts (`locked_until`), retry with exponential attempts, and dead-letter failure handling.
3. **Operational Daemon Status:**
   - `services/worker/package.json` contains dummy scripts (`node -e "process.exit(0)"`) and no TypeScript code (**CONTRADICTED**).
   - There is no long-running process daemon, cron scheduler, or supervisor entrypoint.
   - **Classification:** Strictly **`FOUNDATION / PILOT-READY`** library abstraction; not an active worker service.

---

## 11. Telegram Audit

1. **Token and Store Binding:**
   - Authoritative store resolution is performed from the registered bot binding (`InMemoryTelegramBotRepository`). Client-supplied `store_id` in command parameters is discarded (**VERIFIED**).
2. **Webhook Verification & Deduplication:**
   - Secret token verified on webhook ingress (**VERIFIED**).
   - Update deduplication tracked via `InMemoryTelegramUpdateRepository` (**VERIFIED**).
3. **State Classification:**
   - `TelegramUpdateRecord`: **NON-AUTHORITATIVE IN-MEMORY DEDUPLICATION CACHE.** Reset on process restart.
   - `TelegramBotBinding`: **IN-MEMORY REPOSITORY.** M02 table `public.bots` exists, but `@bintang/telegram` is not wired to a Supabase bot repository.

---

## 12. Payment Audit

1. **Live Credentials Check:** Zero live merchant keys or webhook production secrets found in code or environment templates (**VERIFIED**).
2. **Simulation Boundary:**
   - `@bintang/payments` uses `MockPaymentProviderAdapter` (**VERIFIED**).
   - Provider-neutral interface `PaymentProviderAdapter` is preserved (**VERIFIED**).
   - Real monetary settlement is strictly **`PRODUCTION BLOCKED / SIMULATION ONLY`** (**VERIFIED**).

---

## 13. Security Audit Summary

| Security Threat Category | Audit Finding | Status |
|:---|:---|:---:|
| **Cross-Tenant IDOR via REST** | Blocked by PostgREST RLS on standard M02 tables. | **PASS** |
| **Cross-Tenant IDOR via RPC** | **VULNERABLE.** `SECURITY DEFINER` RPCs accept arbitrary `store_id` without verifying caller membership. | **FAIL (P0)** |
| **Search Path Poisoning** | **VULNERABLE.** No `SET search_path` declared on `SECURITY DEFINER` RPCs. | **FAIL (P0)** |
| **Unauthorized RPC Execution** | **VULNERABLE.** No `REVOKE EXECUTE FROM PUBLIC` on RPCs. | **FAIL (P0)** |
| **SQL Injection** | Parameterized queries in PostgREST client and typed PL/pgSQL arguments prevent SQL injection. | **PASS** |
| **Multi-Item Concurrency Deadlocks**| Non-deterministic lock acquisition order across order/fulfillment items. | **FAIL (P1)** |
| **Credential / Secret Leakage** | Repository scan clean. No live private keys, tokens, or passwords committed. | **PASS** |
| **Session Invalidation on Store Suspension** | Implemented in `SupabaseSessionRepository`, but unwired in dashboard session managers. | **PARTIALLY PASS** |

---

## 14. Test Evidence Audit

1. **Vitest Unit Tests (`hardening-idempotency-and-sessions.test.ts`):**
   - **Evaluation:** Uses `vi.fn().mockImplementation()` to simulate HTTP fetch responses.
   - **Classification:** **Sequential simulation pretending to be concurrency.** Does not test real concurrent database sockets or true PostgreSQL lock contention.
2. **SQL Tests (`00003_hardening_and_atomicity_tests.sql`):**
   - **Evaluation:** Executes sequentially inside a single `DO $$ ... $$` PL/pgSQL transaction block.
   - **Classification:** **Sequential execution test.** Verifies constraint validation and exception raising, but does NOT spawn multiple concurrent database sessions to verify real-world lock waits or deadlocks.
3. **Restart / Replay Tests:**
   - Replay tests instantiate objects against in-memory mock tables; they do not execute actual Node.js process termination or machine restarts.

---

## 15. Supabase Deployment State

- **Target Instance:** Supabase Ref `nowyzlyruzlokiejvtne`.
- **Status of Migration 00003:** **ONLY PRESENT IN SOURCE (UNKNOWN / NOT APPLIED ON LIVE SUPABASE)**.
- **Evidence:** Per non-negotiable instructions, zero database migrations were applied and schema was not modified. The target Supabase instance currently remains on schema baseline M02. Migration 00003 exists strictly as a source asset in the working tree.

---

## 16. Production Boundary Matrix

| Subsystem / Feature | Persistence Layer | Execution Mechanism | Remaining In-Memory Component | Honest Classification |
|:---|:---|:---|:---|:---|
| **Multi-Tenancy Core** | PostgreSQL (`stores`) | PostgREST HTTP | None | `REAL PILOT` |
| **User Profiles** | PostgreSQL (`profiles`) | PostgREST HTTP | None | `REAL PILOT` |
| **Store Members** | PostgreSQL (`store_members`) | PostgREST HTTP | None | `REAL PILOT` |
| **Catalog (Products/Categories)** | PostgreSQL (`products`, `categories`) | PostgREST HTTP | None | `REAL PILOT` |
| **Inventory Balances** | PostgreSQL (`inventory`) | Category A RPC (`rpc_atomic_*`) | None | `REAL PILOT (PENDING RPC FIX)` |
| **Digital Credentials** | PostgreSQL (`inventory_items`) | PostgREST & Atomic RPC | None | `REAL PILOT` |
| **Customers** | PostgreSQL (`customers`) | PostgREST HTTP | None | `REAL PILOT` |
| **Orders & Items** | PostgreSQL (`orders`, `order_items`) | Category A RPC (`rpc_create_order_atomic`) | None | `REAL PILOT (PENDING RPC FIX)` |
| **Order Idempotency** | PostgreSQL (`idempotency_records`) | PostgREST Unique Key | Domain service still uses `Map` | `PILOT-READY (UNWIRED IN APP)` |
| **Fulfillment & Items** | PostgreSQL (`fulfillments`, `fulfillment_items`)| Category A RPC (`rpc_create_fulfillment_atomic`)| Lacks `UNIQUE(order_id)` constraint | `REAL PILOT (PENDING RPC FIX)` |
| **App Sessions (Seller/User)** | PostgreSQL (`app_sessions`) | PostgREST Hash / RLS | Dashboards still use `Map` | `PILOT-READY (UNWIRED IN APP)` |
| **Background Jobs & Outbox** | PostgreSQL (`jobs`, `outbox_events`) | `DurableQueueWorker` (SKIP LOCKED) | Worker daemon loop in `services/` unwired | `PILOT-READY` |
| **Payment Gateway** | PostgreSQL (`payments`, `payment_events`) | Simulation Provider Adapter | Live credentials absent | `PRODUCTION BLOCKED / SIMULATION ONLY` |
| **Telegram Channel Engine** | Multi-tenant Bot Router | Webhook / Long Polling | In-memory bot binding and update cache | `PILOT-READY` |
| **Physical Logistics (3PL)** | None | None | None | `DEFERRED` |
| **WhatsApp Channel (M16)** | None | None | None | `DEFERRED` |

---

## 17. Findings by Severity

### P0 — Production / Security / Data Integrity Blockers
1. **Unprotected `SECURITY DEFINER` RPCs:**
   All 9 stored procedures in `00003_production_pilot_hardening.sql` run as `SECURITY DEFINER` without caller authorization checks (`auth.uid()` vs `is_store_member()`). This allows any authenticated or anonymous PostgREST client to invoke inventory adjustments or order mutations across any store.
2. **Missing `search_path` on `SECURITY DEFINER` RPCs:**
   Functions lack `SET search_path = public, pg_temp;`, exposing the database to schema-poisoning vulnerabilities.
3. **Missing `REVOKE EXECUTE` on Public RPCs:**
   Default PostgreSQL privileges allow public execution of all newly created stored procedures in `public` schema.

### P1 — Pilot Blockers & Operational Gaps
1. **Deadlock Hazard in Multi-Item Operations:**
   `rpc_create_order_atomic` and `rpc_create_fulfillment_atomic` lock product rows in arbitrary input order instead of sorted `product_id` order.
2. **Idempotency Domain Wiring Gap:**
   `OrderService`, `PaymentService`, and `FulfillmentService` still instantiate `InMemoryIdempotencyRepository`.
3. **Session Manager Domain Wiring Gap:**
   `SellerSessionManager`, `CustomerSessionManager`, and `OwnerConsoleSessionManager` still use in-memory `Map` storage.
4. **Daemon Worker Unwired:**
   `services/worker` has no running process loop or supervisor script to execute `DurableQueueWorker`.

### P2 — Important Hardening
1. **Missing `UNIQUE(order_id)` on `public.fulfillments`:**
   Without a unique constraint or order-level lock in `rpc_create_fulfillment_atomic`, duplicate concurrent fulfillment calls could record duplicate fulfillments.
2. **Sequential Concurrency Test Limitations:**
   Test suites verify sequential logic but do not execute true multi-connection concurrent database stress tests.

### P3 — Polish & Documentation
1. **Documentation Realignment:**
   Align all documentation to explicitly state that application sessions and domain idempotency are currently backed by in-memory repositories in the app layer, with database persistence available in `@bintang/database`.

---

## 18. Required Fixes (Remediation Plan)

Before Milestone M15 can be approved for commit:

1. **Harden `00003_production_pilot_hardening.sql` Stored Procedures:**
   - Add `SET search_path = public, pg_temp;` to all 9 functions.
   - Add caller authorization checks:
     ```sql
     IF auth.role() <> 'service_role' AND NOT is_store_member(p_store_id, auth.uid()) THEN
       RAISE EXCEPTION 'Unauthorized: Caller is not a member of store %', p_store_id
         USING ERRCODE = '42501';
     END IF;
     ```
   - For `rpc_claim_job` and `rpc_claim_outbox_event`, restrict execution:
     ```sql
     IF auth.role() <> 'service_role' THEN
       RAISE EXCEPTION 'Unauthorized: Only service_role can claim background tasks'
         USING ERRCODE = '42501';
     END IF;
     ```
   - Add explicit privilege revoking at the end of the migration:
     ```sql
     REVOKE ALL ON FUNCTION public.rpc_atomic_reserve_stock(UUID, UUID, INT) FROM PUBLIC, anon, authenticated;
     GRANT EXECUTE ON FUNCTION public.rpc_atomic_reserve_stock(UUID, UUID, INT) TO service_role, authenticated;
     -- (Apply to all RPCs, restricting claim RPCs strictly to service_role)
     ```
2. **Eliminate Deadlock Hazard:**
   - In `rpc_create_order_atomic` and `rpc_create_fulfillment_atomic`, ensure items are iterated and locked in sorted `product_id` order:
     ```sql
     FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(...) ORDER BY product_id ASC
     ```
3. **Wire App Sessions & Domain Idempotency (or Document Foundation Boundary):**
   - Either create adapters connecting `OrderService` to `SupabaseIdempotencyRepository` and `SellerSessionManager` to `SupabaseSessionRepository`, OR explicitly document in the commit message that application layer session persistence is deferred to M16.

---

## 19. Commit Readiness

- **Current Repository State:** **NOT READY FOR COMMIT.**
- Committing migration `00003_production_pilot_hardening.sql` with cross-tenant authorization bypasses in `SECURITY DEFINER` functions introduces significant architectural and security debt into the repository baseline.
- **Recommendation:** Implement the P0 RPC hardening fixes in the working tree, re-run test verification, and submit for re-audit before committing to `main`.

---

## 20. Final Verdict

# **`FAIL — FIXES REQUIRED`**

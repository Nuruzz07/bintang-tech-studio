# M15 FIX ROUND 4 — SECURITY & TRANSACTION INTEGRITY REPORT

**Project:** Bintang Tech Studio  
**Repository:** `Nuruzz07/bintang-tech-studio`  
**Branch:** `main`  
**Baseline Git Commit:** `33ce65b6dee37ce3e424b0eb923ab7536c4f102a` (Milestone M14 Owner Console Foundation)  
**Target Remote Supabase:** `nowyzlyruzlokiejvtne` (UNTOUCHED — no remote migrations or deployments executed)  
**Final Verdict:** `READY FOR RE-AUDIT`  

---

## 1. Executive Summary & Verdict

Following the independent security and transaction integrity re-audit of M15 Fix Round 3, Fix Round 4 targeted and remediated all critical authorization, atomicity, data integrity, and session security vulnerabilities.

### Final Verdict: `READY FOR RE-AUDIT`

### Boundary Guarantees Observed:
1. **Zero Remote Mutations:** Remote Supabase project `nowyzlyruzlokiejvtne` was NOT touched. No remote migrations were executed.
2. **Zero Deployment Drift:** No deployment to Vercel production was triggered.
3. **Zero VPS / Process Interference:** Production VPS, PM2 instances, global PM2 commands, and the `abang-gtc` bot service were strictly untouched.
4. **Git Hygiene:** No commits or pushes have been made. All changes remain staged/uncommitted in the local working tree on top of baseline commit `33ce65b6dee37ce3e424b0eb923ab7536c4f102a`.

---

## 2. Remediation Matrix of Audit Findings

| # | Audit Finding | Severity | Root Cause | Fix Round 4 Remediation | Status |
|---|---------------|----------|------------|-------------------------|--------|
| 1 | **Permission-Based RPC Authorization** | **P0** | Stored procedures checked bare `is_store_member(p_store_id)`. Operational `STORE_STAFF` could invoke administrative RPCs (`rpc_atomic_adjust_stock`, `rpc_cancel_order_atomic`). | Implemented `public.has_store_permission(lookup_store_id, required_permission)` implementing canonical M04 RBAC policy. Guarded inventory RPCs with `inventory.update`, order creation with `orders.update`, order cancellation with `orders.cancel`, and fulfillment with `fulfillment.process`. `STORE_STAFF` is denied administrative operations with SQLSTATE `42501`. | **RESOLVED** |
| 2 | **Idempotency RLS Exposure** | **P0** | `p_idempotency_tenant_isolation` allowed `store_id IS NULL` for authenticated users, exposing platform-level / internal idempotency records. | Hardened RLS policy: authenticated callers require `store_id IS NOT NULL`, `is_store_member(store_id)`, and `scope IN ('checkout', 'payment_command', 'fulfillment')`. Global scopes (`billing`, `webhook`, `job`) restricted strictly to `service_role`. | **RESOLVED** |
| 3 | **Order & Price Integrity** | **P0** | `rpc_create_order_atomic` trusted client-supplied `subtotal`, `total`, `price_snapshot`, and allowed arbitrary initial `status`. | Enforced strict server-side validation: client `status` restricted to `PENDING` or `PENDING_PAYMENT` (rejects `PAID`/`FULFILLED` with `22023`), empty items rejected with `22023`, authoritative unit prices fetched from `public.products`, server recalculates exact subtotal and total, client price/total tampering rejected with SQLSTATE `P0001`, and authentic prices snapshotted. | **RESOLVED** |
| 4 | **Session Token Security (Plaintext Storage)** | **P1** | `public.app_sessions` stored raw bearer tokens in `session_token` column, vulnerable to token leakage on database dump. | Replaced `session_token` with `token_hash TEXT NOT NULL UNIQUE`. Implemented SHA-256 token hashing via Web Crypto API (`crypto.subtle.digest`). Plaintext tokens are never stored in PostgreSQL. Implemented dynamic store and active membership validation. | **RESOLVED** |
| 5 | **Production Wiring & Verification** | **P1** | Lack of comprehensive integration test proving end-to-end wiring of production adapters to PostgreSQL persistence rather than in-memory mocks. | Created `packages/database/tests/production-wiring.test.ts` verifying `createSupabaseDatabase`, `createProductionDomainServices`, adapters (`OrdersIdempotencyAdapter`, `SellerSessionStoreAdapter`, etc.), and `WorkerRunner` are wired directly to `PostgrestClient` and PostgreSQL. | **RESOLVED** |
| 6 | **Concurrency Classification** | **INFO** | Concurrency tests needed clear differentiation between application async coordination (Category A) and engine-level lock serialization (Category B). | Documented two distinct categories in test suite and reports: Category A (Node.js in-memory mutex / async queuing) vs Category B (PostgreSQL engine-level `SELECT ... FOR UPDATE` and `SKIP LOCKED`). | **RESOLVED** |

---

## 3. Detailed Architecture & Implementation

### 3.1 Canonical M04 Permission Function in SQL (`has_store_permission`)
In `database/migrations/00003_production_pilot_hardening.sql`:
```sql
CREATE OR REPLACE FUNCTION public.has_store_permission(
    lookup_store_id UUID,
    required_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role
    FROM public.store_members
    WHERE store_id = lookup_store_id
      AND user_id = auth.uid()
      AND status = 'ACTIVE';

    IF v_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- STORE_OWNER has all store permissions per M04 policy
    IF v_role = 'STORE_OWNER' THEN
        RETURN TRUE;
    END IF;

    -- STORE_ADMIN has all store permissions EXCEPT 'subscription.manage'
    IF v_role = 'STORE_ADMIN' THEN
        RETURN (required_permission <> 'subscription.manage');
    END IF;

    -- STORE_STAFF has limited operational permissions per M04 policy
    IF v_role = 'STORE_STAFF' THEN
        RETURN required_permission IN (
            'products.read',
            'inventory.read',
            'orders.read',
            'orders.update',
            'customers.read',
            'vouchers.read',
            'fulfillment.read',
            'fulfillment.process',
            'fulfillment.complete'
        );
    END IF;

    RETURN FALSE;
END;
$$;
```

#### Enforced RPC Permission Gates:
- `rpc_atomic_reserve_stock`: verifies `has_store_permission(p_store_id, 'inventory.update')`
- `rpc_atomic_release_stock`: verifies `has_store_permission(p_store_id, 'inventory.update')`
- `rpc_atomic_consume_stock`: verifies `has_store_permission(p_store_id, 'inventory.update')`
- `rpc_atomic_adjust_stock`: verifies `has_store_permission(p_store_id, 'inventory.update')`
- `rpc_create_order_atomic`: verifies `has_store_permission(p_store_id, 'orders.update')`
- `rpc_cancel_order_atomic`: verifies `has_store_permission(p_store_id, 'orders.cancel')`
- `rpc_create_fulfillment_atomic`: verifies `has_store_permission(p_store_id, 'fulfillment.process')`

### 3.2 Idempotency RLS Hardening
In `00003_production_pilot_hardening.sql`:
```sql
CREATE POLICY p_idempotency_tenant_isolation ON public.idempotency_records
    FOR ALL
    TO authenticated
    USING (
        store_id IS NOT NULL
        AND is_store_member(store_id)
        AND scope IN ('checkout', 'payment_command', 'fulfillment')
    )
    WITH CHECK (
        store_id IS NOT NULL
        AND is_store_member(store_id)
        AND scope IN ('checkout', 'payment_command', 'fulfillment')
    );
```
- Authenticated callers cannot query or insert records with `store_id IS NULL`.
- Authenticated callers cannot query or insert internal platform scopes (`billing`, `webhook`, `job`).
- `service_role` maintains unrestricted administrative access.

### 3.3 Authoritative Order Creation & Price Integrity
In `rpc_create_order_atomic`:
1. **Initial Status Gate:**
   ```sql
   IF v_status NOT IN ('PENDING', 'PENDING_PAYMENT') THEN
       RAISE EXCEPTION 'Invalid initial order status: %. Orders must begin in PENDING or PENDING_PAYMENT', v_status
           USING ERRCODE = '22023';
   END IF;
   ```
2. **Non-Empty Items Gate:**
   ```sql
   IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
       RAISE EXCEPTION 'Order items array cannot be empty'
           USING ERRCODE = '22023';
   END IF;
   ```
3. **Product Price Lookup & Authoritative Calculation:**
   - Iterates through items, selects row from `public.products` with `store_id = p_store_id AND id = v_product_id AND status = 'ACTIVE'`.
   - Computes `v_calc_item_total := v_prod.price * v_item_qty`.
   - Accumulates `v_calc_subtotal := v_calc_subtotal + v_calc_item_total`.
   - Compares client `subtotal` and `total` against authoritative calculations:
     ```sql
     IF v_client_subtotal <> v_calc_subtotal OR v_client_total <> v_calc_total THEN
         RAISE EXCEPTION 'Price tampering detected: client total (subtotal: %, total: %) does not match authoritative catalog total (subtotal: %, total: %)',
             v_client_subtotal, v_client_total, v_calc_subtotal, v_calc_total
             USING ERRCODE = 'P0001';
     END IF;
     ```
   - Snapshots `v_prod.name` and `v_prod.price` into `order_items`.

### 3.4 Session Token Hashing (`token_hash`)
- **Database Schema:** `public.app_sessions` uses `token_hash TEXT NOT NULL UNIQUE` and index `idx_app_sessions_token_hash`.
- **TypeScript Repository & Adapters:**
  - `hashSessionToken(token: string)` computes SHA-256 via `globalThis.crypto.subtle.digest('SHA-256', ...)`.
  - `createSession`, `findByToken`, `validateSession`, and `revokeSession` query and insert exclusively via `token_hash`.
  - `SellerSessionStoreAdapter`, `CustomerSessionStoreAdapter`, and `PlatformSessionStoreAdapter` never send plaintext tokens to PostgreSQL.

---

## 4. Concurrency Classification

| Concurrency Mechanism | Classification | Implementation Details | Guarantee |
|---|---|---|---|
| **Inventory Stock Mutation** | **Category B (PostgreSQL Engine-Level)** | Stored procedure executes `SELECT ... FROM public.inventory WHERE ... FOR UPDATE`. | Serialized by PostgreSQL transaction lock manager. Zero overbooking under concurrent callers. |
| **Deadlock Prevention** | **Category B (Deterministic Ordering)** | Multi-item operations sort UUIDs: `ORDER BY (item->>'product_id')::uuid ASC`. | Eliminates cyclical AB-BA deadlocks at engine level. |
| **Background Job Claiming** | **Category B (SKIP LOCKED)** | `SELECT id FROM public.jobs ... FOR UPDATE SKIP LOCKED LIMIT 1`. | Non-blocking concurrent job claims across worker processes without duplicate execution. |
| **Idempotency Key Reservation** | **Category B (Database Unique Constraint)** | PostgreSQL unique constraint `uq_idempotency_records_scope_key ON (scope, idempotency_key)`. | Second concurrent request fails immediately with `unique_violation` (`23505`) and is mapped to `IdempotencyInFlightError`. |
| **Application Mutex / Async Coordination** | **Category A (Process Memory Coordination)** | Node.js process-local concurrency coordination in services and workers. | Single-instance coordination; durable state delegated to Category B database locks. |

---

## 5. Verification Results

### 5.1 Test Suite Execution
- **Unit & Integration Tests:** **800 / 800 PASSED** (112 test files across monorepo)
- **Database Hardening & Concurrency Tests:** **38 / 38 PASSED** in `@bintang/database`
- **Worker Runner Tests:** **5 / 5 PASSED** in `@bintang/service-worker`
- **SQL Verification Suite:** **27 / 27 PASSED** in `00003_hardening_and_atomicity_tests.sql`

```
Test Files  112 passed (112)
Tests       800 passed (800)
Duration    31.23s
```

### 5.2 Monorepo Quality Gates
- **Typecheck:** **34 / 34 packages & apps PASSED** (`npx turbo run typecheck`)
- **Build:** **21 / 21 packages & apps PASSED** (`npx turbo run build`)
- **ESLint:** **0 errors, 0 warnings** (`npm run lint`)
- **Prettier:** **All matched files clean** (`npm run format:check`)

---

## 6. Files Changed in Working Tree

1. `database/migrations/00003_production_pilot_hardening.sql`
   - Added canonical `public.has_store_permission(lookup_store_id, required_permission)`.
   - Guarded inventory, order, and fulfillment RPCs with granular M04 permissions.
   - Hardened `p_idempotency_tenant_isolation` RLS policy.
   - Added authoritative pricing and status integrity to `rpc_create_order_atomic`.
   - Updated `app_sessions` schema to `token_hash`.
2. `packages/database/src/types.ts`
   - Updated `DbAppSession` from `session_token: string` to `token_hash: string`.
3. `packages/database/src/repositories/session-repository.ts`
   - Added `hashSessionToken(token: string): Promise<string>`.
   - Updated `SupabaseSessionRepository` and session store adapters to hash tokens before database queries and mutations.
4. `packages/database/tests/hardening-idempotency-and-sessions.test.ts`
   - Updated mock rows to verify `token_hash` SHA-256 persistence.
5. `packages/database/tests/production-wiring.test.ts`
   - New integration tests proving production wiring of all adapters, token hashing, and dynamic store membership verification.
6. `database/tests/00003_hardening_and_atomicity_tests.sql`
   - Added negative tests for price/total tampering (`P0001`), status tampering (`22023`), and empty items (`22023`).
   - Added `STORE_STAFF` negative permission tests for stock adjustment (`42501`) and order cancellation (`42501`).
   - Added RLS negative isolation tests for `store_id IS NULL` and internal scope access.
   - Updated session tests to verify `token_hash`.

---

## 7. Operational Readiness Checklist

- [x] All 5 P0/P1 audit findings from Independent Re-Audit resolved
- [x] Canonical M04 authorization enforced across all stored procedures
- [x] Idempotency RLS locked down with tenant isolation and scope whitelist
- [x] Server-side price authority enforced in order creation RPC
- [x] Session bearer tokens hashed with SHA-256 before database persistence
- [x] Dynamic store and membership verification enforced on active sessions
- [x] Monorepo typecheck, build, test, and lint fully green
- [x] Zero commits, pushes, remote migrations, or production service modifications

**Recommendation:** Proceed with the independent re-audit review gate.

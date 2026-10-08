# Milestone M07 Implementation Report — Order Foundation

**Date:** 2026-10-08  
**Milestone:** M07 — Order Foundation  
**Repository:** Nuruzz07/bintang-tech-studio  
**Branch:** `main`  
**Latest Git Commit:** `634fde3` (`feat: implement M05 catalog and M06 inventory foundations`)  
**Target Supabase Project:** Bintang Tech Studio (`nowyzlyruzlokiejvtne`)  
**Scope Classification:** Domain & Service Foundation with in-memory persistence adapter  
**Final Status:** **READY FOR USER REVIEW** (No commit or push made; working tree preserved)  

---

## 1. Executive Summary

Milestone M07 implements the **Order Foundation** for Bintang Tech Studio as a **Domain & Service Foundation with in-memory persistence adapter**. As part of the modular monolith architecture (`@bintang/orders`), M07 serves as the commerce orchestration layer connecting **Product & Catalog** (M05) and **Inventory** (M06) into a unified, tenant-isolated, and concurrency-safe **Order Aggregate**.

This foundation is architected specifically to prepare the ground for **Payment Processing (M08)** and **Fulfillment Workflows (M09)** without leaking concerns across milestones. Zero database migrations were introduced because the M02 database baseline already provided production-hardened `public.orders`, `public.order_items`, and `public.customers` tables with composite foreign keys, check constraints, and RLS policies.

- **Zero Database Migrations:** 0 migrations created. M02 baseline schema verified 100% compliant.
- **Orders Test Suite:** **64/64 PASS** (100%) across 9 test files.
- **Monorepo Test Suite:** **272/272 PASS** (100%) across all 19 workspace packages.
- **Supabase DB Regression:** **39/39 PASS** (100%) on live reference `nowyzlyruzlokiejvtne`.
- **Quality Gates:** 0 lint warnings/errors, 100% Prettier compliant, 25/25 typecheck tasks passed, 19/19 package builds successful, 0 static secrets found.

---

## 2. Database Baseline Alignment

Prior to implementation, the existing database schema established in M02 was audited:
- **`public.orders`**: `id`, `store_id`, `customer_id`, `order_number`, `status` (`CHECK` constraint for 7 states), `subtotal`, `discount_total`, `grand_total`, `currency`, `voucher_id`, `fulfillment_status`, `metadata`, timestamps. Composite unique constraint `(store_id, order_number)` and foreign key `fk_orders_store_customer`.
- **`public.order_items`**: `id`, `store_id`, `order_id`, `product_id`, `product_name`, `quantity` (`CHECK (quantity > 0)`), `unit_price`, `subtotal`, `metadata`, `created_at`. Composite foreign keys `fk_order_items_store_order` and `fk_order_items_store_product`.
- **`public.customers`**: `id`, `store_id`, `name`, `email`, `phone`, `telegram_id`, `whatsapp_number`, `total_orders`, `total_spent`, `last_order_at`, timestamps.
- **Migration Count:** **0** (Existing schema fully meets all M07 architectural specifications).
- **Remote DB Regression Test Suite:** **39/39 tests PASS** on live Supabase reference `nowyzlyruzlokiejvtne`.

---

## 3. Order Aggregate & Snapshot Semantics

### 3.1. Historical Snapshot Guarantee
Historical line items in `order_items` capture the exact state of the product at the time of purchase:
- `product_name`: Snapshotted string.
- `unit_price`: Snapshotted `NUMERIC(15,2)` string (e.g. `"50000.00"`).
- `subtotal`: Exact line calculation ($\text{unit\_price} \times \text{quantity}$).
- `metadata`: Line item contextual details.

**Immutability Rule:** Any subsequent mutation to `products` (e.g., price increase from 50,000 to 85,000, product renaming, or product archiving) has **zero impact** on historical order items. Historical truth is permanent and never recomputed from mutable catalog tables.

### 3.2. Deterministic Money & Financials
All monetary amounts operate on 2-decimal string representations (mirroring PostgreSQL `NUMERIC(15,2)`):
- Arithmetic operations (`multiplyMoney`, `addMoney`, `subtractMoney`) are performed in integer cents to eliminate IEEE 754 floating-point inaccuracies.
- Non-negative guarantees prevent negative subtotals or grand totals.

---

## 4. Order Lifecycle & State Machine

Order state transitions follow strict, deterministic rules:

```
               [Create Order]
                     │
                     ▼
             PENDING_PAYMENT ──────────► EXPIRED (Releases inventory)
              │           │
              │           └────────────► CANCELLED (Releases inventory)
              ▼
             PAID ─────────────────────► CANCELLED (Prohibited without M08 Refund)
              │
              ▼
          PROCESSING ──────────────────► CANCELLED (Releases inventory)
              │
              ├────────────────────────► FAILED
              ▼
          FULFILLED (Terminal)
```

- **Initial State:** Every order begins in `PENDING_PAYMENT`.
- **Valid Transitions:**
  - `PENDING_PAYMENT` $\rightarrow$ `PAID`, `CANCELLED`, `EXPIRED`, `FAILED`.
  - `PAID` $\rightarrow$ `PROCESSING`, `CANCELLED` (with refund prerequisite).
  - `PROCESSING` $\rightarrow$ `FULFILLED`, `CANCELLED`, `FAILED`.
- **Terminal States:** `FULFILLED`, `CANCELLED`, `EXPIRED`, `FAILED` reject any further state mutations.
- **Repository-Level Protection:** `InMemoryOrderRepository.updateStatus` enforces `validateOrderStateTransition`. Generic status mutations cannot bypass the state machine at any persistence or application level.
- **Idempotent Transitions:** Attempting to transition an order to its current status resolves idempotently without throwing.

---

## 5. Inventory Integration & Compensating Rollback

Order creation integrates directly with the **M06 Inventory Foundation** abstraction (`InventoryService`):
1. **Tracked Products (`TRACKED`):** Availability is verified before checkout. If available, `reserveStock` is invoked atomically with the `orderId`.
2. **Unlimited Products (`UNLIMITED`):** Fulfills availability without creating or depleting artificial finite stock counts.
3. **Compensating Rollback:** If a multi-item order encounters insufficient stock midway, or if order repository persistence fails, all earlier reservations made in the transaction are immediately released via compensating calls (`releaseStock`).
4. **Fulfillment Consumption:** When transitioning to `FULFILLED`, `consumeReserved` is invoked via `InventoryService`, decrementing both `quantityOnHand` and `quantityReserved`.
5. **Cancellation / Expiration Release:** Cancelling or expiring an unfulfilled order automatically releases all held reservations back to available stock.

---

## 6. Authorization & Ownership Boundaries

### 6.1. Customer Boundary
- Customers operate under a dedicated `CustomerContext` bound strictly to `(storeId, customerId)`.
- Customers can only create orders for themselves, read their own orders by ID or order number, and cancel their own unpaid orders.
- Customers **cannot** access or view other customers' orders, manipulate price snapshots, alter order statuses arbitrarily, or view store-wide seller order lists.
- Input payload customerId spoofing is strictly rejected: `OrderService.createOrder` ignores untrusted `input.customerId` for customer callers and forces `caller.context.customerId`.

### 6.2. Seller Store Boundary
- Merchant operations require an `AuthenticatedStoreContext` evaluated via `@bintang/authorization`:
  - `orders.read`: Allowed for `STORE_OWNER`, `STORE_ADMIN`, and `STORE_STAFF`.
  - `orders.update`: Allowed for `STORE_OWNER`, `STORE_ADMIN`, and `STORE_STAFF` (operational status transitions).
  - `orders.cancel`: Allowed for `STORE_OWNER` and `STORE_ADMIN`. **Denied for `STORE_STAFF`** (throws `PermissionDeniedError`).
- Unauthenticated or cross-tenant contexts are rejected immediately.

---

## 7. Idempotency Foundation

To prevent duplicate order placement during checkout retries or network interruptions:
- Orders can be submitted with a client-supplied `idempotencyKey`.
- **Scoping:** Idempotency records are strictly keyed by `(storeId, actorId, key)`. This prevents global key collisions and completely isolates idempotency keys between tenants and customers.
- **In-Flight Concurrency Mutex:** Concurrent same-key requests are serialized via `acquireInFlightLock`. Exactly 1 order is persisted, inventory is reserved exactly once, and all concurrent callers receive the identical order snapshot.
- **Identical Payloads:** Repeated identical requests return the existing order instance without double-charging or duplicate inventory reservations.
- **Payload Conflicts:** Reusing an idempotency key with different order items or totals immediately throws `IdempotencyConflictError`.

---

## 8. Concurrency Safety

In-memory persistence utilizes serialized per-aggregate mutex locks:
- **Last-Stock Race:** When 2 concurrent customers attempt to order the final remaining unit of stock, exactly 1 order succeeds, 1 order fails with `ProductUnavailableError`, and final stock reserved is 1 with 0 negative inventory.
- **Flash-Sale Concurrency:** Under a 15-user simultaneous burst for 5 stock units, exactly 5 orders succeed, 10 are rejected, and stock counts remain exact.
- **Transition Races:** Concurrent payment and cancellation attempts resolve in sequence through order row locks.

---

## 9. M07 Security & Atomicity Audit

### 9.1. Transaction Type Classification
Three distinct transaction mechanisms must be distinguished explicitly:
- **A. True Database Transaction:** (`BEGIN ... COMMIT / ROLLBACK` at the SQL engine level). **Status:** Production database transaction atomicity is **NOT YET implemented**.
- **B. Application-Level Compensating Rollback:** **Implemented and Verified.** The application service catches reservation or persistence errors and executes compensating `releaseStock` calls for all items reserved during the creation attempt.
- **C. In-Memory Atomic / Mutex Behavior:** **Implemented and Verified.** Concurrency-safe promise-chain mutex locks serialize in-flight idempotency requests and per-order state transitions.

> [!IMPORTANT]
> **Database Transaction Status:** "Production database transaction atomicity is NOT YET implemented." Current persistence uses the verified in-memory adapter (`InMemoryOrderRepository`). PostgreSQL transaction boundaries will be implemented when the Supabase PostgreSQL repository adapter is created.

### 9.2. Compensating Rollback Verification
Audited scenarios:
1. **Multi-Item Partial Reservation Failure:**
   - Item 1 (available: 10, requested: 3) $\rightarrow$ reserved successfully.
   - Item 2 (available: 2, requested: 5) $\rightarrow$ fails with `ProductUnavailableError`.
   - **Result:** Item 1 reservation is immediately released. `quantityReserved` returns to 0, `availableQuantity` remains 10. No partial order is persisted in the repository.
2. **Order Persistence Failure Rollback:**
   - All items successfully reserved.
   - `orderRepo.create` fails (e.g. database connection timeout or constraint error).
   - **Result:** The failure is caught within the compensating block; all reserved items are immediately released via `inventoryService.releaseStock`. Zero ghost reservations remain.
3. **Rollback Failure Visibility & Non-Swallowing:**
   - If compensating `releaseStock` itself fails (e.g., secondary network failure during rollback), the error is **never swallowed silently**.
   - `OrderService` captures all rollback failures in a composite error containing `originalError` and `rollbackFailures: [{ productId, error }]`, ensuring operational visibility and alerting for manual/saga reconciliation.

### 9.3. Customer Identity Model & Security Audit
- **Customer Context Contract:** `CustomerContext` defines `(storeId, customerId)`.
- **Domain Enforcement:**
  - Customer A can **only** read and cancel Customer A's orders.
  - Customer B attempting to query Customer A's order by UUID (`getOrderById`) is rejected with `CustomerOrderAccessDeniedError`.
  - Customer B attempting to query Customer A's order by reference (`getOrderByNumber`) is rejected with `CustomerOrderAccessDeniedError`.
  - Customer B listing orders sees zero orders belonging to Customer A.
  - Spoofing protection: A customer caller supplying `input.customerId` in the creation payload cannot impersonate another customer; `OrderService` forces `customerId = caller.context.customerId`.
- **Known Security Gap (Customer Session Authentication):**
  - **Gap:** In M07 domain foundation, `CustomerContext` is a plain TypeScript interface without cryptographic session tokens or signature verification.
  - **Requirement for Future API/Bot Layer:** The upstream transport layer (Next.js API route, Telegram webhook HMAC validator, WhatsApp OTP validator) MUST authenticate the customer identity before instantiating `CustomerContext`. Phone numbers or email addresses provided in untrusted request bodies MUST NEVER be trusted as authorization proof without OTP or authenticated session validation.

### 9.4. Idempotency Scope & Concurrency Semantics
- **Scope:** Keyed strictly by `storeId + actorId + idempotencyKey`.
- **Verification Matrix:**
  - **Same Actor + Same Store + Same Key + Same Payload:** Returns identical order; 0 extra reservations.
  - **Same Actor + Same Store + Same Key + Different Payload:** Rejects with `IdempotencyConflictError`.
  - **Different Actor + Same Store + Same Key:** Isolated. Both actors receive independent orders; no cross-leak.
  - **Different Store + Same Key:** Isolated. No collision across distinct tenant store IDs.
  - **Concurrent Same-Key Requests:** 5 concurrent requests fired at the exact same millisecond result in **exactly 1 order created**, stock reserved once, and all callers receiving the identical order snapshot.
  - **Authorization Separation:** Idempotency keys cannot bypass tenant or customer authorization boundaries.

### 9.5. Inventory Boundary Abstraction
- M07 **never** accesses `quantity_on_hand` or `quantity_reserved` directly.
- All inventory mutations strictly delegate to M06 `InventoryService`:
  - `reserveStock`: Atomic reservation on order creation.
  - `releaseStock`: Compensating release on checkout failure, or auto-release on order cancellation/expiration.
  - `consumeReserved`: Stock deduction on order fulfillment.
- Zero duplicated inventory business logic exists in `packages/orders`.

---

## 10. Verification & Quality Gates

| Quality Gate | Status | Details |
| :--- | :--- | :--- |
| **M07 Orders Tests** | **PASS** | **64/64 tests pass** across 9 test files (`@bintang/orders`) |
| **Monorepo Tests** | **PASS** | **272/272 tests pass** across all 19 workspace packages |
| **TypeScript Typecheck** | **PASS** | `turbo run typecheck` — 25/25 build & typecheck tasks clean |
| **ESLint** | **PASS** | 0 warnings, 0 errors (`npm run lint`) |
| **Prettier** | **PASS** | 100% compliant (`npm run format:check`) |
| **Turbo Build** | **PASS** | 19/19 packages build clean (`turbo run build`) |
| **Supabase DB Regression** | **PASS** | **39/39 tests pass** on live Supabase ref `nowyzlyruzlokiejvtne` |
| **Static Secret Scan** | **PASS** | 0 credentials / API keys detected in repository |
| **M02 Schema Stability** | **STABLE**| 0 migrations created; composite foreign keys and RLS intact |
| **Working Tree Safety** | **SAFE** | Working directory contains only M07 files; no commits or pushes |

---

## 11. Test Breakdown in `@bintang/orders`

| Test Suite File | Test Count | Focus Area |
| :--- | :---: | :--- |
| [`creation.test.ts`](file:///c:/BOT_WEB\Bintang-Tech-Project/packages/orders/tests/creation.test.ts) | 9 | Order creation, quantities, multi-item totals, inactive product rejection |
| [`snapshot.test.ts`](file:///c:/BOT_WEB\Bintang-Tech-Project/packages/orders/tests/snapshot.test.ts) | 2 | Historical price and product name immutability over time |
| [`inventory-integration.test.ts`](file:///c:/BOT_WEB\Bintang-Tech-Project/packages/orders/tests/inventory-integration.test.ts) | 8 | Reservation, rollback on persistence failure, rollback failure visibility, fulfillment consumption |
| [`lifecycle.test.ts`](file:///c:/BOT_WEB\Bintang-Tech-Project/packages/orders/tests/lifecycle.test.ts) | 11 | Sequential transitions, PROCESSING/PAID cancellation, repository-level state enforcement |
| [`authorization.test.ts`](file:///c:/BOT_WEB\Bintang-Tech-Project/packages/orders/tests/authorization.test.ts) | 11 | OWNER/ADMIN/STAFF boundaries, customer access denial by ID and number, customerId spoofing defense |
| [`tenant-isolation.test.ts`](file:///c:/BOT_WEB\Bintang-Tech-Project/packages/orders/tests/tenant-isolation.test.ts) | 5 | Cross-tenant order lookup, cancellation rejection, catalog boundary |
| [`idempotency.test.ts`](file:///c:/BOT_WEB\Bintang-Tech-Project/packages/orders/tests/idempotency.test.ts) | 5 | Key replay, conflicting payload, actor scoping, concurrent same-key mutex, cross-store isolation |
| [`concurrency.test.ts`](file:///c:/BOT_WEB\Bintang-Tech-Project/packages/orders/tests/concurrency.test.ts) | 3 | Last-stock unit race, 15-user flash sale, state transition race |
| [`money.test.ts`](file:///c:/BOT_WEB\Bintang-Tech-Project/packages/orders/tests/money.test.ts) | 10 | Exact numeric string math, integer cents multiplication, rounding |
| **Total M07 Tests** | **64** | **100% PASS** |

---

## 12. Known Gaps & Architectural Boundaries

1. **Production PostgreSQL Transaction Adapter:**  
   The current persistence implementation uses `InMemoryOrderRepository`, `InMemoryCustomerRepository`, and `InMemoryIdempotencyRepository`. Live PostgreSQL adapters with multi-table database transactions (`BEGIN ... COMMIT` with row-level locks) are pending the production persistence phase.
2. **Customer Session Authentication Boundary:**  
   `CustomerContext` assumes upstream transport authentication. Customer session validation (e.g. OTP verification, JWT session, Telegram initData HMAC) must be enforced by edge routes before constructing `CustomerContext`.
3. **Paid Order Cancellation / Refunds:**  
   Direct self-service cancellation of a `PAID` order without merchant coordination is strictly rejected in M07 because financial refunding and payment gateway reversals belong to **M08 Payment Processing**.

---

## 13. Deliverables Inventory

```
packages/orders/
├── README.md                          # Orders module overview
├── package.json                       # Package manifest & dependencies
├── tsconfig.json                      # Strict compiler configuration
├── src/
│   ├── index.ts                       # Public barrel exports
│   ├── types.ts                       # Order, OrderItem, Customer, Statuses, DTOs
│   ├── errors.ts                      # Typed domain error classes
│   ├── money.ts                       # Cent-based financial arithmetic
│   ├── validation.ts                  # Quantities, state transitions, UUID & order number generator
│   ├── order-repository.ts            # OrderRepository contract
│   ├── customer-repository.ts         # CustomerRepository contract
│   ├── idempotency-repository.ts      # IdempotencyRepository contract
│   ├── memory-repository.ts           # Mutex-locked in-memory implementations with state machine enforcement
│   └── order-service.ts               # Tenant-scoped Order application service with in-flight idempotency mutex
└── tests/
    ├── creation.test.ts               # Order creation & line item calculations (9 tests)
    ├── snapshot.test.ts               # Product price & name historical immutability (2 tests)
    ├── inventory-integration.test.ts  # Reservation, rollback & fulfillment consumption (8 tests)
    ├── lifecycle.test.ts              # State transitions, cancellation & repo enforcement (11 tests)
    ├── authorization.test.ts          # Seller roles, customer boundaries & spoofing defense (11 tests)
    ├── tenant-isolation.test.ts       # Cross-tenant access rejection (5 tests)
    ├── idempotency.test.ts            # Replays, conflicts, actor/store scoping, concurrent mutex (5 tests)
    ├── concurrency.test.ts            # Last-stock race & flash-sale stress (3 tests)
    └── money.test.ts                  # Financial math verification (10 tests)
```

# Milestone M06 Implementation Report — Inventory Foundation

**Date:** 2026-10-07  
**Milestone:** M06 — Inventory Foundation  
**Repository:** Nuruzz07/bintang-tech-studio  
**Branch:** `main`  
**Latest Git Commit:** `3090eeb` (`feat: implement M04 authorization foundation`)  
**Target Supabase Project:** Bintang Tech Studio (`nowyzlyruzlokiejvtne`)  
**Scope Classification:** Domain & Service Foundation  

---

## 1. Executive Summary

Milestone M06 builds the production-grade **Inventory Foundation** for Bintang Tech Studio as a **Domain & Service Foundation**. Designed as a modular monolith package (`@bintang/inventory`), it establishes mathematical invariants for finite physical stock, multi-mode availability (`TRACKED` vs `UNLIMITED`), concurrency-safe mutex locks simulating PostgreSQL row-level locks, two-phase reservation/consumption semantics (`consumeReserved` vs `consumeAvailable`), individual digital credential item tracking (`inventory_items`), and tenant-isolated authorization driven by M03 Tenancy and M04 Authorization.

All pre-existing milestones (M01 Monorepo, M02 Database, M03 Tenancy, M04 Authorization, and M05 Catalog in working directory) are fully preserved. Zero database migrations were required because the M02 database baseline already provisioned production-ready `public.inventory` and `public.inventory_items` tables with composite foreign keys and strict RLS policies.

---

## 2. Invariants & Mathematical Rules

The inventory engine enforces three core invariants at both domain validation and repository execution levels:

$$\text{quantity\_on\_hand} \ge 0$$
$$\text{quantity\_reserved} \ge 0$$
$$\text{quantity\_reserved} \le \text{quantity\_on\_hand}$$

Available stock is strictly calculated as:

$$\text{available} = \text{quantity\_on\_hand} - \text{quantity\_reserved}$$

Any operation that would cause $\text{quantity\_on\_hand} < 0$ or $\text{quantity\_reserved} < 0$ throws `NegativeStockError`. Any operation attempting to increase $\text{quantity\_reserved} > \text{quantity\_on\_hand}$ throws `InventoryInvariantError`. Quantities that are non-finite, NaN, or non-integer throw `InvalidQuantityError`.

---

## 3. Stock Mode Semantics

| Stock Mode | Behavior | Availability Computation | Mutation Rules |
| :--- | :--- | :--- | :--- |
| **`TRACKED`** | Finite physical stock counted unit-by-unit | $\max(0, \text{on\_hand} - \text{reserved})$ | Adjustments allowed; Reservations increment `quantity_reserved`; Consumptions decrement `quantity_on_hand`. |
| **`UNLIMITED`** | Infinite/service availability (e.g. digital keys generated on-demand, subscriptions) | $\infty$ (`Number.POSITIVE_INFINITY`), `isAvailable: true` | Stock adjustments (`INCREASE`, `DECREASE`, `SET`) are prohibited and throw `UnsupportedStockModeError`; Reservations and Consumptions succeed trivially without depleting finite stock. |

---

## 4. Atomic Mutation Semantics

### 4.1. Stock Adjustments (`adjustStock`)
Used for inventory restocks, cycle counts, write-offs, and physical audits:
- **`INCREASE`**: $\text{quantity\_on\_hand} \leftarrow \text{quantity\_on\_hand} + \Delta$
- **`DECREASE`**: $\text{quantity\_on\_hand} \leftarrow \text{quantity\_on\_hand} - \Delta$. Rejected if $\text{new\_on\_hand} < \text{quantity\_reserved}$ or $\text{new\_on\_hand} < 0$.
- **`SET`**: $\text{quantity\_on\_hand} \leftarrow \text{quantity}$. Rejected if $\text{quantity} < \text{quantity\_reserved}$ or $\text{quantity} < 0$.

### 4.2. Reservations (`reserveStock` & `releaseStock`)
Used during checkout hold windows:
- **`reserveStock`**: Verifies $\text{available} \ge \text{amount}$. Increments $\text{quantity\_reserved}$ by $\text{amount}$. Does not deduct $\text{quantity\_on\_hand}$.
- **`releaseStock`**: Verifies $\text{amount} \le \text{quantity\_reserved}$. Decrements $\text{quantity\_reserved}$ by $\text{amount}$. Releasing more than currently reserved throws `InvalidReservationError`.

### 4.3. Consumptions (`consumeReserved` vs `consumeAvailable`)
Used during payment fulfillment or point-of-sale checkout:
- **`consumeReserved`**: Fulfills a pre-existing reservation. Decrements **both** $\text{quantity\_reserved}$ and $\text{quantity\_on\_hand}$ by $\text{amount}$. Fails with `InsufficientStockError` if $\text{amount} > \text{quantity\_reserved}$.
- **`consumeAvailable`**: Direct instantaneous purchase without prior reservation. Decrements $\text{quantity\_on\_hand}$ by $\text{amount}$ directly, leaving $\text{quantity\_reserved}$ untouched. Fails with `InsufficientStockError` if $\text{amount} > \text{available}$.

---

## 5. Digital Credential Items (`inventory_items`)

For unique serialized digital credentials (e.g., license keys, account credentials, prepaid voucher codes), the system supports the `InventoryItem` aggregate:
- **Statuses:** `AVAILABLE` $\rightarrow$ `RESERVED` $\rightarrow$ `ASSIGNED` (with terminal states `EXPIRED`, `INVALID`).
- **Secret References:** Secrets are referenced indirectly via reference tokens (`vault:secret:...`), ensuring unmasked secrets are never stored directly in domain records.
- **Order Tracking:** Captures `reserved_order_id`, `assigned_order_id`, `reserved_at`, `reserved_until`, and `assigned_at`.

---

## 6. Concurrency Safety & Mutex Locks

In-memory persistence (`InMemoryInventoryRepository`) implements an asynchronous per-item serialized mutex queue on key `${storeId}:${productId}`:
- Simulates PostgreSQL `SELECT ... FOR UPDATE` row locks.
- Concurrent requests for the same product line execute in strict serial sequence.
- Verified under flash-sale benchmark (25 simultaneous concurrent checkout requests competing for 10 units):
  - Exactly 10 requests succeeded.
  - Exactly 15 requests rejected with `InsufficientStockError`.
  - Zero double-allocations, zero race conditions, invariants perfectly preserved.

---

## 7. Store Authorization & Zero Client Trust

Inventory operations integrate with `@bintang/authorization` using canonical M04 permission gates:
- **`inventory.read`**: Reading stock levels, product availability, listing store inventory.
  - Allowed: `STORE_OWNER`, `STORE_ADMIN`, `STORE_STAFF`.
- **`inventory.update`**: Stock initialization, adjustments, reservations, releases, consumptions, and credential item management.
  - Allowed: `STORE_OWNER`, `STORE_ADMIN`.
  - **Denied:** `STORE_STAFF` (Throws `PermissionDeniedError`).
- **Context Boundary:** `StoreContext` from server authentication is the sole trust anchor. Client-supplied IDs never override context. Attempting to query or manipulate products belonging to another tenant throws `CrossTenantInventoryError`.

---

## 8. Verification & Quality Gates

| Gate | Status | Details |
| :--- | :--- | :--- |
| **M06 Package Tests** | **PASS** | 53/53 tests pass across 7 test files (`@bintang/inventory`) |
| **Monorepo Tests** | **PASS** | 208/208 tests pass across all packages (Shared, Tenancy, Auth, Commerce, Inventory) |
| **TypeScript Typecheck** | **PASS** | `turbo run typecheck` — 19/19 packages clean |
| **ESLint** | **PASS** | 0 warnings, 0 errors |
| **Prettier** | **PASS** | All files compliant (`format:check`) |
| **Turbo Build** | **PASS** | 19/19 packages build successfully |
| **Supabase DB Tests** | **PASS** | 39/39 regression tests pass on live Supabase ref `nowyzlyruzlokiejvtne` |
| **Secret Scan** | **PASS** | 0 credentials / API keys detected in codebase |
| **M02 Schema Stability** | **STABLE**| 0 migrations created; schema completely unchanged |
| **M05 Working Tree** | **INTACT** | M05 Catalog files untouched and unstaged |

---

## 9. Deliverables Inventory

```
packages/inventory/
├── README.md                          # Inventory module overview
├── package.json                       # Package manifest & dependencies
├── tsconfig.json                      # Strict TypeScript compiler options
├── src/
│   ├── index.ts                       # Public barrel exports
│   ├── types.ts                       # Inventory, InventoryItem, Adjust/Reserve/Consume contracts
│   ├── errors.ts                      # Domain-specific typed error classes
│   ├── validation.ts                  # Invariant checks & RFC4122 UUID generator
│   ├── inventory-repository.ts        # InventoryRepository interface contract
│   ├── inventory-item-repository.ts   # InventoryItemRepository interface contract
│   ├── memory-repository.ts           # Concurrency-safe in-memory implementations
│   └── inventory-service.ts           # Tenant-scoped Inventory application service
└── tests/
    ├── domain.test.ts                 # Invariants, modes, and adjustment tests (16 tests)
    ├── reservation.test.ts            # Atomic reserve & release semantics (7 tests)
    ├── consumption.test.ts            # consumeReserved vs consumeAvailable (6 tests)
    ├── authorization.test.ts          # M04 role & permission boundary checks (10 tests)
    ├── tenant-isolation.test.ts       # Cross-tenant access rejection tests (7 tests)
    ├── concurrency.test.ts            # Flash-sale mutex race-condition tests (3 tests)
    └── items.test.ts                  # Serialized digital credentials lifecycle (4 tests)
```

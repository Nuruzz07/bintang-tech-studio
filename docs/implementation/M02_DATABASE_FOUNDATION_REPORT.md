# BINTANG TECH STUDIO — M02 DATABASE FOUNDATION REPORT

**Milestone:** M02 — Database Foundation  
**Target Environment:** Supabase Cloud (`bintang tech studio`, Project Ref: `nowyzlyruzlokiejvtne`)  
**Database Engine:** PostgreSQL 17.11  
**Architecture Baseline:** Master Blueprint v3.0 / Architecture Freeze v1.0  
**Tenancy Pattern:** Shared Database + Shared Schema + Logical Tenancy (`store_id`) + Row Level Security (RLS)  
**Status:** PASS (Post-Review Hardened & Tested)

---

## 1. Executive Summary

Milestone **M02 — Database Foundation** establishes the canonical PostgreSQL database schema for Bintang Tech Studio in accordance with Master Blueprint v3.0 and Forensic Audit Phase 42.

Following the initial M02 review, four critical architectural enhancements were implemented via a sequential, non-destructive follow-up migration (`20261007142000_harden_cross_tenant_integrity_and_rls.sql`):

1. **Cross-Tenant Referential Integrity:** Enforced at the database engine level via **composite foreign keys** `(store_id, foreign_id) REFERENCES parent_table(store_id, id)` across all tenant relationships, plus cross-order fulfillment consistency checks.
2. **Store Owner Invariant:** Guaranteed atomicity and non-null active `STORE_OWNER` membership via database triggers (`trg_store_owner_provision`, `trg_protect_store_owner`, `trg_protect_store_owner_membership`). Direct owner mutation and owner membership deletion/demotion are strictly blocked.
3. **Customer Public Catalog RLS Hardening:** Eliminated anonymous access across all active stores. Replaced with explicit **Store Context** resolution (`public.get_current_request_store_id()`), strictly isolating public catalog queries to the requested store only.
4. **RLS `WITH CHECK` Hardening & Anti-Mutation Triggers:** Added explicit `WITH CHECK` clauses on all mutation policies to prevent tenant hopping. Attached `prevent_tenant_mutation` triggers across all 28 tenant tables to prohibit mutating `store_id`.

Automated database test suite in `database/tests/00001_schema_and_rls_tests.sql` executed against the live database: **39 of 39 test assertions passed (100%)** with zero cross-tenant leakage.

---

## 2. Target Project & Migration Tracking (Non-Secret)

| Attribute         | Verified Value                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| Project Name      | `bintang tech studio`                                                                                      |
| Project Reference | `nowyzlyruzlokiejvtne`                                                                                     |
| Organization      | `xuuitukkhyhdyjqvritb`                                                                                     |
| PostgreSQL Engine | `17.11`                                                                                                    |
| Status            | `ACTIVE_HEALTHY`                                                                                           |
| Migration 1       | `20261007133904_initial_schema.sql` (Initial 39 tables, RLS baseline)                                      |
| Migration 2       | `20261007142000_harden_cross_tenant_integrity_and_rls.sql` (Composite FKs, Owner Invariant, RLS hardening) |
| Migration Sync    | Both migrations 100% synchronized between local and remote                                                 |

---

## 3. Review Issues Found & Fixes Applied

### 3.1 Issue 1: Cross-Tenant Referential Integrity

- **Finding:** Single-column foreign keys (`REFERENCES categories(id)`) allowed an entity in Store A to reference a parent entity in Store B if not caught by application logic.
- **Fix Applied:**
  - Added `UNIQUE (store_id, id)` on all parent tenant tables.
  - Added direct `store_id` columns to `order_items`, `fulfillment_items`, and `invoice_items`.
  - Replaced single-column FKs with **composite foreign keys**:
    - `products(store_id, category_id) -> categories(store_id, id)`
    - `inventory(store_id, product_id) -> products(store_id, id)`
    - `inventory_items(store_id, product_id/inventory_id) -> products/inventory(store_id, id)`
    - `orders(store_id, customer_id/voucher_id) -> customers/vouchers(store_id, id)`
    - `order_items(store_id, order_id/product_id) -> orders/products(store_id, id)`
    - `voucher_redemptions(store_id, voucher_id/customer_id/order_id) -> vouchers/customers/orders(store_id, id)`
    - `payments(store_id, order_id/payment_account_id) -> orders/payment_accounts(store_id, id)`
    - `refunds(store_id, payment_id/order_id) -> payments/orders(store_id, id)`
    - `fulfillments(store_id, order_id) -> orders(store_id, id)`
    - `fulfillment_items(store_id, fulfillment_id/order_item_id/inventory_item_id) -> fulfillments/order_items/inventory_items(store_id, id)`
  - Added trigger `trg_fulfillment_item_order_match` ensuring `fulfillment_items.order_item_id` belongs to the exact same order being fulfilled.

### 3.2 Issue 2: Store Owner Invariant

- **Finding:** A store could theoretically exist without a matching active `STORE_OWNER` member in `store_members`, or have its owner deleted or mutated without atomic transaction control.
- **Fix Applied:**
  - Added `AFTER INSERT` trigger `trg_store_owner_provision` on `stores` to automatically provision an active `STORE_OWNER` membership upon store creation.
  - Added `BEFORE UPDATE` trigger `trg_protect_store_owner` on `stores` blocking direct modification of `owner_user_id`.
  - Added `BEFORE UPDATE OR DELETE` trigger `trg_protect_store_owner_membership` on `store_members` disallowing deletion or demotion of an active store owner.

### 3.3 Issue 3: Customer Public Catalog RLS Hardening

- **Finding:** Policies on `categories`, `products`, and `vouchers` allowed anonymous users to query data from `ALL` active stores on the platform.
- **Fix Applied:**
  - Created `public.get_current_request_store_id()` reading `app.current_store_id` (session setting), `x-store-id` (HTTP header), or `store_id` (JWT claim).
  - Created `public.is_store_active(lookup_store_id)` (`SECURITY DEFINER`) to inspect store status without permission recursion.
  - Rewrote public catalog policies: an anonymous visitor can **only** query the catalog of the specific active store requested in the context. If no store context is provided, 0 rows are returned.

### 3.4 Issue 4: RLS `WITH CHECK` Hardening & Anti-Mutation Triggers

- **Finding:** Mutation policies (`FOR ALL`, `FOR UPDATE`) without explicit `WITH CHECK` could permit updating fields in ways that violate isolation.
- **Fix Applied:**
  - Re-authored all mutation policies on `stores`, `store_members`, `categories`, `products`, `inventory`, `inventory_items`, `customers`, `orders`, `order_items`, `vouchers`, `payment_accounts`, `fulfillments`, `fulfillment_items`, `store_channels`, and `bots` with explicit `WITH CHECK (store_id IN (SELECT public.get_current_user_store_ids()) ...)`.
  - Created `prevent_tenant_mutation` trigger and attached it `BEFORE UPDATE` to all 28 tenant tables, guaranteeing that modifying `store_id` is unconditionally rejected at the engine level.

---

## 4. Comprehensive Automated Test Suite (39 Tests)

Test file: `database/tests/00001_schema_and_rls_tests.sql`  
Execution command: `npx.cmd supabase db query --linked -f database/tests/00001_schema_and_rls_tests.sql`

| ID  | Category          | Test Assertion                                                    | Result   | Verification Detail                                |
| --- | ----------------- | ----------------------------------------------------------------- | -------- | -------------------------------------------------- |
| 1   | `TRIGGERS`        | Auth user trigger creates profile automatically                   | **PASS** | Profiles auto-created via `handle_new_user()`      |
| 2   | `CONSTRAINTS`     | `inventory_quantity_on_hand_check` rejects negative stock         | **PASS** | Negative quantity rejected                         |
| 3   | `CONSTRAINTS`     | `chk_inventory_reserved_lte_on_hand` rejects `reserved > on_hand` | **PASS** | Over-reservation rejected                          |
| 4   | `CONSTRAINTS`     | Valid inventory (`reserved <= on_hand`) succeeds                  | **PASS** | Valid inventory recorded                           |
| 5   | `CONSTRAINTS`     | `uq_vouchers_store_code` rejects duplicate code in same store     | **PASS** | Duplicate voucher code rejected                    |
| 6   | `CONSTRAINTS`     | Same voucher code in different store is permitted                 | **PASS** | Cross-store voucher code permitted                 |
| 7   | `CONSTRAINTS`     | `vouchers_discount_value_check` rejects `discount_value <= 0`     | **PASS** | Zero discount value rejected                       |
| 8   | `INDEXES`         | `uq_customers_store_telegram` rejects duplicate Telegram ID       | **PASS** | Duplicate Telegram ID rejected                     |
| 9   | `INDEXES`         | Partial index allows multiple `NULL` Telegram IDs                 | **PASS** | Multiple `NULL`s permitted                         |
| 10  | `INDEXES`         | `uq_customers_store_whatsapp` rejects duplicate WhatsApp          | **PASS** | Duplicate WhatsApp rejected                        |
| 11  | `CONSTRAINTS`     | `uq_orders_store_order_number` rejects duplicate order number     | **PASS** | Duplicate order number rejected                    |
| 12  | `CONSTRAINTS`     | Same order number in different store is permitted                 | **PASS** | Cross-store order number permitted                 |
| 13  | `CONSTRAINTS`     | `orders_grand_total_check` rejects negative `grand_total`         | **PASS** | Negative `grand_total` rejected                    |
| 14  | `CONSTRAINTS`     | `payments_amount_check` rejects `amount <= 0`                     | **PASS** | Zero payment amount rejected                       |
| 15  | `CONSTRAINTS`     | `uq_payment_events_provider_event` rejects duplicate webhook      | **PASS** | Duplicate webhook event rejected                   |
| 16  | `CONSTRAINTS`     | Same event ID with different provider is permitted                | **PASS** | Different provider event permitted                 |
| 17  | `CROSS_TENANT`    | Cross-store category/product relationship is rejected             | **PASS** | Blocked via `fk_products_store_category`           |
| 18  | `CROSS_TENANT`    | Cross-store product/inventory relationship is rejected            | **PASS** | Blocked via `fk_inventory_store_product`           |
| 19  | `CROSS_TENANT`    | Cross-store customer/order relationship is rejected               | **PASS** | Blocked via `fk_orders_store_customer`             |
| 20  | `CROSS_TENANT`    | Cross-store voucher redemption is rejected                        | **PASS** | Blocked via `fk_voucher_redemptions_store_voucher` |
| 21  | `CROSS_TENANT`    | Cross-store payment/order relationship is rejected                | **PASS** | Blocked via `fk_payments_store_order`              |
| 22  | `CROSS_TENANT`    | Cross-store fulfillment/order relationship is rejected            | **PASS** | Blocked via `fk_fulfillments_store_order`          |
| 23  | `CROSS_TENANT`    | Cross-order fulfillment item relationship is rejected             | **PASS** | Blocked via `check_fulfillment_item_order_match`   |
| 24  | `OWNER_INVARIANT` | Store creation auto-provisions active STORE_OWNER                 | **PASS** | Auto-provisioned by `handle_store_owner_provision` |
| 25  | `OWNER_INVARIANT` | Deleting active STORE_OWNER membership is rejected                | **PASS** | Blocked by `protect_store_owner_membership`        |
| 26  | `OWNER_INVARIANT` | Demoting active STORE_OWNER membership is rejected                | **PASS** | Blocked by `protect_store_owner_membership`        |
| 27  | `OWNER_INVARIANT` | Direct mutation of store owner_user_id is rejected                | **PASS** | Blocked by `protect_store_owner_immutable`         |
| 28  | `ANTI_MUTATION`   | Tenant mutation (`store_id` change) on products is rejected       | **PASS** | Blocked by `prevent_tenant_mutation`               |
| 29  | `ANTI_MUTATION`   | Tenant mutation (`store_id` change) on orders is rejected         | **PASS** | Blocked by `prevent_tenant_mutation`               |
| 30  | `RLS_HELPERS`     | `get_current_user_store_ids` returns Store A for User A           | **PASS** | Returned: `{a1111111-1111-1111-1111-111111111111}` |
| 31  | `RLS_HELPERS`     | `get_current_user_store_ids` returns Store B for User B           | **PASS** | Returned: `{b2222222-2222-2222-2222-222222222222}` |
| 32  | `RLS_HELPERS`     | `is_store_member` returns `TRUE` for member of Store A            | **PASS** | Member verified                                    |
| 33  | `RLS_HELPERS`     | `is_store_member` returns `FALSE` for non-member of Store B       | **PASS** | Cross-tenant access prevented                      |
| 34  | `RLS_HELPERS`     | `get_store_member_role` returns `STORE_OWNER` for User A          | **PASS** | Role: `STORE_OWNER`                                |
| 35  | `RLS_HELPERS`     | `get_store_member_role` returns `STORE_STAFF` for Staff C         | **PASS** | Role: `STORE_STAFF`                                |
| 36  | `RLS_MEMBER`      | Authenticated User A sees only Store A data under RLS             | **PASS** | Products: 1, Orders: 1                             |
| 37  | `RLS_MEMBER`      | Authenticated User B sees only Store B data under RLS             | **PASS** | Products: 1, Orders: 1 (Zero Store A leak)         |
| 38  | `PUBLIC_CATALOG`  | Anonymous visitor without store context sees 0 products           | **PASS** | All-active-stores scraping prevented               |
| 39  | `PUBLIC_CATALOG`  | Anonymous visitor querying Store A sees ONLY Store A              | **PASS** | Returned 1 Store A product (Zero Store B leak)     |

- **Total Tests:** 39
- **Passed:** 39 (100%)
- **Failed:** 0 (0%)
- **Post-Test Database State:** Pristine (Stores: 0, Profiles: 0, Products: 0, Orders: 0).

---

## 5. Monorepo Regression Gate Results

| Check                   | Command                | Status   | Details                                    |
| ----------------------- | ---------------------- | -------- | ------------------------------------------ |
| **Prettier Formatting** | `npm run format:check` | **PASS** | All matched files use Prettier style       |
| **ESLint**              | `npm run lint`         | **PASS** | 0 errors, 0 warnings across all workspaces |
| **TypeScript**          | `npm run typecheck`    | **PASS** | 20 tasks successful (Turborepo FULL TURBO) |
| **Vitest Tests**        | `npm run test`         | **PASS** | 20 tasks successful, 18 unit tests passed  |
| **Monorepo Build**      | `npm run build`        | **PASS** | 19 tasks successful (Turborepo FULL TURBO) |

---

## 6. Git Status & Safety Audit

- **Zero commits made** (ready for user review).
- **Zero pushes made**.
- **No secrets in code or logs**.
- **Existing Bintang Store production, Vercel, VPS, and external services remain untouched**.

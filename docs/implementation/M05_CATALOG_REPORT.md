# BINTANG TECH STUDIO — M05 CATALOG FOUNDATION REPORT

**Milestone:** M05 — Catalog Foundation  
**Package:** `@bintang/commerce` (`packages/commerce`)  
**Target Environment:** Supabase Cloud (`bintang tech studio`, Project Ref: `nowyzlyruzlokiejvtne`)  
**Architecture Baseline:** Master Blueprint v3.0 / Architecture Freeze v1.0  
**Implementation Classification:** **Domain & Service Foundation** (Modular-Monolith; Decoupled Repository Abstraction; M04 Authorization & Entitlement Integration)  
**Status:** PASS (Category & Product Domain, Tenant Isolation, Lifecycles, RBAC & Entitlement Quota Verified; 0 Database Migrations)

---

## 1. Scope & Objectives

Milestone **M05 — Catalog Foundation** establishes the authoritative production-oriented foundation for products, categories, catalog domain rules, tenant isolation, store-scoped authorization, subscription entitlement limits, and lifecycle states for Bintang Tech Studio in accordance with Master Blueprint v3.0.

### In Scope
1. **Category Domain:** Full entity modeling, lifecycle states (`ACTIVE`, `INACTIVE`, `ARCHIVED`), validation, per-store slug uniqueness, and sorting.
2. **Product Domain:** Full entity modeling, classification (`productType`, `stockMode`), lifecycle states (`DRAFT`, `ACTIVE`, `INACTIVE`, `ARCHIVED`), authoritative money representation (`NUMERIC(15,2)`), and per-store slug uniqueness.
3. **Category ↔ Product Tenant Integrity:** Strict invariant enforcement preventing cross-tenant category assignment (`product.store_id = category.store_id`).
4. **Tenant Isolation:** Mandatory `AuthenticatedStoreContext` consuming pipeline; zero trust in client-provided `store_id`.
5. **M04 Authorization Integration:** Enforcement of role permissions (`STORE_OWNER`, `STORE_ADMIN`, `STORE_STAFF`) via `AuthorizationService`.
6. **Entitlement Integration:** Enforcement of plan quota limits (`products.max = 20` on Starter) with additive add-on support.
7. **Repository Contracts & In-Memory Adapters:** High-fidelity tenant-scoped repository abstraction (`CategoryRepository`, `ProductRepository`, `InMemoryCategoryRepository`, `InMemoryProductRepository`).
8. **Catalog Services:** Dedicated `CategoryService`, `ProductService`, and unified facade `CatalogService`.
9. **Comprehensive Verification:** 46 M05 test assertions covering CRUD, validation, security, RBAC, quotas, concurrency, and relational integrity.
10. **Zero Regression:** 100% pass on M01, M02 (39/39 DB tests on Supabase), M03 (62 tests), and M04 (32 tests).

### Explicitly Out of Scope
- Inventory business logic, stock reservation, and quantity mutations (`quantity_on_hand`, `quantity_reserved`) — reserved for M06.
- Orders, Checkout, Cart calculations, Payments, Refunds, and Fulfillments — reserved for M07–M09.
- Telegram Bot Engine and WhatsApp channels — reserved for M11.
- Seller Dashboard UI, Customer Store Mini App, and Owner Console — reserved for M10, M12, M14.
- Automated migration or data import of legacy 36 products / 8 categories from Template 01 — reserved for M10.

---

## 2. Architecture & Boundary Alignment

The Catalog foundation operates within the modular-monolith architecture as `@bintang/commerce`:
- **Domain-Driven Design (DDD):** Domain rules, lifecycle transitions, and invariants are encapsulated within domain entities and services, completely decoupled from controllers or transport layers.
- **Dependency Flow:**
  $$\text{Request} \rightarrow \text{Auth/StoreContext (M03)} \rightarrow \text{AuthorizationService (M04)} \rightarrow \text{EntitlementResolver (M04)} \rightarrow \text{CatalogService (M05)} \rightarrow \text{Repository Abstraction}$$
- **Zero Client Trust:** Parameter spoofing (such as injecting `store_id` into request bodies, URLs, or query headers) is completely disregarded. The sole authoritative source of tenant boundary is the verified server-side `AuthenticatedStoreContext`.
- **Soft-Delete Lifecycle:** Destructive `DELETE FROM products` operations are disallowed by default. Catalog deletion requests via `products.delete` permission execute a soft-delete transition to `ARCHIVED` status.

---

## 3. Files Created / Modified

### Modified Files
- `packages/commerce/package.json`: Configured package metadata, module exports, build/typecheck/lint/test scripts, and workspace dependencies (`@bintang/shared`, `@bintang/tenancy`, `@bintang/authorization`, `@bintang/observability`).
- `.prettierignore`: Added `docs/implementation/*.md` to ensure historical milestone reports remain 100% bitwise stable across Prettier runs.

### Newly Created Files
- `packages/commerce/tsconfig.json`: TypeScript strict compiler configuration extending monorepo base.
- `packages/commerce/src/types.ts`: Canonical domain types for Category, Product, Enums (`ProductType`, `StockMode`, `ProductStatus`, `CategoryStatus`), inputs, and filters.
- `packages/commerce/src/errors.ts`: Typed domain error hierarchy (`CategoryNotFoundError`, `ProductNotFoundError`, `DuplicateCategorySlugError`, `DuplicateProductSlugError`, `CrossTenantCategoryError`, `InvalidProductDataError`, `InvalidCategoryDataError`, `InvalidStateTransitionError`, `ProductQuotaExceededError`).
- `packages/commerce/src/money.ts`: Authoritative financial money normalization and comparison utilities (`NUMERIC(15,2)` 2-decimal string format).
- `packages/commerce/src/validation.ts`: Input validation routines, RFC4122 v4 UUID generator, kebab-case slug validator/generator, and lifecycle state transition verifiers.
- `packages/commerce/src/category-repository.ts`: Tenant-scoped `CategoryRepository` interface contract.
- `packages/commerce/src/product-repository.ts`: Tenant-scoped `ProductRepository` interface contract.
- `packages/commerce/src/memory-repository.ts`: In-memory implementations (`InMemoryCategoryRepository`, `InMemoryProductRepository`) with synchronous atomic slug locking and tenant isolation.
- `packages/commerce/src/category-service.ts`: Tenant-scoped `CategoryService` enforcing RBAC authorization, validation, and lifecycle.
- `packages/commerce/src/product-service.ts`: Tenant-scoped `ProductService` enforcing RBAC authorization, entitlement limits, cross-tenant category validation, and soft-delete archive semantics.
- `packages/commerce/src/catalog-service.ts`: Unified `CatalogService` facade.
- `packages/commerce/src/index.ts`: Barrel export file.
- `packages/commerce/tests/category-domain.test.ts`: 10 test assertions (Tests 1–8+).
- `packages/commerce/tests/product-domain.test.ts`: 15 test assertions (Tests 9–21+).
- `packages/commerce/tests/authorization.test.ts`: 7 test assertions (Tests 22–28).
- `packages/commerce/tests/entitlement.test.ts`: 5 test assertions (Tests 29–33).
- `packages/commerce/tests/security.test.ts`: 5 test assertions (Tests 34–38).
- `packages/commerce/tests/concurrency-integrity.test.ts`: 4 test assertions (Tests 39–40+).
- `docs/implementation/M05_CATALOG_REPORT.md`: This comprehensive implementation report.

---

## 4. Domain Models & Lifecycle Semantics

### Category Model
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` (UUID) | Unique entity identifier |
| `storeId` | `string` (UUID) | Immutable tenant owner boundary |
| `name` | `string` | Human-readable name (1..100 characters) |
| `slug` | `string` | Lowercase kebab-case slug, unique per store |
| `description`| `string \| null` | Optional category overview |
| `sortOrder` | `number` | Non-negative integer for merchant display sorting |
| `status` | `CategoryStatus` | `ACTIVE`, `INACTIVE`, `ARCHIVED` |
| `metadata` | `Record<string, unknown>` | JSON-safe extensible metadata |
| `createdAt` | `string` (ISO) | Creation timestamp |
| `updatedAt` | `string` (ISO) | Last modification timestamp |

**Category Lifecycle Transitions:**
- `ACTIVE` $\leftrightarrow$ `INACTIVE`: Toggling category visibility.
- `ACTIVE` / `INACTIVE` $\rightarrow$ `ARCHIVED`: Soft-deletion.
- `ARCHIVED` $\rightarrow$ Any: Blocked. Archived categories are terminal and cannot be reactivated.
- **Relational Invariant:** When a category is archived or inactive, existing products referencing it retain their `categoryId` for audit continuity. Assigning an archived category to a *new* or *updated* product is strictly prohibited.

### Product Model
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` (UUID) | Unique entity identifier |
| `storeId` | `string` (UUID) | Immutable tenant owner boundary |
| `categoryId` | `string \| null` | Category reference (must belong to same store) |
| `name` | `string` | Product title (1..200 characters) |
| `slug` | `string` | Lowercase kebab-case slug, unique per store |
| `description`| `string \| null` | Optional product description |
| `productType`| `ProductType` | `DIGITAL`, `SERVICE`, `PHYSICAL` |
| `price` | `string` | Authoritative `NUMERIC(15,2)` string (e.g. `"50000.00"`) |
| `compareAtPrice` | `string \| null` | Optional strikethrough price ($\ge 0$) |
| `stockMode` | `StockMode` | `UNLIMITED`, `TRACKED` (catalog classification only) |
| `status` | `ProductStatus` | `DRAFT`, `ACTIVE`, `INACTIVE`, `ARCHIVED` |
| `metadata` | `Record<string, unknown>` | JSON-safe extensible metadata |
| `createdAt` | `string` (ISO) | Creation timestamp |
| `updatedAt` | `string` (ISO) | Last modification timestamp |

**Product Lifecycle Transitions:**
- `DRAFT` $\rightarrow$ `ACTIVE`, `INACTIVE`, `ARCHIVED`
- `ACTIVE` $\leftrightarrow$ `INACTIVE`
- `ACTIVE` / `INACTIVE` $\rightarrow$ `ARCHIVED`: Default delete behavior (`archiveProduct`). Hard DELETE is disallowed.
- `ARCHIVED` $\rightarrow$ Any: Blocked. Archived products are permanently retired from the active catalog.

---

## 5. Repository Design & Tenant-Scoped Contract

Both `CategoryRepository` and `ProductRepository` mandate `storeId` as an explicit parameter on all operations:
- `create(storeId, entity)`
- `findById(storeId, id)`
- `findBySlug(storeId, slug)`
- `list(storeId, filter)`
- `update(storeId, id, data)`
- `archive(storeId, id)`
- `countProducts(storeId, filter)`
- `countProductsByCategoryId(storeId, categoryId)`

No unscoped query method exists. Passing an entity with mismatched `storeId` triggers immediate failure.

---

## 6. M04 Authorization Integration

All catalog operations delegate permission enforcement to `AuthorizationService` (`@bintang/authorization`):
- `createCategory`: Requires `products.create`
- `getCategoryById` / `getCategoryBySlug` / `listCategories`: Requires `products.read`
- `updateCategory` / `activateCategory` / `deactivateCategory`: Requires `products.update`
- `archiveCategory`: Requires `products.delete`
- `createProduct`: Requires `products.create`
- `getProductById` / `getProductBySlug` / `listProducts` / `countProducts`: Requires `products.read`
- `updateProduct` / `activateProduct` / `deactivateProduct`: Requires `products.update`
- `archiveProduct`: Requires `products.delete`

**Role Enforcement Summary:**
- `STORE_OWNER`: Permitted for all catalog actions.
- `STORE_ADMIN`: Permitted for all catalog actions.
- `STORE_STAFF`: Permitted for `products.read` ONLY. Creation, mutation, and archiving are rejected (`PermissionDeniedError`).
- Unauthenticated or non-store roles: Rejected (`UnauthenticatedError` / `AuthorizationError`).

---

## 7. Entitlement & Quota Integration

Product creation enforces the store's active subscription entitlement limit (`products.max`):
- **Base Plan (Starter):** `products.max = 20`.
- **Pre-flight Quota Check:** Active (non-archived) products are counted prior to creation. If `currentCount >= limit`, action is denied with `EntitlementDeniedError` / `ProductQuotaExceededError`.
- **Add-on Extensions:** Active add-ons additively increase the effective limit (e.g., $+50$ products yields limit $70$).
- **Downgrade Safety:** Downgrading a subscription or removing add-ons **never** deletes existing products. Existing products remain fully accessible, but new product creation is blocked until active count falls below the new limit.

---

## 8. Tenant Isolation & Security Invariants

1. **Per-Store Slug Uniqueness:**
   - Slugs are unique per tenant: `UNIQUE(store_id, slug)`.
   - Store A having slug `mobile-legends` and Store B having slug `mobile-legends` is completely permitted.
   - Duplicate slug within Store A is rejected (`DuplicateSlugError`).
2. **Category ↔ Product Tenant Integrity:**
   - Attempting to attach Category B (owned by Store B) to Product A (owned by Store A) is rejected (`CrossTenantCategoryError`).
   - Database layer composite foreign key `fk_products_store_category` (`FOREIGN KEY (store_id, category_id) REFERENCES public.categories(store_id, id)`) serves as the definitive database defense.
3. **No Cross-Tenant Information Leaks:**
   - Querying a product or category belonging to another tenant returns `NotFoundError`. The system never reveals whether an ID or slug exists in another tenant's store.

---

## 9. Status Database & Migrations

- **Database Migrations Added in M05:** **0** (Nol migrasi baru).
- **PostgreSQL Baseline:** M02 schema (`20261007133904_initial_schema.sql` and `20261007142000_harden_cross_tenant_integrity_and_rls.sql`) remains 100% intact.
- **Remote Regression Verification:** 39 dari 39 database test assertions pada Supabase Cloud (`nowyzlyruzlokiejvtne`) tetap **PASS (100%)**.

---

## 10. Verification Results & Quality Gates

### A. Test Suite M05 (`@bintang/commerce`)
Menjalankan `vitest run` pada package `@bintang/commerce`: **46 dari 46 tests PASS (100%)**.

| Test File | Tests | Status | Cakupan |
| :--- | :---: | :---: | :--- |
| `tests/category-domain.test.ts` | 10 | PASS | Tests 1–8+: CRUD category, per-store slug uniqueness, cross-tenant denial, immutability, lifecycle |
| `tests/product-domain.test.ts` | 15 | PASS | Tests 9–21+: CRUD product, classification, money formatting, slug format, cross-store slugs, cross-tenant category rejection |
| `tests/authorization.test.ts` | 7 | PASS | Tests 22–28: STORE_OWNER, STORE_ADMIN, STORE_STAFF rejection, unauthenticated denial, platform bypass defense |
| `tests/entitlement.test.ts` | 5 | PASS | Tests 29–33: Starter 19/20, Starter 20/20 denial, add-on extension, downgrade no-delete, over-limit blocking |
| `tests/security.test.ts` | 5 | PASS | Tests 34–38: Spoofed store_id ignored, cross-tenant ID lookup denial, repo bypass prevention, zero catalog leakage |
| `tests/concurrency-integrity.test.ts` | 4 | PASS | Tests 39–40+: Atomic concurrent slug collision rejection, category-product sorting and relational integrity, money |
| **Total M05 Tests** | **46** | **PASS** | **100% Pass Rate** |

### B. Regresi Milestones Sebelumnya (Monorepo)
- `@bintang/authorization` (M04): **32 dari 32 tests PASS (100%)**
- `@bintang/tenancy` (M03): **62 dari 62 tests PASS (100%)**
- `@bintang/shared` (M01): **12 dari 12 tests PASS (100%)**
- `@bintang/observability` (M01): **3 dari 3 tests PASS (100%)**
- **Total Unit & Integration Tests Monorepo:** **155 tests PASS (100%)**

### C. Regresi Database PostgreSQL (M02)
- Linked Supabase Database (`nowyzlyruzlokiejvtne`): **39 dari 39 database tests PASS (100%)**

### D. Monorepo Quality Gates (Turborepo)
- **Format Check (`npm run format:check`):** PASS (0 violations)
- **Linter (`npm run lint`):** PASS (0 errors, 0 warnings)
- **Typecheck (`npm run typecheck`):** PASS (23/23 tasks successful)
- **Build (`npm run build`):** PASS (19/19 packages built)
- **Static Secret Scan:** PASS (0 secrets or credentials detected)

---

## 11. Known Gaps & Future Roadmap

1. **PostgreSQL Adapter Integration (TBD di fase persistensi live):**
   - Repository kontrak saat ini diuji menggunakan in-memory repository dengan penguncian atomik in-flight. Pemasangan adapter PostgreSQL/Supabase live (`PostgresCategoryRepository`, `PostgresProductRepository`) akan dihubungkan saat application services (`services/api`) diaktifkan.
2. **Category Columns di PostgreSQL:**
   - Tabel `public.categories` di M02 memiliki kolom `id, store_id, name, slug, description, metadata, created_at, updated_at`. Kolom `sort_order` dan `status` saat ini dipertahankan pada tingkat domain dan metadata. Migrasi penambahan kolom eksplisit dapat dilakukan secara non-destruktif bila diperlukan oleh query SQL langsung.
3. **Template 01 Seed Data (M10):**
   - 36 produk dan 8 kategori dari Template 01 belum diimpor ke database baru. Import tersebut akan dilakukan pada Milestone M10 (Customer Store Migration).

---

## 12. Current Git Status

```text
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   .prettierignore
	modified:   packages/commerce/package.json

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	docs/implementation/M05_CATALOG_REPORT.md
	packages/commerce/src/
	packages/commerce/tests/
	packages/commerce/tsconfig.json

no changes added to commit (use "git add" and/or "git commit -a")
```

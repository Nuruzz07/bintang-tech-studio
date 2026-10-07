# BINTANG TECH STUDIO — M04 AUTHORIZATION IMPLEMENTATION REPORT

**Milestone:** M04 — Authorization Foundation (Domain & Service Foundation)  
**Package:** `@bintang/authorization` (`packages/authorization`)  
**Target Environment:** Supabase Cloud (`bintang tech studio`, Project Ref: `nowyzlyruzlokiejvtne`)  
**Architecture Baseline:** Master Blueprint v3.0 / Architecture Freeze v1.0  
**Implementation Classification:** **Domain Logic & Service Foundation** (Decoupled from Database; In-Memory Policy & Entitlement Fixtures)  
**Status:** PASS (Domain, RBAC, Entitlement, and Cross-Tenant Security Matrix Verified; No DB Migrations)

---

## 1. Executive Summary & Classification

Milestone **M04 — Authorization Foundation** establishes the canonical Role-Based Access Control (RBAC), fine-grained permission model, tenant boundary enforcement, and feature entitlement foundation for Bintang Tech Studio in accordance with Master Blueprint v3.0.

### Klasifikasi Implementasi (Faktual & Transparan)
1. **Domain & Service Foundation:**
   - M04 diimplementasikan murni sebagai domain logic dan service foundation di dalam paket `@bintang/authorization`.
   - M04 **bukan** implementasi CRUD produk, pesanan, inventaris, pembayaran, atau bot.
   - M04 **tidak menambahkan client PostgreSQL/Supabase** dan tidak menyentuh database production.
2. **Prinsip Inti:**
   $$\text{Role} \neq \text{Permission} \neq \text{Entitlement}$$
   - **Role:** Identitas peran pengguna dalam tenant (`STORE_OWNER`, `STORE_ADMIN`, `STORE_STAFF`) atau platform (`PLATFORM_OWNER`, `PLATFORM_ADMIN`, `USER`).
   - **Permission:** Hak aksi atomik pada domain resource (`products.create`, `orders.update`, dll.).
   - **Entitlement:** Batasan atau kapabilitas fitur toko berdasarkan langganan/add-on (`products.max`, `channels.whatsapp`, dll.).
   - **Aturan Evaluasi:** Operasi diizinkan **HANYA JIKA** user memiliki Role yang berwenang (Permission) **DAN** toko memiliki hak akses fitur tersebut (Entitlement).
3. **Tenant-Aware Authorization Pipeline:**
   ```
   Request
     ↓
   Authentication (Supabase Auth / JWT)
     ↓
   User Profile (Active)
     ↓
   Store (Tenant ID)
     ↓
   Membership (Active StoreMember)
     ↓
   Role (StoreRole / PlatformRole)
     ↓
   Permission Evaluation (hasStorePermission)
     ↓
   Entitlement Evaluation (hasFeature / getLimit)
     ↓
   RLS (PostgreSQL engine level)
     ↓
   Business Validation
     ↓
   Execute
   ```
4. **Zero Client Trust:**
   - Client tidak pernah menjadi sumber kebenaran otorisasi.
   - Nilai `store_id` dari URL, query param, request body, atau header **tidak pernah** dipercaya sebagai bukti otorisasi. Otorisasi wajib mengonsumsi `AuthenticatedStoreContext` dari M03.

---

## 2. Inventory of Files Created / Modified

### Modified Files
- `packages/authorization/package.json`: Mengonfigurasi dependensi monorepo (`@bintang/shared`, `@bintang/tenancy`), build, typecheck, lint, dan test scripts.

### Newly Created Files
- `packages/authorization/tsconfig.json`: Konfigurasi TypeScript strict compiler yang meng-extend base monorepo tsconfig.
- `packages/authorization/src/permissions.ts`: Katalog izin kanonikal bertipe ketat untuk Store permissions dan Platform permissions beserta type guards (`isStorePermission`, `isPlatformPermission`, `isValidPermission`).
- `packages/authorization/src/policy.ts`: Matriks kebijakan peran terpusat (`STORE_ROLE_POLICY`, `PLATFORM_ROLE_POLICY`) dan evaluator izin (`hasStorePermission`, `hasPlatformPermission`).
- `packages/authorization/src/entitlements.ts`: Kontrak evaluasi entitlement (`EffectiveEntitlements`, `EntitlementResolver`) dan implementasi `InMemoryEntitlementResolver` yang menggabungkan base plan limits dan add-on extensions/overrides.
- `packages/authorization/src/errors.ts`: Typed domain errors (`AuthorizationError`, `PermissionDeniedError`, `EntitlementDeniedError`, `ScopeMismatchError`, `UnauthenticatedError`, `InvalidAuthorizationContextError`).
- `packages/authorization/src/decision.ts`: Kontrak keputusan otorisasi eksplisit (`AuthorizationDecision`, `DecisionReason`, factory helpers `allow()`, `deny()`).
- `packages/authorization/src/authorization-service.ts`: Service otorisasi terpusat (`authorizeStoreAction`, `authorizePlatformAction`, `assertAuthorizedStoreAction`, `assertAuthorizedPlatformAction`).
- `packages/authorization/src/index.ts`: Central export file untuk seluruh package `@bintang/authorization`.
- `packages/authorization/tests/permissions.test.ts`: 4 test assertions untuk validasi katalog permission dan type guard.
- `packages/authorization/tests/policy.test.ts`: 7 test assertions untuk matriks kebijakan peran store dan platform.
- `packages/authorization/tests/entitlements.test.ts`: 3 test assertions untuk kalkulasi effective entitlements dan add-on extensions.
- `packages/authorization/tests/store-authorization.test.ts`: 4 test assertions untuk evaluasi aksi store, konteks, dan penolakan peran.
- `packages/authorization/tests/platform-authorization.test.ts`: 6 test assertions untuk otorisasi platform dan pemisahan domain.
- `packages/authorization/tests/cross-tenant-security.test.ts`: 4 test assertions untuk pertahanan isolasi lintas-tenant dan penolakan scope mismatch.
- `packages/authorization/tests/role-vs-entitlement.test.ts`: 4 test assertions untuk pembuktian invariant $\text{Role} \neq \text{Permission} \neq \text{Entitlement}$ dan limit numerik.
- `docs/implementation/M04_AUTHORIZATION_REPORT.md`: Laporan resmi implementasi M04.

---

## 3. Permission Catalog

Katalog izin didefinisikan secara tersentralisasi pada [`packages/authorization/src/permissions.ts`](file:///c:/BOT_WEB/Bintang-Tech-Project/packages/authorization/src/permissions.ts):

### Store Permissions (31 Canonical Permissions)
- **Products:** `products.read`, `products.create`, `products.update`, `products.delete`
- **Inventory:** `inventory.read`, `inventory.update`
- **Orders:** `orders.read`, `orders.update`, `orders.cancel`, `orders.refund`
- **Customers:** `customers.read`, `customers.update`
- **Payments:** `payments.read`, `payments.manage`
- **Vouchers:** `vouchers.read`, `vouchers.manage`
- **Staff / Team:** `staff.read`, `staff.invite`, `staff.update`, `staff.remove`
- **Store Settings:** `store.settings.read`, `store.settings.update`
- **Analytics:** `analytics.read`
- **Channels:** `channels.read`, `channels.manage`
- **Fulfillment:** `fulfillment.read`, `fulfillment.process`, `fulfillment.complete`
- **Subscription:** `subscription.read`, `subscription.manage`

### Platform Permissions (8 Canonical Permissions)
- `platform.analytics.read`, `platform.stores.read`, `platform.stores.manage`, `platform.users.read`, `platform.users.manage`, `platform.templates.manage`, `platform.plans.manage`, `platform.system.manage`

---

## 4. Role Policy (Centralized Matrix)

Matriks kebijakan diatur secara terpusat pada [`packages/authorization/src/policy.ts`](file:///c:/BOT_WEB/Bintang-Tech-Project/packages/authorization/src/policy.ts):

| Peran | Cakupan Izin | Pengecualian / Pembatasan Kebijakan |
| :--- | :--- | :--- |
| **`STORE_OWNER`** | Seluruh 31 Store Permissions | Memiliki akses penuh terhadap manajemen toko dan langganan. Pemindahan kepemilikan bisnis (`owner transfer`) tetap bukan permission biasa melainkan dedicated RPC operation. |
| **`STORE_ADMIN`** | 30 Store Permissions | Memiliki wewenang operasional dan manajemen penuh toko, **kecuali** `subscription.manage` yang dicadangkan khusus untuk `STORE_OWNER` (kebijakan provisional M04). |
| **`STORE_STAFF`** | 9 Operational Store Permissions (`orders.read/update`, `customers.read`, `inventory.read`, `fulfillment.read/process/complete`, `products.read`, `vouchers.read`) | **Ditolak keras:** mutasi produk (`create/update/delete`), pembatalan/refund order, administrasi staf (`staff.*`), pengaturan toko (`store.settings.*`), analitik, channels, dan finansial. |
| **`PLATFORM_OWNER`** | Seluruh 8 Platform Permissions | Akses penuh terhadap infrastruktur SaaS, rencana harga, template global, dan manajemen toko lintas platform. |
| **`PLATFORM_ADMIN`** | 7 Platform Permissions | Akses manajemen toko, template, dan analitik; **ditolak:** `platform.system.manage` (dicadangkan khusus PLATFORM_OWNER). |
| **`USER`** | 0 Platform Permissions | Pengguna reguler tidak memiliki wewenang administratif platform apa pun. |

---

## 5. Entitlement Foundation & Evaluator

Rumus hak fitur toko:
$$\text{Base Plan} + \text{Add-on Extensions} = \text{Effective Entitlements}$$

1. **Numeric Limits:**
   - Batas numerik (misal: `products.max = 20`, `staff.max = 3`).
   - Add-on menambahkan batas secara aditif (misal: base 20 + addon 50 = 70).
   - Evaluator memeriksa batas saat ini terhadap kuota aktif toko.
2. **Feature Flags / Booleans:**
   - Fitur boolean (misal: `channels.whatsapp = false`, `features.advanced_analytics = false`).
   - Add-on dapat mengaktifkan fitur tersebut (`false || true = true`).
3. **Invariant $\text{Role} \neq \text{Entitlement}$:**
   - `STORE_OWNER` memiliki izin `analytics.read`, namun jika toko tidak memiliki entitlement `features.advanced_analytics = true`, aksi **ditolak** (`DENY_ENTITLEMENT`).
   - Toko memiliki entitlement `features.advanced_analytics = true`, namun `STORE_STAFF` tidak memiliki izin `analytics.read`, aksi **ditolak** (`DENY_PERMISSION`).

---

## 6. Security Decisions & Boundary Protections

1. **Pemisahan Domain Platform vs Store:**
   - `STORE_OWNER` dan `STORE_ADMIN` tidak pernah memiliki hak platform secara implisit.
   - `PLATFORM_ADMIN` tidak memiliki hak bypass otomatis ke dalam operasi toko tanpa konteks keanggotaan toko yang sah.
2. **Isolasi Lintas-Tenant (Cross-Tenant):**
   - User A (pemilik Store A) yang mencoba mengakses Store B dengan konteks Store A ditolak dengan alasan `DENY_SCOPE_MISMATCH` (`ScopeMismatchError`).
   - Mengetahui UUID Store B tidak memberikan celah bypass apa pun.
3. **Immutability & Anti-Tampering:**
   - `AuthenticatedStoreContext` bersifat beku (`Object.freeze`).
   - Request body atau URL query yang mencoba menyusupkan peran alternatif atau `store_id` lain tidak dapat mengubah konteks yang telah diautentikasi oleh server.

---

## 7. Status Database & Migrations

- **Database Migrations Baru:** **0** (Tidak ada migration baru).
- **Schema PostgreSQL:** Baseline M02 (`20261007133904_initial_schema.sql` dan `20261007142000_harden_cross_tenant_integrity_and_rls.sql`) dipertahankan 100% utuh tanpa modifikasi.
- **Hasil Regresi M02:** 39 dari 39 database test assertions tetap **PASS (100%)**.

---

## 8. Verification Results & Quality Gates

### A. Test Suite M04 (`packages/authorization`)
Menjalankan `vitest run` pada package `@bintang/authorization`: **32 dari 32 tests PASS (100%)**.

| Test File | Tests | Status | Cakupan |
| :--- | :---: | :---: | :--- |
| `tests/permissions.test.ts` | 4 | PASS | Validasi katalog izin, type guards, dan keunikan identifier |
| `tests/policy.test.ts` | 7 | PASS | Matriks kebijakan STORE_OWNER, STORE_ADMIN, STORE_STAFF, dan platform roles |
| `tests/entitlements.test.ts` | 3 | PASS | Kalkulasi effective entitlements, penggabungan limit aditif & fitur add-on |
| `tests/store-authorization.test.ts` | 4 | PASS | Evaluasi aksi store, validasi konteks unauthenticated, dan error assertions |
| `tests/platform-authorization.test.ts` | 6 | PASS | Otorisasi platform, pemisahan domain platform vs store, zero superuser bypass |
| `tests/cross-tenant-security.test.ts` | 4 | PASS | Penolakan aksi lintas-toko (Store A vs Store B) dan scope mismatch |
| `tests/role-vs-entitlement.test.ts` | 4 | PASS | Pembuktian invariant Role != Permission != Entitlement dan limit kuota numerik |
| **Total M04** | **32** | **PASS** | **100% Pass Rate** |

### B. Regresi Milestone M03 & Shared
- `@bintang/tenancy`: **62 dari 62 tests PASS (100%)**
- `@bintang/shared`: **12 dari 12 tests PASS (100%)**
- `@bintang/observability`: **3 dari 3 tests PASS (100%)**
- **Total Unit & Integration Tests Monorepo:** **109 tests PASS (100%)**

### C. Regresi Database PostgreSQL (M02)
- Linked Supabase Database (`nowyzlyruzlokiejvtne`): **39 dari 39 database tests PASS (100%)**

### D. Monorepo Quality Gates (Turborepo)
- **Format (`npm run format:check`):** PASS (seluruh file sesuai Prettier)
- **Lint (`npm run lint`):** PASS (ESLint 0 errors)
- **Typecheck (`npm run typecheck`):** PASS (TypeScript strict check lulus di seluruh 21 task workspace)
- **Tests (`npm run test`):** PASS (21 task Turborepo sukses, 109 unit tests lulus)
- **Build (`npm run build`):** PASS (19 package monorepo berhasil di-build tanpa error)

---

## 9. Known Gaps & Future Integration Points

1. **Persistence Adapter (TBD di fase integrasi persistensi):**
   - `@bintang/authorization` dan `@bintang/tenancy` saat ini bekerja menggunakan in-memory resolver fixtures untuk pengetesan kontrak. Integrasi langsung ke tabel Supabase `public.plans`, `public.subscriptions`, dan `public.store_addons` akan dipasangkan pada fase data access / persistence integration berikutnya.
2. **Owner Transfer RPC (TBD di database layer):**
   - Sesuai audit M03, operasi pemindahan kepemilikan bisnis membutuhkan database Stored Procedure/RPC (`transfer_store_ownership`) dengan hak `SECURITY DEFINER` di PostgreSQL agar tidak diblokir oleh trigger `trg_protect_store_owner`.
3. **No External Systems Touched:**
   - Tidak ada koneksi atau modifikasi terhadap Vercel production, VPS, legacy Bintang Store, atau payment gateway eksternal.

---

## 10. Git Status

```
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
	modified:   packages/authorization/package.json

Untracked files:
	docs/implementation/M04_AUTHORIZATION_REPORT.md
	packages/authorization/src/
	packages/authorization/tests/
	packages/authorization/tsconfig.json

no changes added to commit (use "git add" and/or "git commit -a")
```

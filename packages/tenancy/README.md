# @bintang/tenancy

Foundation package defining tenant isolation contracts and `StoreContext`.

## Contents

- `StoreContext` contract interface
- `createStoreContext` validation factory

## Invariants

- `AUTHENTICATION ≠ TENANT ISOLATION`.
- Every tenant business operation must explicitly run inside a valid `StoreContext`.
- Client-supplied `storeId` is never trusted without backend validation.

## Non-Goals for M01

- ZERO Supabase connection or RLS logic.
- ZERO database schema creation.
- ZERO authentication implementation (deferred to M03).

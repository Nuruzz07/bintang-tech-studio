# @bintang/orders

Architectural boundary for server-authoritative Order entities, state machines, and lifecycle transitions.

## Purpose & Scope

- Enforce strict order states: `PENDING_PAYMENT`, `PAID`, `PROCESSING`, `FULFILLED`, `FAILED`, `CANCELLED`, `EXPIRED`.
- Protect order lifecycle from unauthorized client-side status mutation.
- Generate server-side sequential order numbers per store.

## Planned Responsibilities (M07)

- Order aggregate and transition validators.
- Immutable order snapshots (pricing, items, customer details).
- Checkout command handlers with idempotency key enforcement.

## Explicit Non-Goals for M01

- NO order creation, database models, or checkout workflows implemented in M01.

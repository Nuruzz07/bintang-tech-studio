# @bintang/inventory

Architectural boundary for atomic stock reservations, unique credential inventory, and concurrency management.

## Purpose & Scope

- Prevent overselling via database-level atomic reservations with expiry TTL.
- Isolate inventory types: quantity-based stock vs unique single-use credential pools.

## Planned Responsibilities (M06)

- Reserve inventory command with expiration lease.
- Commit inventory reservation on payment success.
- Release inventory reservation on payment timeout or checkout cancellation.

## Explicit Non-Goals for M01

- NO stock reservation algorithms, mutexes, or inventory mutations implemented in M01.

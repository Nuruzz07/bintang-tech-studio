# @bintang/payments

Architectural boundary for server-side Payment Engine, provider adapters, webhook verification, and reconciliation.

## Purpose & Scope

- Standardize `PaymentAdapter` contract across providers (Tipzy, QRIS, Manual/Demo for tests).
- Isolate merchant payment accounts and credentials server-side.
- Process inbound payment webhooks idempotently with signature verification.

## Planned Responsibilities (M08)

- Payment attempt state machine (`PENDING`, `PROCESSING`, `PAID`, `FAILED`, `EXPIRED`, `CANCELLED`).
- Webhook signature authenticators.
- Amount, currency, and store_id mismatch reconciliation guards.

## Explicit Non-Goals for M01

- NO payment gateways, provider credentials, QRIS generators, or webhook listeners implemented in M01.

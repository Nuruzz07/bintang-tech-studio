# @bintang/billing

Architectural boundary for platform SaaS subscription, quotas, invoice management, and plan transitions.

## Purpose & Scope

- Manage merchant subscription lifecycles (`TRIAL`, `ACTIVE`, `PAST_DUE`, `SUSPENDED`, `CANCELLED`).
- Enforce recurring billing invariants, activation fees, and add-on charges.
- Separate Bintang Tech Studio platform billing from merchant commerce payments.

## Planned Responsibilities (M13)

- Plan quota evaluators (products count, broadcast quota, monthly orders).
- Subscription invoice generation and webhook synchronization.

## Explicit Non-Goals for M01

- NO subscription state machines, payment gateway hooks, or invoice calculators implemented in M01.

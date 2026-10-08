# @bintang/payments

Bintang Tech Studio — Payment Foundation Package (Milestone M08).
Classification: Domain & Service Foundation with in-memory persistence adapter.

> [!IMPORTANT]
> **Boundary & Atomicity Classification:**
> Payment/order cross-aggregate database transaction atomicity is NOT YET implemented.
> Cross-aggregate coordination between `@bintang/payments` and `@bintang/orders` currently operates via sequential application-level coordination. Production database transactions, external HTTP transports, and live merchant credentials belong to future provider/persistence adapters and transport services.

## Purpose & Scope

- **Seller-Owned Payment Accounts:** Store-isolated payment provider accounts with strictly hidden server-side credentials (`credentialReference`).
- **Provider-Neutral Abstraction:** `PaymentProviderAdapter` with explicit capability discovery (`PaymentProviderCapabilities`).
- **Payment Intent vs Attempt:** Conceptual and physical separation between customer intention to pay (`PaymentIntent`) and discrete charge attempts (`PaymentAttempt`). Historical attempts are immutable.
- **Strict State Machine:** Finite transitions across `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `EXPIRED`, `CANCELLED`, `REFUNDED`, `PARTIALLY_REFUNDED` enforced at both domain and repository layers. Disallowed transitions (`FAILED -> SUCCEEDED`, `EXPIRED -> SUCCEEDED`, `CANCELLED -> SUCCEEDED`, `REFUNDED -> SUCCEEDED`, `REFUNDED -> PARTIALLY_REFUNDED`) are strictly rejected.
- **Order Relationship Security:** Authoritative amount and currency derivation/verification from M07 Order Aggregate. Client-provided financial values cannot override authoritative order data.
- **Webhook Trust Boundary & Ingress:** Multi-factor verification verifying signature, provider, account, store, intent, attempt, amount, and currency. Event deduplication via `(provider, eventId)` with payload conflict rejection.
- **Refund Foundation:** Partial and full refund operations with cumulative balance invariant and concurrent race protection via in-flight mutex locking.
- **Idempotency:** Scoped by `(storeId, actorId, idempotencyKey)` with in-flight race serialization.
- **Cross-Tenant Isolation:** Rigorous multi-tenant boundaries preventing cross-store account, order, intent, or attempt access.

# @bintang/notifications

Architectural boundary for customer and merchant transactional notifications.

## Purpose & Scope

- Standardize notifications across multiple channels (Telegram, WhatsApp, Web push).
- Decouple notification dispatch failure from core commerce transaction completion.

## Planned Responsibilities (M09/M11)

- Template engines for order confirmation, payment receipt, and fulfillment delivery.
- Per-tenant notification preference resolver.

## Explicit Non-Goals for M01

- NO notification dispatchers, message templates, or messaging SDKs implemented in M01.

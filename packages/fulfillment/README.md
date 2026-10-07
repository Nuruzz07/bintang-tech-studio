# @bintang/fulfillment

Architectural boundary for digital product fulfillment strategies, delivery state transitions, and credential assignment.

## Purpose & Scope

- Manage fulfillment state (`PENDING`, `PROCESSING`, `FULFILLED`, `FAILED`, `MANUAL_REVIEW`).
- Support multiple fulfillment modes (`INSTANT_DIGITAL`, `MANUAL_DISPATCH`, `CUSTOM_SERVICE`).
- Decouple secure credential assignment from public product catalog views.

## Planned Responsibilities (M09)

- Fulfillment orchestrator and retry policies.
- Secure payload assembly for delivery via Customer Store, Telegram, or WhatsApp.

## Explicit Non-Goals for M01

- NO fulfillment workers, credential decryption, or delivery logic implemented in M01.

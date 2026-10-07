# @bintang/channels

Architectural boundary for external messaging channels (Telegram Bot API, Telegram Mini App, WhatsApp Business).

## Purpose & Scope

- Decouple platform commerce commands from external messaging provider SDKs.
- Isolate Telegram bot session parsing and Mini App init data validation.
- Abstract WhatsApp provider interfaces.

## Planned Responsibilities (M11)

- Telegram webhook/polling event normalizers.
- Secure server-side Telegram signature verification.
- Outbound channel message formatting and delivery.

## Explicit Non-Goals for M01

- NO Telegram Bot API calls, token configs, or message parsers implemented in M01.

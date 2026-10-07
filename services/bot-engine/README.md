# services/bot-engine (`bintang-bot`)

Messaging daemon orchestrating Telegram Bot API interactions and channel commands.

## Planned Responsibilities

- Telegram webhook handler / long-polling listener for customer and merchant interactions.
- Customer command router (`/start`, `/katalog`, `/pesanan`).
- Merchant command router (`/admin`, `/stok`, `/broadcast`).
- Outbound notification dispatcher via `@bintang/channels`.

## Deployment Plane

- Runs as dedicated process `bintang-bot` managed by PM2 on VPS.
- Never directly mutates financial or order state without calling the authoritative API.

## Implementation Status

- **M01 Status:** Structural placeholder.
- **Planned Milestone:** M11 (Telegram Engine).
- NO bot instances or polling daemons active in M01.

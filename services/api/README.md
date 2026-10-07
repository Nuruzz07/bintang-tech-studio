# services/api (`bintang-api`)

Public and application REST API server (`/api/v1`) for Bintang Tech Studio.

## Planned Responsibilities

- Public catalog endpoints for Customer Store.
- Authenticated management API for Seller Dashboard and Owner Console.
- Store Context resolution, request tracing (`request_id`), and authorization middleware.
- Inbound webhook receivers (signature verification, duplicate checking).

## Deployment Plane

- Runs as dedicated process `bintang-api` managed by PM2 on VPS behind Nginx.
- Isolated strictly from `abang-gtc`.

## Implementation Status

- **M01 Status:** Structural placeholder.
- **Planned Milestone:** M03+ (Identity, Tenancy, and Domain APIs).
- NO server runtime or endpoints active in M01.

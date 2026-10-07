# services/worker (`bintang-worker`)

Background queue consumer and transactional outbox processor for Bintang Tech Studio.

## Planned Responsibilities

- Transactional outbox polling and domain event publishing.
- Asynchronous fulfillment execution (credential extraction, customer delivery dispatch).
- Payment reconciliation jobs and webhook retry policies.
- Subscription billing renewal and grace period evaluators.

## Deployment Plane

- Runs as dedicated process `bintang-worker` managed by PM2 on VPS.
- Worker is not exposed publicly to the internet.

## Implementation Status

- **M01 Status:** Structural placeholder.
- **Planned Milestone:** M09 (Fulfillment Engine) and M13 (Billing Engine).
- NO background jobs or queue consumers active in M01.

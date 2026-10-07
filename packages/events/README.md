# @bintang/events

Architectural boundary for Domain Events, event versioning, and Transactional Outbox schemas.

## Purpose & Scope

- Standard event envelope (`id`, `eventName`, `aggregateId`, `storeId`, `correlationId`, `causationId`, `payload`, `occurredAt`).
- Outbox record contracts for at-least-once async event publishing.

## Planned Responsibilities (M07/M09)

- Event schema registries.
- Event serialization and deserialization.
- Outbox table event contracts.

## Explicit Non-Goals for M01

- NO event emitter, queue consumer, or outbox publisher implemented in M01.

# @bintang/observability

Foundation package defining structured telemetry contexts, log schemas, and sensitive data redaction.

## Contents

- `ObservabilityContext` contract interface (`requestId`, `correlationId`, `causationId`, `storeId`, `actorUserId`, `timestamp`)
- `createObservabilityContext` validation helper
- `maskSensitiveData` utility enforcing PII and secret minimization

## Invariants

- Structured logs must include `request_id`, `correlation_id`, and `store_id`.
- SECRETS MUST NEVER BE LOGGED.

## Non-Goals for M01

- ZERO production logging transport (Winston/Pino daemon).
- ZERO external monitoring or APM SDK integrations.

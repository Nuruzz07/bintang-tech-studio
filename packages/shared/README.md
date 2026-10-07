# @bintang/shared

Foundation package providing primitive types, Result monad utilities, and base ApplicationError hierarchy.

## Contents

- `Result<T, E>` functional error handling utilities (`ok`, `err`, `map`, `unwrap`)
- Standardized `ApplicationError` domain hierarchy
- Primitive scalar types (`EntityId`, `IsoDateTimeString`, `Nullable`)

## Constraints

- Generic foundational types only.
- ZERO commerce, order, payment, or authorization business logic.

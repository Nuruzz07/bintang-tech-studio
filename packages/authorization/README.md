# @bintang/authorization

Architectural boundary for Role-Based Access Control (RBAC), fine-grained permissions, and tenant entitlement checks.

## Purpose & Scope

- Manage store member roles (`owner`, `admin`, `staff`).
- Evaluate feature entitlements and tier limits (Starter, Pro, Business).
- Enforce server-side authorization guards before executing tenant operations.

## Planned Responsibilities (M04)

- Authorization policy evaluators.
- Entitlement resolver (`hasPermission`, `isEntitledToFeature`).
- Middleware guards for HTTP routes and Bot commands.

## Explicit Non-Goals for M01

- NO authorization logic, role matrices, or permission checkers implemented in M01.

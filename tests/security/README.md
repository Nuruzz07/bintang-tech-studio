# tests/security

Security regression test suite and adversarial penetration tests.

## Planned Test Cases (TEST-02..07)

- Cross-tenant IDOR defense (attempting cross-store access with valid user token).
- Role privilege escalation attacks (staff attempting owner actions).
- Client-supplied `store_id` manipulation validation.
- Store switching and removed membership token revoking.
- Webhook signature spoofing and replay attacks.

## Status in M01

- Structural placeholder. Security suites will be implemented alongside Auth (M03) and API (M03+).

# @bintang/commerce

Architectural boundary for catalog domain, products, categories, vouchers, and cart price calculation contracts.

## Purpose & Scope

- Authoritative definition of product entities, category trees, and voucher redemptions.
- Server-side authoritative price calculation (subtotal, discounts, fees, total).

## Planned Responsibilities (M05)

- Catalog models and queries.
- Voucher validity evaluators (usage limits, minimum spends, date windows).
- Cart total calculator.

## Explicit Non-Goals for M01

- NO catalog data, discount algorithms, or cart calculation logic implemented in M01.

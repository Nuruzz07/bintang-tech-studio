# @bintang/customer-store

Customer Storefront & Customer Commerce Boundary for Bintang Tech Studio.

## Role & Boundary

- **Customer-Facing Application Boundary:** Exposes customer storefront flows (Home, Catalog, Product Detail, Cart, Checkout, QRIS Payment, Order History, Fulfillment Status, Account).
- **Strict Isolation:** Excludes all Seller Dashboard, Owner Console, Telegram Admin, and Developer/Demo controls.
- **Store Context Enforced:** Every tenant operation is resolved through server-side `StoreContextResolver` (via domain, route mapping, or trusted config). Never trusts client-supplied `store_id`.
- **Customer Identity Bound:** Customer access is authenticated via `CustomerSessionManager`, ensuring customers can only access their own orders and account state.
- **Domain Foundations Connected:**
  - **Catalog (M05):** Authoritative categories, products, prices, and availability.
  - **Inventory (M06):** Stock checks, reservations on checkout, consumption on fulfillment.
  - **Orders (M07):** Authoritative order snapshots, grand total calculations, state machine.
  - **Payments (M08):** PaymentIntent creation and provider adapter integration.
  - **Fulfillment (M09):** Digital auto-delivery and sanitized customer-facing projections.

## Architectural Truths

- **Client Cart is UI-Only:** `localStorage` is strictly client draft state. All pricing, line totals, discounts, and inventory availability are calculated authoritatively server-side during valuation and checkout.
- **Zero Client Trust:** Client-supplied prices, totals, stock, customer IDs, and store IDs are completely overridden or rejected.
- **Sanitized Projections:** Internal inventory item IDs, failure reasons, and provider secrets are stripped from customer views.

# @bintang/owner-console

## Bintang Tech Studio — Platform Owner Console Foundation

**Milestone:** M14 — Owner Console Foundation  
**Classification:** Platform Control Plane Application & Domain Services (In-Memory Foundation)

---

### Architectural Purpose

`@bintang/owner-console` is the administrative control plane for Bintang Tech Studio platform operators (`PLATFORM_OWNER` and `PLATFORM_ADMIN`).

It is strictly separated from:

- **Seller Dashboard** (`@bintang/seller-dashboard`) — single-tenant store operations.
- **Customer Store** (`@bintang/customer-store`) — public storefront & Telegram Mini App.
- **Telegram Admin Engine** (`@bintang/telegram`) — conversational channel bot interface.

---

### 14 Canonical Platform Control Plane Modules

1. **A. Platform Overview (`PlatformOverviewService`):** High-level multi-tenant KPIs, active stores, subscriptions, billing volume, health status.
2. **B. Stores / Tenants (`PlatformStoreService`):** Multi-tenant store catalog, inspection, controlled lifecycle transitions (`SETUP` $\rightarrow$ `ACTIVE` $\rightarrow$ `SUSPENDED` $\rightarrow$ `ARCHIVED`).
3. **C. Sellers / Users (`PlatformUserService`):** User directory, platform role management with strict guardrails (owner-only promotion, no self-promotion, last-owner demotion protection).
4. **D. SaaS Plans (`PlatformBillingService`):** Authoritative plans catalog from M13 (`@bintang/billing`).
5. **E. Subscriptions (`PlatformBillingService`):** Subscription governance and lifecycle actions (`ACTIVATE`, `SUSPEND`, `RESUME`, `CANCEL`, `EXPIRE`).
6. **F. Billing / Invoices (`PlatformBillingService`):** Cross-tenant invoice inspection, setup fees, and financial ledger immutability.
7. **G. Add-ons (`PlatformBillingService`):** Add-on catalog and store assignments.
8. **H. Templates (`PlatformTemplateService`):** Storefront template catalog and version governance.
9. **I. Bots & Channels (`PlatformBotService`):** Safe bot and channel inspection with **zero secret leakage** (masked credential refs, no raw tokens).
10. **J. Cross-Store Orders (`PlatformOrderService`):** Cross-tenant order metrics with customer PII minimization.
11. **K. Support Tickets (`PlatformSupportService`):** Minimal operational support ticket tracking mapped to M02 `support_tickets`.
12. **L. Activity / Audit Logs (`PlatformAuditService`):** Append-only audit logging for all privileged mutations with automatic secret sanitization.
13. **M. System Health (`PlatformHealthService`):** Component health telemetry abstraction (labeled explicitly as simulation/foundation).
14. **N. Platform Policies & Settings (`PlatformSettingsService`):** Maintenance mode and global onboarding toggles with owner-only protection.

---

### Security & Privilege Pipeline

```
HTTP Request / CLI
       │
       ▼
Session Token (pos_...)
       │
       ▼
OwnerConsoleSessionManager (Asserts PLATFORM_OWNER or PLATFORM_ADMIN)
       │
       ▼
PlatformContext (userId, platformRole)
       │
       ▼
AuthorizationService (M04 Canonical Policy Matrix)
       │
       ▼
Domain Service Execution
       │
       ▼
PlatformAuditService (Append-only sanitized audit record)
```

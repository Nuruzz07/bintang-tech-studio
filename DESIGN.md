---
version: alpha
name: Bintang Tech Studio
description: >-
  Commerce operations for Indonesian digital-product sellers. Keep the buyer-facing
  store warm and recognizable, and keep seller/owner tools calm, legible, and action-first.
colors:
  primary: '#C2410C'
  secondary: '#1C1917'
  tertiary: '#D97706'
  neutral: '#FAF7F2'
  text: '#1C1917'
  muted: '#78716C'
  border: '#E7E5E4'
  success: '#059669'
  danger: '#DC2626'
  seller-background: '#0f172a'
  seller-sidebar: '#0b1325'
  seller-surface: '#1e293b'
  seller-border: '#334155'
  seller-accent: '#6366f1'
  seller-text: '#f8fafc'
  seller-muted: '#94a3b8'
  owner-background: '#090d16'
  owner-sidebar: '#0d1322'
  owner-surface: '#131b2e'
  owner-border: '#1e293b'
  owner-accent: '#38bdf8'
  owner-text: '#f8fafc'
  owner-muted: '#94a3b8'
typography:
  heading:
    fontFamily: 'Plus Jakarta Sans, Inter, sans-serif'
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: 'Plus Jakarta Sans, Inter, sans-serif'
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: 'Plus Jakarta Sans, Inter, sans-serif'
    fontSize: 0.875rem
    fontWeight: 600
    lineHeight: 1.4
  data:
    fontFamily: 'JetBrains Mono, ui-monospace, monospace'
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: 6px
  md: 10px
  lg: 16px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '#FFFFFF'
    rounded: '{rounded.md}'
    height: 44px
  button-secondary:
    backgroundColor: '{colors.secondary}'
    textColor: '#FFFFFF'
    rounded: '{rounded.md}'
    height: 44px
  input-storefront:
    backgroundColor: '#FFFFFF'
    textColor: '{colors.text}'
    rounded: '{rounded.sm}'
    height: 44px
  card-storefront:
    backgroundColor: '#FFFFFF'
    textColor: '{colors.text}'
    rounded: '{rounded.md}'
    padding: 16px
  text-muted-storefront:
    backgroundColor: '{colors.neutral}'
    textColor: '#57534e'
  text-muted-white-storefront:
    backgroundColor: '#FFFFFF'
    textColor: '{colors.muted}'
  status-success-storefront:
    backgroundColor: '{colors.success}'
    textColor: '#000000'
  border-storefront:
    backgroundColor: '{colors.border}'
    textColor: '{colors.text}'
  text-success-storefront:
    backgroundColor: '#FFFFFF'
    textColor: '#047857'
  text-danger-storefront:
    backgroundColor: '#FFFFFF'
    textColor: '{colors.danger}'
  button-seller-primary:
    backgroundColor: '{colors.seller-accent}'
    textColor: '#000000'
    rounded: '{rounded.md}'
    height: 44px
  sidebar-seller:
    backgroundColor: '{colors.seller-sidebar}'
    textColor: '{colors.seller-text}'
  surface-seller:
    backgroundColor: '{colors.seller-surface}'
    textColor: '{colors.seller-text}'
  text-muted-seller:
    backgroundColor: '{colors.seller-background}'
    textColor: '{colors.seller-muted}'
  border-seller:
    backgroundColor: '{colors.seller-border}'
    textColor: '{colors.seller-text}'
  button-owner-primary:
    backgroundColor: '{colors.owner-accent}'
    textColor: '{colors.owner-background}'
    rounded: '{rounded.md}'
    height: 44px
  sidebar-owner:
    backgroundColor: '{colors.owner-sidebar}'
    textColor: '{colors.owner-text}'
  surface-owner:
    backgroundColor: '{colors.owner-surface}'
    textColor: '{colors.owner-text}'
  text-muted-owner:
    backgroundColor: '{colors.owner-background}'
    textColor: '{colors.owner-muted}'
  border-owner:
    backgroundColor: '{colors.owner-border}'
    textColor: '{colors.owner-text}'
---

## Overview

**Status: product design direction disetujui owner pada 13 Oktober 2026.** Panduan ini memakai produk/identitas visual dan source aktual sebagai baseline arah, bukan bukti bahwa semua permukaan telah mengikuti satu sistem terpadu atau lolos aksesibilitas/usability. Token yang terobservasi tetap perlu dibedakan dari perubahan rekomendasi yang tercatat di sini. Pertahankan logo aktual `logo.svg`. Jangan menggambar ulang logo atau mengarang foto, identitas seller, ulasan, klaim performa, atau metrik live.

**Design read:** Bintang Tech is both a commerce surface for buyers and an operations tool for sellers. Buyer-facing screens should feel approachable and commercially clear; seller screens should make the next order action obvious; the owner console should distinguish platform operations from seller work. Avoid generic admin dashboards, decorative AI motifs, and an unearned enterprise-security aesthetic.

The logo’s paired geometry and central mark may appear as the identity signature beside the product name. Use it sparingly. Do not turn it into a background grid, repeating texture, status light, or decoration behind dense data.

**Dials disetujui owner untuk baseline desain:** ENERGY 2 / RHYTHM 2 / MOTION 1 untuk operational UI dan storefront. Gunakan hirarki informasi kuat, komposisi list/table yang mudah dipindai, variasi secukupnya untuk tindakan urgent, serta motion untuk feedback langsung. Pada storefront, konten produk, harga, ketersediaan, status pembayaran, dan bantuan lebih utama daripada ilustrasi/animasi. Persetujuan dial adalah arah visual, bukan bukti UI aktual sudah memenuhi aksesibilitas, kontras atau implementasi.

## Colors

### Brand and buyer storefront

These values are observed in `apps/customer-store/src/ui/tokens.ts` and the demo handler, not invented palette replacements:

- **Terracotta `#C2410C`:** current customer-facing primary/action color. Keep it for the key purchase or continue action, not every icon and badge.
- **Obsidian `#1C1917` and `#0C0A09`:** current brand/deep surface colors that provide contrast and a grounded frame.
- **Warm ivory `#FAF7F2`:** current storefront page background. It helps distinguish shopping and product reading from operational consoles.
- **Amber `#D97706`:** current highlight/availability accent. Use only where it carries a real label or state.
- **Emerald `#059669`:** current success/availability color. Pair it with text or an icon; never rely on color alone.

### Seller operations

`apps/seller-dashboard/src/ui/tokens.ts` currently defines a separate dark slate operational theme: app `#0f172a`, sidebar `#0b1325`, card `#1e293b`, border `#334155`, text `#f8fafc` / `#94a3b8`, and indigo action `#6366f1`. Preserve this surface’s existing values when extending it until a deliberate migration is designed and contrast-tested. Do not accidentally mix the warm storefront palette into each table/status element.

### Platform owner console

`apps/owner-console/src/ui/tokens.ts` currently defines a deeper navy control-plane theme: app `#090d16`, sidebar `#0d1322`, card `#131b2e`, border `#1e293b`, text `#f8fafc` / `#94a3b8`, and sky accent `#38bdf8`. Preserve its role as a separate platform-operations surface. Do not use its accent for customer purchase actions.

The three existing surface palettes are observed code, but their long-term relationship is **not a confirmed brand decision**. Any unification, theme toggle, contrast-sensitive color change, or conversion of hard-coded demo palette to production tokens needs a surface-specific change and verification. Semantic states (success, warning, error, unavailable) must also include readable labels and must not be confused with the primary brand accent.

## Typography

The storefront explicitly uses Plus Jakarta Sans with Inter/system fallbacks. The seller dashboard explicitly uses Inter first with Plus Jakarta Sans/system fallbacks. Use each surface’s existing stack for local changes; do not trigger an unrelated font migration. For new customer-facing text, Plus Jakarta Sans is the current brand-aligned starting point. Use tabular/monospaced numerals only for compact IDs, order references, or data where alignment helps scanning, never for long prose or oversized technical-looking headings. Keep Indonesian labels natural and concise; show currency and dates in the seller’s configured locale/currency. Do not use uppercase tracking as a substitute for hierarchy.

## Layout

### Seller dashboard

The confirmed screen job is to help a seller identify orders requiring action, understand what is wrong, and take the next valid step. Put that queue before vanity metrics. Group active orders by status, sort within a status by explicit operational urgency, and keep completed work in a separate history. Each order row/card should show its current problem/state and next action. Actions must be valid for that order state. Store and channel health are secondary; show a concise state on the overview and put cause/recovery guidance on the channel detail screen. Order detail foregrounds current status, next step, payment status/amount/method, and relevant buyer/product information. Do not add a seller-facing status timeline: Nuruzz explicitly chose not to show one. Internal audit history is a separate product/security question.

This information hierarchy is confirmed from discovery notes. Exact status names, urgency calculation, queue filters, search, field visibility, and mobile navigation remain to be defined. Do not infer these from the current generic overview metrics.

### Storefront and buyer tracking

Keep product title, offer/variant where actually supported, price, availability, fulfillment expectation, checkout, and help easy to scan. Never imply instant delivery for invite/manual products. Show a truthful pending state and an ETA only when the seller supplied or the system can support it. Buyer tracking must not expose another buyer’s order or secret delivery data. Keep guest tracking easy to reach without weakening order authorization.

### Owner console

Treat platform-level tenants, service health, billing controls, and audit operations as distinct from one seller’s order queue. Surface actions that can suspend access, change billing, or affect tenant data as explicit, permission-gated operations with a clear target and confirmation. Do not present simulated telemetry or demo tenant values as real production state.

### Responsive and accessible behavior

Start from the smallest practical viewport, then expand. No horizontal page overflow. Reflow tables into a clearly labeled compact layout or allow a deliberately contained table scroller with an accessible alternative. Keep interactive targets at least 44px high where practical, preserve visible keyboard focus, labels, logical heading order, text zoom, reduced-motion behavior, and error recovery. Normal text must meet WCAG AA contrast (4.5:1); large text 3:1. Never communicate status with color alone. Do not disable browser zoom.

## Elevation & Depth

Use solid surfaces and borders for grouping. Elevation is reserved for a surface that genuinely overlays the page, such as a menu or confirmation dialog. Do not put a large soft shadow on every card, add decorative glass blur across the navigation, or add ambient glow. A status border/stripe is allowed only when it communicates a real status and is accompanied by text/icon.

## Shapes

Use the small existing radius family as the baseline: compact controls are less rounded than cards. Keep buttons and inputs easy to identify and tap. Avoid turning every card, badge, and control into a pill. Status chips may use a fully rounded shape only when their semantic role remains clear and labels are not truncated.

## Components

- **Order queue item:** order reference, customer/product summary appropriate to role, current status/problem, urgency rationale where needed, and the one primary next action. Do not render a dead action or imply that a manual seller task has completed.
- **Order status:** localized text label plus supporting icon/shape; timestamps and next-step instructions where meaningful. A status change announcement should not move keyboard focus.
- **Forms:** visible labels, purpose/helper text for sensitive or non-obvious fields, validation on submission/blur, inline recovery, and preservation of user input after recoverable errors. Never collect a buyer’s password. Any credential-like seller secret requires a secure design and review before the feature is enabled.
- **Payments/refunds:** distinguish platform subscription charges from the seller’s buyer-payment gateway. Confirm destructive/financial actions with a clear amount, target order, and consequence. A success message appears only after authoritative confirmation.
- **Channel connection:** overview shows concise connected/degraded/disconnected state. Detail explains what failed, when last checked if measured, what is affected, and a safe repair/test action. Never label a channel connected based solely on saved credentials.
- **Empty/loading/error/permission states:** every data view has all relevant states, including first-run empty, filter-empty, loading, network/provider failure, and insufficient permission. State the cause if known and one safe recovery action. Do not show fake rows to make a demo look populated; visibly identify simulated data.
- **Notifications:** feedback is near the action and screen-reader accessible. Do not claim “sent”, “paid”, “refunded”, or “delivered” until the external/system result confirms it.

## Do's and Don'ts

**Do**

- Read `AGENTS.md`, the relevant UI source, current tokens, data model, and real route before a UI change.
- Keep buyer commerce visually distinct from seller operations and platform control-plane workflows.
- Prioritize a real seller decision and a concrete next action on each screen.
- Use real product/data states; use explicit “Simulasi”/“Data contoh” labeling in demo-only surfaces.
- Preserve the broad confirmed product vision: website, Telegram Bot and Web App, WhatsApp, seller dashboard and Telegram operations, product types, and automatic/invite/manual fulfillment. A release-phase suggestion never removes the longer-term scope.
- Test mobile, keyboard, loading, empty, error, permission, and success/failure recovery states before calling UI complete.

**Don't**

- Replace the existing UI with a generic sidebar + four metrics + chart + table dashboard.
- Invent a layout, success metric, quote, seller identity, sales figure, SLA, security/compliance claim, or real provider connection.
- Make a static simulator look like live Telegram/WhatsApp/payment behavior.
- Expose payment secrets, seller credentials, buyer PII, webhook payload secrets, or internal exception detail in UI, logs, URLs, or demo fixtures.
- Use emoji as product iconography; preserve existing demo-only emoji only until an intentional, tested refactor removes them.
- Change a palette, navigation, order status semantics, or target surface without documenting why and validating the resulting interactions.

## Evidence and implementation boundary

The existing token files and source-rendered HTML are evidence of current styling, not proof that all current surfaces meet this guideline, WCAG contrast, or mobile/accessibility requirements. The seller dashboard currently renders a dark operational shell and metric-first overview in `apps/seller-dashboard/src/ui/dashboard-views.ts`; that differs from the confirmed order-action-first dashboard direction and must be treated as a gap, not silently rewritten by this file. The multi-surface ecosystem demo lives in `services/api/src/handlers/demo.ts` and includes simulator behavior; its connected-looking controls/data are not evidence of live third-party integrations. The demo uses Tailwind CDN and Google Fonts CDN, which are unsuitable as a production dependency policy without a deliberate build/self-hosting decision.

**Contrast audit, 12 October 2026:** `npx -y -p @google/design.md designmd lint DESIGN.md` reports 0 errors and 0 warnings, but that result does not prove every actual text/background pairing is AA compliant. Manual WCAG relative-luminance checks against the existing tokens found `#78716C` on warm ivory `#FAF7F2` at 4.49:1 (just below 4.5:1), amber `#D97706` on white at 3.19:1 and on ivory at 2.98:1, and seller indigo `#6366F1` on seller background `#0F172A` at 4.00:1. Do not use these failing pairs for normal-size text. Keep amber for non-text emphasis or use dark text on amber; for storefront muted text use a verified pair such as the existing white-surface pairing or a darker text token; on the seller dashboard use the accent for non-text emphasis or choose a contrast-tested text/background combination. The source palette is observed, so any token change remains a separate, reasoned UI change that must test all actual rendered states and components before release.

For each future visual change, state its one-line Design Read, follow the three dials above, name major choices and purposes, inspect the actual UI, then run the app and record a click-through/keyboard/mobile check. A document or passing compile alone does not pass the visual delivery gate.

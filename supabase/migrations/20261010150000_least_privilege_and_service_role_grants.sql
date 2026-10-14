-- ==============================================================================
-- BINTANG TECH STUDIO - LEAST PRIVILEGE & SERVICE ROLE DATABASE GRANTS
-- Migration: 20261010150000_least_privilege_and_service_role_grants.sql
-- Purpose:
--   1. Grant explicit least-privilege DML access to backend service_role on domain tables
--   2. Grant sequence usage to service_role
--   3. Configure default privileges for future table creations
--   4. Revoke anonymous & public access to sensitive internal queues & audit tables
--   5. Guarantee service_role execution rights on all PostgreSQL RPC functions
--
-- STATUS: DRAFT / PENDING REVIEW. DO NOT APPLY TO STAGING WITHOUT EXPLICIT APPROVAL.
-- ==============================================================================

-- ==============================================================================
-- 1. EXPLICIT DML PRIVILEGES ON BUSINESS DOMAIN TABLES TO service_role
-- ==============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_channels TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_addons TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vouchers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voucher_redemptions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fulfillments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fulfillment_items TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.refunds TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_payments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.idempotency_records TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outbox_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_incidents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_decisions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_versions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_deliveries TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addons TO service_role;

-- ==============================================================================
-- 2. SEQUENCES & DEFAULT PRIVILEGES
-- ==============================================================================

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO service_role;

-- ==============================================================================
-- 3. LEAST-PRIVILEGE TIGHTENING: REVOKE ACCESS TO SENSITIVE INTERNAL TABLES
-- ==============================================================================

-- Queues, outbox, and background jobs are strictly internal to service_role
REVOKE ALL ON public.jobs FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.outbox_events FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.security_events FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.security_incidents FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.risk_decisions FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.activity_logs FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.payment_events FROM anon, authenticated, PUBLIC;

-- Idempotency and session records: only accessible to authenticated users & service_role
REVOKE ALL ON public.idempotency_records FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.idempotency_records TO authenticated, service_role;

REVOKE ALL ON public.app_sessions FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_sessions TO authenticated, service_role;

-- ==============================================================================
-- 4. FUNCTION EXECUTION PRIVILEGES FOR service_role
-- ==============================================================================

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ==============================================================================
-- BINTANG TECH STUDIO — M02 DATABASE FOUNDATION
-- Migration: 00001_initial_schema.sql / 20261007133904_initial_schema.sql
-- Baseline: Master Blueprint v3.0 / Architecture Freeze v1.0
-- Target Architecture: Shared Database + Shared Schema + Logical Tenancy + RLS
-- ==============================================================================

-- 0. EXTENSIONS & UTILITIES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. IDENTITY & TENANCY FOUNDATION
-- ==============================================================================

-- 1.1 Profiles (extends auth.users with platform identity)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    platform_role TEXT NOT NULL DEFAULT 'USER' CHECK (platform_role IN ('USER', 'PLATFORM_ADMIN', 'PLATFORM_OWNER')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DEACTIVATED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.profiles IS 'User profiles extending Supabase auth.users with platform roles';

-- 1.2 Templates (Storefront templates)
CREATE TABLE public.templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 1.3 Template Versions
CREATE TABLE public.template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'TESTING', 'PUBLISHED', 'DEPRECATED', 'SUSPENDED', 'ARCHIVED')),
    compatibility_version TEXT NOT NULL DEFAULT '1.0',
    config_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    theme_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    feature_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    published_at TIMESTAMPTZ,
    CONSTRAINT uq_template_versions_template_version UNIQUE (template_id, version)
);

-- 1.4 Stores (Tenants)
CREATE TABLE public.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES public.profiles(id),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    template_version_id UUID REFERENCES public.template_versions(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'SETUP' CHECK (status IN ('SETUP', 'ACTIVE', 'SUSPENDED', 'ARCHIVED')),
    currency TEXT NOT NULL DEFAULT 'IDR',
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.stores IS 'Core tenant boundary for Bintang Tech Studio merchant stores';

-- 1.5 Store Memberships (Tenant Access Control)
CREATE TABLE public.store_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('STORE_OWNER', 'STORE_ADMIN', 'STORE_STAFF')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_store_members_store_user UNIQUE (store_id, user_id)
);

-- ==============================================================================
-- 2. SAAS SUBSCRIPTION & BILLING FOUNDATION
-- ==============================================================================

-- 2.1 SaaS Plans
CREATE TABLE public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    monthly_price NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (monthly_price >= 0),
    activation_fee NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (activation_fee >= 0),
    max_products INTEGER NOT NULL DEFAULT 50 CHECK (max_products >= 0),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.2 Subscriptions
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.plans(id),
    status TEXT NOT NULL DEFAULT 'TRIAL' CHECK (status IN ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'EXPIRED')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    current_period_end TIMESTAMPTZ NOT NULL,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.3 Addons
CREATE TABLE public.addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    monthly_price NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (monthly_price >= 0),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.4 Store Addons
CREATE TABLE public.store_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    addon_id UUID NOT NULL REFERENCES public.addons(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED')),
    activated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ,
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT uq_store_addons_store_addon UNIQUE (store_id, addon_id)
);

-- 2.5 Invoices
CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('DRAFT', 'PENDING', 'PAID', 'VOID', 'UNCOLLECTIBLE')),
    subtotal NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    tax NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (tax >= 0),
    total NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    currency TEXT NOT NULL DEFAULT 'IDR',
    issued_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    due_at TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 2.6 Invoice Items
CREATE TABLE public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('ACTIVATION', 'SUBSCRIPTION', 'ADDON', 'ADJUSTMENT', 'DISCOUNT')),
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.7 Billing Payments (Platform recurring/setup collections)
CREATE TABLE public.billing_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_transaction_id TEXT,
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'IDR',
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED')),
    payment_url TEXT,
    paid_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 3. COMMERCE FOUNDATION
-- ==============================================================================

-- 3.1 Categories
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_categories_store_slug UNIQUE (store_id, slug)
);

-- 3.2 Products
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    product_type TEXT NOT NULL DEFAULT 'DIGITAL' CHECK (product_type IN ('DIGITAL', 'SERVICE', 'PHYSICAL')),
    price NUMERIC(15,2) NOT NULL CHECK (price >= 0),
    compare_at_price NUMERIC(15,2) CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
    stock_mode TEXT NOT NULL DEFAULT 'TRACKED' CHECK (stock_mode IN ('UNLIMITED', 'TRACKED')),
    inventory_strategy TEXT NOT NULL DEFAULT 'QUANTITY' CHECK (inventory_strategy IN ('QUANTITY', 'UNIQUE_ITEM')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_products_store_slug UNIQUE (store_id, slug)
);

-- 3.3 Inventory (Aggregate stock tracking)
CREATE TABLE public.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
    quantity_reserved INTEGER NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_inventory_reserved_lte_on_hand CHECK (quantity_reserved <= quantity_on_hand),
    CONSTRAINT uq_inventory_store_product UNIQUE (store_id, product_id)
);

-- 3.4 Inventory Items (Unique single-use digital credentials/assets)
CREATE TABLE public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    inventory_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
    item_type TEXT NOT NULL DEFAULT 'CREDENTIAL',
    secret_reference TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'RESERVED', 'ASSIGNED', 'EXPIRED', 'INVALID')),
    reserved_order_id UUID,
    assigned_order_id UUID,
    reserved_at TIMESTAMPTZ,
    reserved_until TIMESTAMPTZ,
    assigned_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.5 Customers (Store-scoped customer identity)
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    telegram_id TEXT,
    whatsapp_number TEXT,
    total_orders INTEGER NOT NULL DEFAULT 0 CHECK (total_orders >= 0),
    total_spent NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (total_spent >= 0),
    last_order_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX uq_customers_store_telegram ON public.customers (store_id, telegram_id) WHERE telegram_id IS NOT NULL;
CREATE UNIQUE INDEX uq_customers_store_whatsapp ON public.customers (store_id, whatsapp_number) WHERE whatsapp_number IS NOT NULL;

-- 3.6 Orders
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    order_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK (status IN ('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'FULFILLED', 'FAILED', 'CANCELLED', 'EXPIRED')),
    subtotal NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount_total NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (discount_total >= 0),
    grand_total NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (grand_total >= 0),
    currency TEXT NOT NULL DEFAULT 'IDR',
    voucher_id UUID,
    fulfillment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (fulfillment_status IN ('PENDING', 'PROCESSING', 'FULFILLED', 'FAILED', 'MANUAL_REVIEW', 'CANCELLED')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_orders_store_order_number UNIQUE (store_id, order_number)
);

-- 3.7 Order Items (Immutable line item snapshots)
CREATE TABLE public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC(15,2) NOT NULL CHECK (unit_price >= 0),
    subtotal NUMERIC(15,2) NOT NULL CHECK (subtotal >= 0),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.8 Vouchers
CREATE TABLE public.vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED')),
    discount_value NUMERIC(15,2) NOT NULL CHECK (discount_value > 0),
    minimum_purchase NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (minimum_purchase >= 0),
    maximum_discount NUMERIC(15,2) CHECK (maximum_discount IS NULL OR maximum_discount > 0),
    usage_limit INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
    used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
    starts_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'EXPIRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_voucher_code_upper CHECK (code = upper(trim(code))),
    CONSTRAINT uq_vouchers_store_code UNIQUE (store_id, code)
);

-- 3.9 Voucher Redemptions
CREATE TABLE public.voucher_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_id UUID NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    discount_amount NUMERIC(15,2) NOT NULL CHECK (discount_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_voucher_redemptions_order UNIQUE (order_id)
);

-- ==============================================================================
-- 4. PAYMENT ENGINE FOUNDATION
-- ==============================================================================

-- 4.1 Payment Accounts (Merchant integration credentials reference)
CREATE TABLE public.payment_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    display_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ERROR', 'DISCONNECTED')),
    credential_reference TEXT NOT NULL,
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4.2 Payments (Payment attempts for customer orders)
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    payment_account_id UUID REFERENCES public.payment_accounts(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    provider_transaction_id TEXT,
    attempt_number INTEGER NOT NULL DEFAULT 1 CHECK (attempt_number >= 1),
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'IDR',
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED')),
    payment_url TEXT,
    paid_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    failure_reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4.3 Payment Events (Webhook ingress records)
CREATE TABLE public.payment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed_at TIMESTAMPTZ,
    processing_status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (processing_status IN ('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_payment_events_provider_event UNIQUE (provider, event_id)
);

-- 4.4 Refunds
CREATE TABLE public.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_refund_id TEXT,
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'IDR',
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED')),
    reason TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    processed_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ==============================================================================
-- 5. FULFILLMENT FOUNDATION
-- ==============================================================================

-- 5.1 Fulfillments
CREATE TABLE public.fulfillments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    strategy TEXT NOT NULL DEFAULT 'DIGITAL_AUTO' CHECK (strategy IN ('DIGITAL_AUTO', 'DIGITAL_MANUAL', 'SERVICE', 'PHYSICAL')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'FULFILLED', 'FAILED', 'MANUAL_REVIEW', 'CANCELLED')),
    tracking_info JSONB NOT NULL DEFAULT '{}'::jsonb,
    failure_reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5.2 Fulfillment Items
CREATE TABLE public.fulfillment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fulfillment_id UUID NOT NULL REFERENCES public.fulfillments(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
    item_type TEXT NOT NULL DEFAULT 'CREDENTIAL',
    status TEXT NOT NULL DEFAULT 'DELIVERED' CHECK (status IN ('PENDING', 'DELIVERED', 'FAILED', 'REVOKED')),
    payload_reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 6. CHANNEL & BOT ENGINE FOUNDATION
-- ==============================================================================

-- 6.1 Store Channels
CREATE TABLE public.store_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('TELEGRAM', 'WHATSAPP')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_store_channels_store_channel UNIQUE (store_id, channel)
);

-- 6.2 Bots
CREATE TABLE public.bots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('TELEGRAM', 'WHATSAPP')),
    provider TEXT NOT NULL DEFAULT 'TELEGRAM_BOT_API',
    display_name TEXT NOT NULL,
    external_bot_id TEXT,
    username TEXT,
    status TEXT NOT NULL DEFAULT 'DISCONNECTED' CHECK (status IN ('CONNECTED', 'DISCONNECTED', 'ERROR', 'SUSPENDED')),
    credential_reference TEXT NOT NULL,
    webhook_status TEXT NOT NULL DEFAULT 'INACTIVE',
    connected_at TIMESTAMPTZ,
    disconnected_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 7. OPERATIONAL, OBSERVABILITY & SECURITY FOUNDATION
-- ==============================================================================

-- 7.1 Activity Logs
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7.2 Support Tickets
CREATE TABLE public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ticket_number TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'GENERAL',
    priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7.3 Notifications
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('TELEGRAM', 'WHATSAPP', 'EMAIL', 'IN_APP')),
    template TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'CANCELLED')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7.4 Notification Deliveries
CREATE TABLE public.notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    provider_message_id TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DELIVERED', 'FAILED')),
    attempts INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    delivered_at TIMESTAMPTZ
);

-- 7.5 Notification Preferences
CREATE TABLE public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_notif_pref_user_store UNIQUE (user_id, store_id)
);

-- 7.6 Transactional Outbox Events
CREATE TABLE public.outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name TEXT NOT NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    correlation_id TEXT,
    causation_id TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED', 'DEAD_LETTER')),
    attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7.7 Background Jobs
CREATE TABLE public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL,
    queue_name TEXT NOT NULL DEFAULT 'default',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    locked_until TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    processed_at TIMESTAMPTZ
);

-- 7.8 Security Events
CREATE TABLE public.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7.9 Security Incidents
CREATE TABLE public.security_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED')),
    description TEXT NOT NULL,
    resolution_notes TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    resolved_at TIMESTAMPTZ
);

-- 7.10 Risk Policy Decisions
CREATE TABLE public.risk_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('ALLOW', 'REVIEW', 'BLOCK')),
    score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 8. INDEXES FOR PERFORMANCE & TENANT ISOLATION
-- ==============================================================================

CREATE INDEX idx_stores_owner_user_id ON public.stores (owner_user_id);
CREATE INDEX idx_store_members_store_id ON public.store_members (store_id);
CREATE INDEX idx_store_members_user_id ON public.store_members (user_id);
CREATE INDEX idx_subscriptions_store_id ON public.subscriptions (store_id);
CREATE INDEX idx_invoices_store_id ON public.invoices (store_id);
CREATE INDEX idx_invoice_items_invoice_id ON public.invoice_items (invoice_id);
CREATE INDEX idx_billing_payments_store_id ON public.billing_payments (store_id);
CREATE INDEX idx_billing_payments_invoice_id ON public.billing_payments (invoice_id);

CREATE INDEX idx_categories_store_id ON public.categories (store_id);
CREATE INDEX idx_products_store_id ON public.products (store_id);
CREATE INDEX idx_products_category_id ON public.products (category_id);
CREATE INDEX idx_inventory_store_id ON public.inventory (store_id);
CREATE INDEX idx_inventory_items_store_id ON public.inventory_items (store_id);
CREATE INDEX idx_inventory_items_product_id ON public.inventory_items (product_id);
CREATE INDEX idx_inventory_items_status ON public.inventory_items (status);

CREATE INDEX idx_customers_store_id ON public.customers (store_id);
CREATE INDEX idx_orders_store_id ON public.orders (store_id);
CREATE INDEX idx_orders_customer_id ON public.orders (customer_id);
CREATE INDEX idx_orders_status ON public.orders (status);
CREATE INDEX idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX idx_vouchers_store_id ON public.vouchers (store_id);
CREATE INDEX idx_voucher_redemptions_store_id ON public.voucher_redemptions (store_id);

CREATE INDEX idx_payment_accounts_store_id ON public.payment_accounts (store_id);
CREATE INDEX idx_payments_store_id ON public.payments (store_id);
CREATE INDEX idx_payments_order_id ON public.payments (order_id);
CREATE INDEX idx_payments_status ON public.payments (status);
CREATE INDEX idx_refunds_store_id ON public.refunds (store_id);
CREATE INDEX idx_fulfillments_store_id ON public.fulfillments (store_id);
CREATE INDEX idx_fulfillments_order_id ON public.fulfillments (order_id);
CREATE INDEX idx_store_channels_store_id ON public.store_channels (store_id);
CREATE INDEX idx_bots_store_id ON public.bots (store_id);

CREATE INDEX idx_activity_logs_store_id ON public.activity_logs (store_id);
CREATE INDEX idx_support_tickets_store_id ON public.support_tickets (store_id);
CREATE INDEX idx_notifications_store_id ON public.notifications (store_id);
CREATE INDEX idx_outbox_events_status ON public.outbox_events (status);
CREATE INDEX idx_jobs_status ON public.jobs (status);
CREATE INDEX idx_security_events_store_id ON public.security_events (store_id);

-- ==============================================================================
-- 9. AUTH TRIGGER (SAFE & IDEMPOTENT PROFILE CREATION)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, platform_role, status)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    'USER',
    'ACTIVE'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS) FOUNDATION
-- ==============================================================================

-- 10.1 Helper Functions
CREATE OR REPLACE FUNCTION public.get_current_user_store_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id
  FROM public.store_members
  WHERE user_id = auth.uid()
    AND status = 'ACTIVE';
$$;

CREATE OR REPLACE FUNCTION public.is_store_member(lookup_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.store_members
    WHERE store_id = lookup_store_id
      AND user_id = auth.uid()
      AND status = 'ACTIVE'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_store_member_role(lookup_store_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.store_members
  WHERE store_id = lookup_store_id
    AND user_id = auth.uid()
    AND status = 'ACTIVE'
  LIMIT 1;
$$;

-- 10.2 Enable RLS on All Tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_decisions ENABLE ROW LEVEL SECURITY;

-- 10.3 RLS Policies: Profiles
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 10.4 RLS Policies: Templates & Plans (Public Read)
CREATE POLICY "templates_select_all" ON public.templates
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "template_versions_select_published" ON public.template_versions
  FOR SELECT TO authenticated, anon
  USING (status = 'PUBLISHED' OR status = 'TESTING');

CREATE POLICY "plans_select_active" ON public.plans
  FOR SELECT TO authenticated, anon
  USING (status = 'ACTIVE');

CREATE POLICY "addons_select_active" ON public.addons
  FOR SELECT TO authenticated, anon
  USING (status = 'ACTIVE');

-- 10.5 RLS Policies: Stores
CREATE POLICY "stores_select_member" ON public.stores
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.get_current_user_store_ids()));

CREATE POLICY "stores_insert_owner" ON public.stores
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "stores_update_admin" ON public.stores
  FOR UPDATE TO authenticated
  USING (
    id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(id) IN ('STORE_OWNER', 'STORE_ADMIN')
  );

-- 10.6 RLS Policies: Store Members
CREATE POLICY "store_members_select_member" ON public.store_members
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()));

CREATE POLICY "store_members_modify_admin" ON public.store_members
  FOR ALL TO authenticated
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  );

-- 10.7 RLS Policies: Subscriptions & Invoices
CREATE POLICY "subscriptions_select_member" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()));

CREATE POLICY "store_addons_select_member" ON public.store_addons
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()));

CREATE POLICY "invoices_select_member" ON public.invoices
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()));

CREATE POLICY "invoice_items_select_member" ON public.invoice_items
  FOR SELECT TO authenticated
  USING (invoice_id IN (SELECT id FROM public.invoices WHERE store_id IN (SELECT public.get_current_user_store_ids())));

CREATE POLICY "billing_payments_select_member" ON public.billing_payments
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()));

-- 10.8 RLS Policies: Commerce (Categories, Products)
CREATE POLICY "categories_select_tenant_or_public" ON public.categories
  FOR SELECT TO authenticated, anon
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    OR store_id IN (SELECT id FROM public.stores WHERE status = 'ACTIVE')
  );

CREATE POLICY "categories_modify_admin" ON public.categories
  FOR ALL TO authenticated
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  );

CREATE POLICY "products_select_tenant_or_public" ON public.products
  FOR SELECT TO authenticated, anon
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    OR (status = 'ACTIVE' AND store_id IN (SELECT id FROM public.stores WHERE status = 'ACTIVE'))
  );

CREATE POLICY "products_modify_admin" ON public.products
  FOR ALL TO authenticated
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  );

-- 10.9 RLS Policies: Inventory & Unique Items
CREATE POLICY "inventory_select_member" ON public.inventory
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()));

CREATE POLICY "inventory_modify_admin" ON public.inventory
  FOR ALL TO authenticated
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  );

CREATE POLICY "inventory_items_select_member" ON public.inventory_items
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()));

CREATE POLICY "inventory_items_modify_admin" ON public.inventory_items
  FOR ALL TO authenticated
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  );

-- 10.10 RLS Policies: Customers, Orders & Order Items
CREATE POLICY "customers_select_member" ON public.customers
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()));

CREATE POLICY "customers_modify_member" ON public.customers
  FOR ALL TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()));

CREATE POLICY "orders_select_member" ON public.orders
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()));

CREATE POLICY "orders_modify_member" ON public.orders
  FOR ALL TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()));

CREATE POLICY "order_items_select_member" ON public.order_items
  FOR SELECT TO authenticated
  USING (order_id IN (SELECT id FROM public.orders WHERE store_id IN (SELECT public.get_current_user_store_ids())));

CREATE POLICY "order_items_modify_member" ON public.order_items
  FOR ALL TO authenticated
  USING (order_id IN (SELECT id FROM public.orders WHERE store_id IN (SELECT public.get_current_user_store_ids())));

-- 10.11 RLS Policies: Vouchers
CREATE POLICY "vouchers_select_tenant_or_public" ON public.vouchers
  FOR SELECT TO authenticated, anon
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    OR (status = 'ACTIVE' AND store_id IN (SELECT id FROM public.stores WHERE status = 'ACTIVE'))
  );

CREATE POLICY "vouchers_modify_admin" ON public.vouchers
  FOR ALL TO authenticated
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  );

CREATE POLICY "voucher_redemptions_select_member" ON public.voucher_redemptions
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()));

-- 10.12 RLS Policies: Payment & Fulfillment
CREATE POLICY "payment_accounts_select_admin" ON public.payment_accounts
  FOR SELECT TO authenticated
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  );

CREATE POLICY "payment_accounts_modify_owner" ON public.payment_accounts
  FOR ALL TO authenticated
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) = 'STORE_OWNER'
  );

CREATE POLICY "payments_select_member" ON public.payments
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()));

CREATE POLICY "refunds_select_member" ON public.refunds
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()));

CREATE POLICY "fulfillments_select_member" ON public.fulfillments
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()));

CREATE POLICY "fulfillment_items_select_member" ON public.fulfillment_items
  FOR SELECT TO authenticated
  USING (fulfillment_id IN (SELECT id FROM public.fulfillments WHERE store_id IN (SELECT public.get_current_user_store_ids())));

-- 10.13 RLS Policies: Channels & Bots
CREATE POLICY "store_channels_select_member" ON public.store_channels
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()));

CREATE POLICY "store_channels_modify_admin" ON public.store_channels
  FOR ALL TO authenticated
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  );

CREATE POLICY "bots_select_member" ON public.bots
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()));

CREATE POLICY "bots_modify_admin" ON public.bots
  FOR ALL TO authenticated
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  );

-- 10.14 RLS Policies: Operations (Activity Logs, Support, Notifications)
CREATE POLICY "activity_logs_select_member" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()));

CREATE POLICY "support_tickets_select_member" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()));

CREATE POLICY "support_tickets_insert_member" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (store_id IN (SELECT public.get_current_user_store_ids()));

CREATE POLICY "notifications_select_recipient" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notification_preferences_manage_own" ON public.notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

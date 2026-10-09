-- ==============================================================================
-- BINTANG TECH STUDIO — M15 PRODUCTION PILOT HARDENING MIGRATION
-- Migration: 00003_production_pilot_hardening.sql
-- Purpose:
--   1. True Database Atomicity (Stored Procedures / RPCs with row locking FOR UPDATE)
--   2. Deterministic Lock Ordering (Deadlock elimination across multi-item operations)
--   3. Explicit Authorization Guards & Safe Search Path on SECURITY DEFINER RPCs
--   4. Durable Idempotency Records (PostgreSQL-backed deduplication & hash matching)
--   5. Durable App Sessions (Seller, Customer, Platform sessions in PostgreSQL)
--   6. Durable Queue Operations (Atomic claim_job and claim_outbox_event with SKIP LOCKED)
-- Baseline: Master Blueprint v3.0 / M02 Schema
-- ==============================================================================

-- ==============================================================================
-- 1. DURABLE IDEMPOTENCY RECORDS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.idempotency_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    scope TEXT NOT NULL CHECK (scope IN ('checkout', 'payment_command', 'fulfillment', 'billing', 'webhook', 'job')),
    idempotency_key TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
    response_payload JSONB,
    error_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Drop legacy non-store-scoped unique constraint/index if present
ALTER TABLE public.idempotency_records DROP CONSTRAINT IF EXISTS uq_idempotency_scope_key;
DROP INDEX IF EXISTS public.idx_idempotency_scope_key;

-- Tenant-safe store-scoped operations: isolates keys by store
CREATE UNIQUE INDEX IF NOT EXISTS uq_idempotency_store_scoped
    ON public.idempotency_records (store_id, scope, idempotency_key)
    WHERE store_id IS NOT NULL;

-- Global / internal operations (store_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_idempotency_global_scoped
    ON public.idempotency_records (scope, idempotency_key)
    WHERE store_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_idempotency_store_scope_key ON public.idempotency_records (store_id, scope, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_store_id ON public.idempotency_records (store_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at ON public.idempotency_records (expires_at);

-- Schema compatibility additions for orders and order_items
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount NUMERIC(15,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tax NUMERIC(15,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total NUMERIC(15,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS name_snapshot TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS price_snapshot NUMERIC(15,2);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS total NUMERIC(15,2);

ALTER TABLE public.idempotency_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_idempotency_service_role ON public.idempotency_records
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated tenant members can only access their store's tenant-scoped idempotency records
CREATE POLICY p_idempotency_tenant_isolation ON public.idempotency_records
    FOR ALL TO authenticated
    USING (
        store_id IS NOT NULL
        AND is_store_member(store_id)
        AND scope IN ('checkout', 'payment_command', 'fulfillment')
    )
    WITH CHECK (
        store_id IS NOT NULL
        AND is_store_member(store_id)
        AND scope IN ('checkout', 'payment_command', 'fulfillment')
    );

-- ==============================================================================
-- 2. DURABLE APP SESSIONS (BEARER TOKEN HASHED VIA SHA-256)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.app_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_type TEXT NOT NULL CHECK (session_type IN ('SELLER', 'CUSTOMER', 'PLATFORM')),
    token_hash TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    active_membership_id UUID REFERENCES public.store_members(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_token_hash ON public.app_sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_app_sessions_user_id ON public.app_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_store_id ON public.app_sessions (store_id);

ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_app_sessions_service_role ON public.app_sessions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY p_app_sessions_user_isolation ON public.app_sessions
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ==============================================================================
-- 3. TRUE DATABASE ATOMICITY: INVENTORY RPCs (WITH ROW-LEVEL LOCKING)
-- ==============================================================================

-- 3.0 Hardened is_store_member (with safe empty search_path)
CREATE OR REPLACE FUNCTION public.is_store_member(lookup_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.store_members
    WHERE store_id = lookup_store_id
      AND user_id = auth.uid()
      AND status = 'ACTIVE'
  );
$$;

-- 3.0b Canonical M04 Permission Verification Function
CREATE OR REPLACE FUNCTION public.has_store_permission(
    lookup_store_id UUID,
    required_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role
    FROM public.store_members
    WHERE store_id = lookup_store_id
      AND user_id = auth.uid()
      AND status = 'ACTIVE';

    IF v_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- STORE_OWNER has all store permissions per M04 policy
    IF v_role = 'STORE_OWNER' THEN
        RETURN TRUE;
    END IF;

    -- STORE_ADMIN has all store permissions EXCEPT 'subscription.manage'
    IF v_role = 'STORE_ADMIN' THEN
        RETURN (required_permission <> 'subscription.manage');
    END IF;

    -- STORE_STAFF has limited operational permissions per M04 policy
    IF v_role = 'STORE_STAFF' THEN
        RETURN required_permission IN (
            'products.read',
            'inventory.read',
            'orders.read',
            'orders.update',
            'customers.read',
            'vouchers.read',
            'fulfillment.read',
            'fulfillment.process',
            'fulfillment.complete'
        );
    END IF;

    RETURN FALSE;
END;
$$;

-- 3.1 Atomic Reserve Stock
CREATE OR REPLACE FUNCTION public.rpc_atomic_reserve_stock(
    p_store_id UUID,
    p_product_id UUID,
    p_amount INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_inv public.inventory%ROWTYPE;
    v_available INT;
BEGIN
    -- Authorization Guard: Caller must be service_role or an active store member
    IF COALESCE(auth.role(), '') = 'service_role' THEN
        IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id AND status = 'ACTIVE') THEN
            RAISE EXCEPTION 'Store % does not exist or is not active', p_store_id
                USING ERRCODE = 'P0002';
        END IF;
    ELSIF COALESCE(auth.role(), '') = 'authenticated' THEN
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'Unauthorized: Missing authenticated user identity'
                USING ERRCODE = '42501';
        END IF;
        IF NOT public.has_store_permission(p_store_id, 'inventory.update') THEN
            RAISE EXCEPTION 'Access denied: Caller % lacks inventory.update permission in store %', auth.uid(), p_store_id
                USING ERRCODE = '42501';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id AND status = 'ACTIVE') THEN
            RAISE EXCEPTION 'Store % does not exist or is not active', p_store_id
                USING ERRCODE = 'P0002';
        END IF;
    ELSE
        RAISE EXCEPTION 'Unauthorized: Role "%" is not permitted to execute store operations', COALESCE(auth.role(), 'anonymous')
            USING ERRCODE = '42501';
    END IF;

    -- Cross-store product validation
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id AND store_id = p_store_id) THEN
        RAISE EXCEPTION 'Product % does not belong to store %', p_product_id, p_store_id
            USING ERRCODE = 'P0002';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Reservation amount must be positive (got %)', p_amount
            USING ERRCODE = '22003';
    END IF;

    -- Lock inventory row exclusively for this transaction
    SELECT * INTO v_inv
    FROM public.inventory
    WHERE store_id = p_store_id AND product_id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory not found for product % in store %', p_product_id, p_store_id
            USING ERRCODE = 'P0002';
    END IF;

    v_available := v_inv.quantity_on_hand - v_inv.quantity_reserved;
    IF v_available < p_amount THEN
        RAISE EXCEPTION 'Insufficient stock for product %: requested %, available % (on_hand %, reserved %)',
            p_product_id, p_amount, v_available, v_inv.quantity_on_hand, v_inv.quantity_reserved
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.inventory
    SET quantity_reserved = quantity_reserved + p_amount,
        updated_at = pg_catalog.timezone('utc'::pg_catalog.text, pg_catalog.now())
    WHERE id = v_inv.id
    RETURNING * INTO v_inv;

    RETURN pg_catalog.to_jsonb(v_inv);
END;
$$;

-- 3.2 Atomic Release Stock
CREATE OR REPLACE FUNCTION public.rpc_atomic_release_stock(
    p_store_id UUID,
    p_product_id UUID,
    p_amount INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_inv public.inventory%ROWTYPE;
BEGIN
    -- Authorization Guard: Caller must be service_role or an active store member
    IF COALESCE(auth.role(), '') = 'service_role' THEN
        IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id AND status = 'ACTIVE') THEN
            RAISE EXCEPTION 'Store % does not exist or is not active', p_store_id
                USING ERRCODE = 'P0002';
        END IF;
    ELSIF COALESCE(auth.role(), '') = 'authenticated' THEN
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'Unauthorized: Missing authenticated user identity'
                USING ERRCODE = '42501';
        END IF;
        IF NOT public.has_store_permission(p_store_id, 'inventory.update') THEN
            RAISE EXCEPTION 'Access denied: Caller % lacks inventory.update permission in store %', auth.uid(), p_store_id
                USING ERRCODE = '42501';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id AND status = 'ACTIVE') THEN
            RAISE EXCEPTION 'Store % does not exist or is not active', p_store_id
                USING ERRCODE = 'P0002';
        END IF;
    ELSE
        RAISE EXCEPTION 'Unauthorized: Role "%" is not permitted to execute store operations', COALESCE(auth.role(), 'anonymous')
            USING ERRCODE = '42501';
    END IF;

    -- Cross-store product validation
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id AND store_id = p_store_id) THEN
        RAISE EXCEPTION 'Product % does not belong to store %', p_product_id, p_store_id
            USING ERRCODE = 'P0002';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Release amount must be positive (got %)', p_amount
            USING ERRCODE = '22003';
    END IF;

    SELECT * INTO v_inv
    FROM public.inventory
    WHERE store_id = p_store_id AND product_id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory not found for product % in store %', p_product_id, p_store_id
            USING ERRCODE = 'P0002';
    END IF;

    IF v_inv.quantity_reserved < p_amount THEN
        RAISE EXCEPTION 'Cannot release % units; only % currently reserved for product %',
            p_amount, v_inv.quantity_reserved, p_product_id
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.inventory
    SET quantity_reserved = quantity_reserved - p_amount,
        updated_at = pg_catalog.timezone('utc'::pg_catalog.text, pg_catalog.now())
    WHERE id = v_inv.id
    RETURNING * INTO v_inv;

    RETURN pg_catalog.to_jsonb(v_inv);
END;
$$;

-- 3.3 Atomic Consume Stock
CREATE OR REPLACE FUNCTION public.rpc_atomic_consume_stock(
    p_store_id UUID,
    p_product_id UUID,
    p_amount INT,
    p_from_reserved BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_inv public.inventory%ROWTYPE;
    v_available INT;
BEGIN
    -- Authorization Guard: Caller must be service_role or an active store member
    IF COALESCE(auth.role(), '') = 'service_role' THEN
        IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id AND status = 'ACTIVE') THEN
            RAISE EXCEPTION 'Store % does not exist or is not active', p_store_id
                USING ERRCODE = 'P0002';
        END IF;
    ELSIF COALESCE(auth.role(), '') = 'authenticated' THEN
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'Unauthorized: Missing authenticated user identity'
                USING ERRCODE = '42501';
        END IF;
        IF NOT public.has_store_permission(p_store_id, 'inventory.update') THEN
            RAISE EXCEPTION 'Access denied: Caller % lacks inventory.update permission in store %', auth.uid(), p_store_id
                USING ERRCODE = '42501';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id AND status = 'ACTIVE') THEN
            RAISE EXCEPTION 'Store % does not exist or is not active', p_store_id
                USING ERRCODE = 'P0002';
        END IF;
    ELSE
        RAISE EXCEPTION 'Unauthorized: Role "%" is not permitted to execute store operations', COALESCE(auth.role(), 'anonymous')
            USING ERRCODE = '42501';
    END IF;

    -- Cross-store product validation
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id AND store_id = p_store_id) THEN
        RAISE EXCEPTION 'Product % does not belong to store %', p_product_id, p_store_id
            USING ERRCODE = 'P0002';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Consumption amount must be positive (got %)', p_amount
            USING ERRCODE = '22003';
    END IF;

    SELECT * INTO v_inv
    FROM public.inventory
    WHERE store_id = p_store_id AND product_id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory not found for product % in store %', p_product_id, p_store_id
            USING ERRCODE = 'P0002';
    END IF;

    IF p_from_reserved THEN
        IF v_inv.quantity_reserved < p_amount THEN
            RAISE EXCEPTION 'Cannot consume % reserved units; only % reserved for product %',
                p_amount, v_inv.quantity_reserved, p_product_id
                USING ERRCODE = 'P0001';
        END IF;
        IF v_inv.quantity_on_hand < p_amount THEN
            RAISE EXCEPTION 'Cannot consume % units; only % on hand for product %',
                p_amount, v_inv.quantity_on_hand, p_product_id
                USING ERRCODE = 'P0001';
        END IF;

        UPDATE public.inventory
        SET quantity_on_hand = quantity_on_hand - p_amount,
            quantity_reserved = quantity_reserved - p_amount,
            updated_at = pg_catalog.timezone('utc'::pg_catalog.text, pg_catalog.now())
        WHERE id = v_inv.id
        RETURNING * INTO v_inv;
    ELSE
        v_available := v_inv.quantity_on_hand - v_inv.quantity_reserved;
        IF v_available < p_amount THEN
            RAISE EXCEPTION 'Insufficient stock to consume for product %: requested %, available %',
                p_product_id, p_amount, v_available
                USING ERRCODE = 'P0001';
        END IF;

        UPDATE public.inventory
        SET quantity_on_hand = quantity_on_hand - p_amount,
            updated_at = pg_catalog.timezone('utc'::pg_catalog.text, pg_catalog.now())
        WHERE id = v_inv.id
        RETURNING * INTO v_inv;
    END IF;

    RETURN pg_catalog.to_jsonb(v_inv);
END;
$$;

-- 3.4 Atomic Adjust Stock
CREATE OR REPLACE FUNCTION public.rpc_atomic_adjust_stock(
    p_store_id UUID,
    p_product_id UUID,
    p_adjustment_type TEXT,
    p_quantity INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_inv public.inventory%ROWTYPE;
    v_new_on_hand INT;
BEGIN
    -- Authorization Guard: Caller must be service_role or an active store member
    IF COALESCE(auth.role(), '') = 'service_role' THEN
        IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id AND status = 'ACTIVE') THEN
            RAISE EXCEPTION 'Store % does not exist or is not active', p_store_id
                USING ERRCODE = 'P0002';
        END IF;
    ELSIF COALESCE(auth.role(), '') = 'authenticated' THEN
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'Unauthorized: Missing authenticated user identity'
                USING ERRCODE = '42501';
        END IF;
        IF NOT public.has_store_permission(p_store_id, 'inventory.update') THEN
            RAISE EXCEPTION 'Access denied: Caller % lacks inventory.update permission in store %', auth.uid(), p_store_id
                USING ERRCODE = '42501';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id AND status = 'ACTIVE') THEN
            RAISE EXCEPTION 'Store % does not exist or is not active', p_store_id
                USING ERRCODE = 'P0002';
        END IF;
    ELSE
        RAISE EXCEPTION 'Unauthorized: Role "%" is not permitted to execute store operations', COALESCE(auth.role(), 'anonymous')
            USING ERRCODE = '42501';
    END IF;

    -- Cross-store product validation
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id AND store_id = p_store_id) THEN
        RAISE EXCEPTION 'Product % does not belong to store %', p_product_id, p_store_id
            USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_inv
    FROM public.inventory
    WHERE store_id = p_store_id AND product_id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory not found for product % in store %', p_product_id, p_store_id
            USING ERRCODE = 'P0002';
    END IF;

    CASE p_adjustment_type
        WHEN 'SET' THEN
            v_new_on_hand := p_quantity;
        WHEN 'INCREASE' THEN
            v_new_on_hand := v_inv.quantity_on_hand + p_quantity;
        WHEN 'DECREASE' THEN
            v_new_on_hand := v_inv.quantity_on_hand - p_quantity;
        ELSE
            RAISE EXCEPTION 'Unknown adjustment type: %', p_adjustment_type
                USING ERRCODE = '22023';
    END CASE;

    IF v_new_on_hand < 0 THEN
        RAISE EXCEPTION 'Quantity on hand cannot become negative (calculated %, current %)',
            v_new_on_hand, v_inv.quantity_on_hand
            USING ERRCODE = '22003';
    END IF;

    IF v_new_on_hand < v_inv.quantity_reserved THEN
        RAISE EXCEPTION 'Cannot reduce stock below currently reserved quantity (% < %)',
            v_new_on_hand, v_inv.quantity_reserved
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.inventory
    SET quantity_on_hand = v_new_on_hand,
        updated_at = pg_catalog.timezone('utc'::pg_catalog.text, pg_catalog.now())
    WHERE id = v_inv.id
    RETURNING * INTO v_inv;

    RETURN pg_catalog.to_jsonb(v_inv);
END;
$$;

-- ==============================================================================
-- 4. TRUE DATABASE ATOMICITY: ORDER CREATION RPC (WITH DETERMINISTIC LOCK ORDERING)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.rpc_create_order_atomic(
    p_store_id UUID,
    p_order JSONB,
    p_items JSONB,
    p_reserve_stock BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_order_id UUID;
    v_customer_id UUID;
    v_voucher_id UUID;
    v_voucher public.vouchers%ROWTYPE;
    v_order_number TEXT;
    v_currency TEXT;
    v_subtotal NUMERIC(15,2);
    v_discount NUMERIC(15,2);
    v_tax NUMERIC(15,2);
    v_total NUMERIC(15,2);
    v_status TEXT;
    v_metadata JSONB;
    v_item RECORD;
    v_item_id UUID;
    v_product_id UUID;
    v_quantity INT;
    v_name_snapshot TEXT;
    v_price_snapshot NUMERIC(15,2);
    v_item_total NUMERIC(15,2);
    v_item_metadata JSONB;
    v_created_order public.orders%ROWTYPE;
    v_created_items JSONB := '[]'::jsonb;
    v_item_row public.order_items%ROWTYPE;
    v_inv public.inventory%ROWTYPE;
    v_prod public.products%ROWTYPE;
    v_available INT;
    v_calc_subtotal NUMERIC(15,2) := 0.00;
    v_calc_discount NUMERIC(15,2) := 0.00;
    v_calc_total NUMERIC(15,2) := 0.00;
BEGIN
    -- Authorization Guard: Caller must be service_role or an active store member with orders.update permission
    IF COALESCE(auth.role(), '') = 'service_role' THEN
        IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id AND status = 'ACTIVE') THEN
            RAISE EXCEPTION 'Store % does not exist or is not active', p_store_id
                USING ERRCODE = 'P0002';
        END IF;
    ELSIF COALESCE(auth.role(), '') = 'authenticated' THEN
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'Unauthorized: Missing authenticated user identity'
                USING ERRCODE = '42501';
        END IF;
        IF NOT public.has_store_permission(p_store_id, 'orders.update') THEN
            RAISE EXCEPTION 'Access denied: Caller % lacks orders.update permission in store %', auth.uid(), p_store_id
                USING ERRCODE = '42501';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id AND status = 'ACTIVE') THEN
            RAISE EXCEPTION 'Store % does not exist or is not active', p_store_id
                USING ERRCODE = 'P0002';
        END IF;
    ELSE
        RAISE EXCEPTION 'Unauthorized: Role "%" is not permitted to execute store operations', COALESCE(auth.role(), 'anonymous')
            USING ERRCODE = '42501';
    END IF;

    -- Validate items non-empty
    IF p_items IS NULL OR pg_catalog.jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order items cannot be empty'
            USING ERRCODE = '22023';
    END IF;

    -- Constrain initial order status strictly to PENDING / PENDING_PAYMENT
    v_status := COALESCE(p_order->>'status', 'PENDING');
    IF v_status NOT IN ('PENDING', 'PENDING_PAYMENT') THEN
        RAISE EXCEPTION 'Invalid initial order status: % (orders cannot be created with terminal or non-pending status)', v_status
            USING ERRCODE = '22023';
    END IF;

    v_order_id := COALESCE((p_order->>'id')::uuid, pg_catalog.gen_random_uuid());
    v_customer_id := (p_order->>'customer_id')::uuid;
    v_voucher_id := (p_order->>'voucher_id')::uuid;
    v_order_number := COALESCE(p_order->>'order_number', 'ORD-' || pg_catalog.to_char(pg_catalog.now(), 'YYYYMMDD') || '-' || pg_catalog.substr(pg_catalog.gen_random_uuid()::text, 1, 8));
    v_currency := COALESCE(p_order->>'currency', 'IDR');
    v_metadata := COALESCE(p_order->'metadata', '{}'::jsonb);

    -- Customer validation (customer is strictly required by schema and must belong to store)
    IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'Customer ID is required for order creation'
            USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = v_customer_id AND store_id = p_store_id) THEN
        RAISE EXCEPTION 'Customer % does not belong to store %', v_customer_id, p_store_id
            USING ERRCODE = 'P0002';
    END IF;

    -- 1. Authoritative Pricing Calculation & Verification from public.products
    FOR v_item IN
        SELECT product_id, SUM(quantity)::int AS quantity
        FROM pg_catalog.jsonb_to_recordset(p_items) AS x(
            product_id UUID,
            quantity INT
        )
        WHERE product_id IS NOT NULL
        GROUP BY product_id
        ORDER BY product_id ASC
    LOOP
        IF v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'Item quantity must be positive for product % (got %)', v_item.product_id, v_item.quantity
                USING ERRCODE = '22023';
        END IF;

        SELECT * INTO v_prod
        FROM public.products
        WHERE id = v_item.product_id AND store_id = p_store_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product % does not belong to store %', v_item.product_id, p_store_id
                USING ERRCODE = 'P0002';
        END IF;

        IF v_prod.status <> 'ACTIVE' THEN
            RAISE EXCEPTION 'Product % is not active for purchase (status: %)', v_item.product_id, v_prod.status
                USING ERRCODE = 'P0001';
        END IF;

        v_calc_subtotal := v_calc_subtotal + (v_prod.price * v_item.quantity);

        -- If stock reservation is requested, lock inventory deterministically
        IF p_reserve_stock THEN
            SELECT * INTO v_inv
            FROM public.inventory
            WHERE store_id = p_store_id AND product_id = v_item.product_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Inventory not found for product % in store %', v_item.product_id, p_store_id
                    USING ERRCODE = 'P0002';
            END IF;

            v_available := v_inv.quantity_on_hand - v_inv.quantity_reserved;
            IF v_available < v_item.quantity THEN
                RAISE EXCEPTION 'Insufficient stock for product % during order checkout: requested %, available %',
                    v_item.product_id, v_item.quantity, v_available
                    USING ERRCODE = 'P0001';
            END IF;

            UPDATE public.inventory
            SET quantity_reserved = quantity_reserved + v_item.quantity,
                updated_at = pg_catalog.timezone('utc'::pg_catalog.text, pg_catalog.now())
            WHERE id = v_inv.id;
        END IF;
    END LOOP;

    -- Enforce subtotal integrity: client-supplied subtotal must match trusted calculation
    IF p_order ? 'subtotal' AND (p_order->>'subtotal')::numeric <> v_calc_subtotal THEN
        RAISE EXCEPTION 'Financial mismatch: client subtotal % does not match trusted product subtotal %',
            (p_order->>'subtotal')::numeric, v_calc_subtotal
            USING ERRCODE = 'P0001';
    END IF;
    v_subtotal := v_calc_subtotal;

    -- 2. Authoritative Voucher & Discount Derivation
    v_calc_discount := 0.00;
    IF v_voucher_id IS NOT NULL THEN
        -- Lock voucher row to eliminate race conditions on usage_limit under concurrent checkouts
        SELECT * INTO v_voucher
        FROM public.vouchers
        WHERE id = v_voucher_id AND store_id = p_store_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Voucher % not found in store %', v_voucher_id, p_store_id
                USING ERRCODE = 'P0002';
        END IF;

        IF v_voucher.status <> 'ACTIVE' THEN
            RAISE EXCEPTION 'Voucher % is not active (status: %)', v_voucher.code, v_voucher.status
                USING ERRCODE = 'P0001';
        END IF;

        IF v_voucher.starts_at > pg_catalog.timezone('utc'::pg_catalog.text, pg_catalog.now()) THEN
            RAISE EXCEPTION 'Voucher % is not yet active', v_voucher.code
                USING ERRCODE = 'P0001';
        END IF;

        IF v_voucher.expires_at IS NOT NULL AND v_voucher.expires_at <= pg_catalog.timezone('utc'::pg_catalog.text, pg_catalog.now()) THEN
            RAISE EXCEPTION 'Voucher % has expired', v_voucher.code
                USING ERRCODE = 'P0001';
        END IF;

        IF v_voucher.usage_limit IS NOT NULL AND v_voucher.used_count >= v_voucher.usage_limit THEN
            RAISE EXCEPTION 'Voucher % usage limit has been reached', v_voucher.code
                USING ERRCODE = 'P0001';
        END IF;

        IF v_calc_subtotal < v_voucher.minimum_purchase THEN
            RAISE EXCEPTION 'Order subtotal % does not meet voucher minimum purchase requirement %',
                v_calc_subtotal, v_voucher.minimum_purchase
                USING ERRCODE = 'P0001';
        END IF;

        IF v_voucher.discount_type = 'FIXED' THEN
            v_calc_discount := pg_catalog.least(v_voucher.discount_value, v_calc_subtotal);
        ELSIF v_voucher.discount_type = 'PERCENTAGE' THEN
            v_calc_discount := pg_catalog.round((v_calc_subtotal * (v_voucher.discount_value / 100.0)), 2);
            IF v_voucher.maximum_discount IS NOT NULL THEN
                v_calc_discount := pg_catalog.least(v_calc_discount, v_voucher.maximum_discount);
            END IF;
            v_calc_discount := pg_catalog.least(v_calc_discount, v_calc_subtotal);
        ELSE
            RAISE EXCEPTION 'Unknown voucher discount type: %', v_voucher.discount_type
                USING ERRCODE = '22023';
        END IF;

        -- Atomically increment voucher used count with concurrency guard
        UPDATE public.vouchers
        SET used_count = used_count + 1,
            updated_at = pg_catalog.timezone('utc'::pg_catalog.text, pg_catalog.now())
        WHERE id = v_voucher.id
          AND (usage_limit IS NULL OR used_count < usage_limit);

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Voucher % usage limit has been reached', v_voucher.code
                USING ERRCODE = 'P0001';
        END IF;
    ELSE
        -- No voucher supplied: reject any arbitrary client-supplied discount
        IF (p_order ? 'discount') AND (p_order->>'discount')::numeric > 0.00 THEN
            RAISE EXCEPTION 'Discount applied without a valid eligible voucher: client claimed discount % without voucher_id',
                (p_order->>'discount')::numeric
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- Enforce discount integrity: client discount must match authoritative calculation
    IF (p_order ? 'discount') AND (p_order->>'discount')::numeric <> v_calc_discount THEN
        RAISE EXCEPTION 'Financial mismatch: client discount % does not match authoritative voucher valuation %',
            (p_order->>'discount')::numeric, v_calc_discount
            USING ERRCODE = 'P0001';
    END IF;
    v_discount := v_calc_discount;

    -- 3. Tax Policy Enforcement (No untrusted client tax overrides permitted)
    IF (p_order ? 'tax') AND (p_order->>'tax')::numeric <> 0.00 THEN
        RAISE EXCEPTION 'Untrusted tax override rejected: catalog prices are tax-inclusive (tax must be 0.00, got %)',
            (p_order->>'tax')::numeric
            USING ERRCODE = 'P0001';
    END IF;
    v_tax := 0.00;

    -- 4. Authoritative Total Derivation & Validation
    v_calc_total := v_calc_subtotal - v_discount + v_tax;
    IF v_calc_total < 0.00 THEN
        RAISE EXCEPTION 'Calculated order total cannot be negative (calculated %)', v_calc_total
            USING ERRCODE = '22003';
    END IF;

    IF (p_order ? 'total') AND (p_order->>'total')::numeric <> v_calc_total THEN
        RAISE EXCEPTION 'Financial mismatch: client total % does not match trusted calculation %',
            (p_order->>'total')::numeric, v_calc_total
            USING ERRCODE = 'P0001';
    END IF;
    v_total := v_calc_total;

    -- 5. Insert order header (populating both legacy and extended financial columns)
    INSERT INTO public.orders (
        id,
        store_id,
        customer_id,
        voucher_id,
        order_number,
        currency,
        subtotal,
        discount,
        discount_total,
        tax,
        total,
        grand_total,
        status,
        metadata
    ) VALUES (
        v_order_id,
        p_store_id,
        v_customer_id,
        v_voucher_id,
        v_order_number,
        v_currency,
        v_subtotal,
        v_discount,
        v_discount,
        v_tax,
        v_total,
        v_total,
        v_status,
        v_metadata
    ) RETURNING * INTO v_created_order;

    -- 5b. Record voucher redemption (order row now exists, satisfying foreign key fk_voucher_redemptions_store_order)
    IF v_voucher_id IS NOT NULL THEN
        INSERT INTO public.voucher_redemptions (
            voucher_id,
            store_id,
            customer_id,
            order_id,
            discount_amount
        ) VALUES (
            v_voucher_id,
            p_store_id,
            v_customer_id,
            v_order_id,
            v_calc_discount
        );
    END IF;

    -- 6. Insert order items with authoritative snapshots from public.products
    FOR v_item IN SELECT * FROM pg_catalog.jsonb_to_recordset(p_items) AS x(
        id UUID,
        product_id UUID,
        quantity INT,
        metadata JSONB
    )
    LOOP
        v_item_id := COALESCE(v_item.id, pg_catalog.gen_random_uuid());
        v_product_id := v_item.product_id;
        v_quantity := v_item.quantity;
        v_item_metadata := COALESCE(v_item.metadata, '{}'::jsonb);

        -- Fetch authoritative product details for immutable line item snapshot
        SELECT * INTO v_prod
        FROM public.products
        WHERE id = v_product_id AND store_id = p_store_id;

        v_name_snapshot := v_prod.name;
        v_price_snapshot := v_prod.price;
        v_item_total := v_prod.price * v_quantity;

        INSERT INTO public.order_items (
            id,
            store_id,
            order_id,
            product_id,
            product_name,
            name_snapshot,
            price_snapshot,
            unit_price,
            quantity,
            subtotal,
            total,
            metadata
        ) VALUES (
            v_item_id,
            p_store_id,
            v_order_id,
            v_product_id,
            v_name_snapshot,
            v_name_snapshot,
            v_price_snapshot,
            v_price_snapshot,
            v_quantity,
            v_item_total,
            v_item_total,
            v_item_metadata
        ) RETURNING * INTO v_item_row;

        v_created_items := v_created_items || pg_catalog.jsonb_build_array(pg_catalog.to_jsonb(v_item_row));
    END LOOP;

    RETURN pg_catalog.jsonb_build_object(
        'order', pg_catalog.to_jsonb(v_created_order),
        'items', v_created_items
    );
END;
$$;

-- ==============================================================================
-- 5. TRUE DATABASE ATOMICITY: ORDER CANCELLATION RPC (RELEASING RESERVATIONS)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.rpc_cancel_order_atomic(
    p_store_id UUID,
    p_order_id UUID,
    p_reason TEXT DEFAULT 'Cancelled'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_item RECORD;
    v_inv public.inventory%ROWTYPE;
BEGIN
    -- Authorization Guard: Caller must be service_role or an active store member
    IF COALESCE(auth.role(), '') = 'service_role' THEN
        IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id AND status = 'ACTIVE') THEN
            RAISE EXCEPTION 'Store % does not exist or is not active', p_store_id
                USING ERRCODE = 'P0002';
        END IF;
    ELSIF COALESCE(auth.role(), '') = 'authenticated' THEN
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'Unauthorized: Missing authenticated user identity'
                USING ERRCODE = '42501';
        END IF;
        IF NOT public.has_store_permission(p_store_id, 'orders.cancel') THEN
            RAISE EXCEPTION 'Access denied: Caller % lacks orders.cancel permission in store %', auth.uid(), p_store_id
                USING ERRCODE = '42501';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id AND status = 'ACTIVE') THEN
            RAISE EXCEPTION 'Store % does not exist or is not active', p_store_id
                USING ERRCODE = 'P0002';
        END IF;
    ELSE
        RAISE EXCEPTION 'Unauthorized: Role "%" is not permitted to execute store operations', COALESCE(auth.role(), 'anonymous')
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_order
    FROM public.orders
    WHERE store_id = p_store_id AND id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found: %', p_order_id USING ERRCODE = 'P0002';
    END IF;

    IF v_order.status IN ('CANCELLED', 'EXPIRED') THEN
        -- Idempotent return if already cancelled
        RETURN pg_catalog.to_jsonb(v_order);
    END IF;

    IF v_order.status NOT IN ('PENDING', 'PROCESSING', 'PAYMENT_FAILED') THEN
        RAISE EXCEPTION 'Cannot cancel order % with status %', p_order_id, v_order.status
            USING ERRCODE = 'P0001';
    END IF;

    -- Release reservations in deterministic sorted order
    FOR v_item IN
        SELECT product_id, SUM(quantity)::int AS quantity
        FROM public.order_items
        WHERE store_id = p_store_id AND order_id = p_order_id AND product_id IS NOT NULL AND quantity > 0
        GROUP BY product_id
        ORDER BY product_id ASC
    LOOP
        SELECT * INTO v_inv
        FROM public.inventory
        WHERE store_id = p_store_id AND product_id = v_item.product_id
        FOR UPDATE;

        IF FOUND THEN
            UPDATE public.inventory
            SET quantity_reserved = pg_catalog.greatest(0, quantity_reserved - v_item.quantity),
                updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
            WHERE id = v_inv.id;
        END IF;
    END LOOP;

    UPDATE public.orders
    SET status = 'CANCELLED',
        metadata = pg_catalog.jsonb_set(COALESCE(metadata, '{}'::jsonb), '{cancel_reason}', pg_catalog.to_jsonb(p_reason)),
        updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
    WHERE id = p_order_id
    RETURNING * INTO v_order;

    RETURN pg_catalog.to_jsonb(v_order);
END;
$$;

-- ==============================================================================
-- 6. TRUE DATABASE ATOMICITY: FULFILLMENT CREATION RPC (CONSUMING RESERVED STOCK)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.rpc_create_fulfillment_atomic(
    p_store_id UUID,
    p_fulfillment JSONB,
    p_items JSONB,
    p_consume_stock BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_fulfillment_id UUID;
    v_order_id UUID;
    v_strategy TEXT;
    v_status TEXT;
    v_tracking_info JSONB;
    v_delivery_payload JSONB;
    v_created_fulfillment public.fulfillments%ROWTYPE;
    v_created_items JSONB := '[]'::jsonb;
    v_item RECORD;
    v_item_id UUID;
    v_order_item_id UUID;
    v_inv_item_id UUID;
    v_item_status TEXT;
    v_delivered_ref TEXT;
    v_item_row public.fulfillment_items%ROWTYPE;
    v_order_item public.order_items%ROWTYPE;
    v_order public.orders%ROWTYPE;
    v_inv public.inventory%ROWTYPE;
    v_inv_lock RECORD;
BEGIN
    -- Authorization Guard: Caller must be service_role or an active store member
    IF COALESCE(auth.role(), '') = 'service_role' THEN
        IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id AND status = 'ACTIVE') THEN
            RAISE EXCEPTION 'Store % does not exist or is not active', p_store_id
                USING ERRCODE = 'P0002';
        END IF;
    ELSIF COALESCE(auth.role(), '') = 'authenticated' THEN
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'Unauthorized: Missing authenticated user identity'
                USING ERRCODE = '42501';
        END IF;
        IF NOT public.has_store_permission(p_store_id, 'fulfillment.process') THEN
            RAISE EXCEPTION 'Access denied: Caller % lacks permission fulfillment.process for store %', auth.uid(), p_store_id
                USING ERRCODE = '42501';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id AND status = 'ACTIVE') THEN
            RAISE EXCEPTION 'Store % does not exist or is not active', p_store_id
                USING ERRCODE = 'P0002';
        END IF;
    ELSE
        RAISE EXCEPTION 'Unauthorized: Role "%" is not permitted to execute store operations', COALESCE(auth.role(), 'anonymous')
            USING ERRCODE = '42501';
    END IF;

    v_fulfillment_id := COALESCE((p_fulfillment->>'id')::uuid, pg_catalog.gen_random_uuid());
    v_order_id := (p_fulfillment->>'order_id')::uuid;
    v_strategy := COALESCE(p_fulfillment->>'strategy', p_fulfillment->>'fulfillment_type', 'DIGITAL_AUTO');
    v_status := 'FULFILLED';
    v_tracking_info := COALESCE(p_fulfillment->'tracking_info', '{}'::jsonb);
    v_delivery_payload := pg_catalog.jsonb_build_object(
        'trackingInfo', v_tracking_info,
        'metadata', COALESCE(p_fulfillment->'metadata', '{}'::jsonb)
    );

    -- 0. Lock order row first to prevent duplicate concurrent fulfillments
    SELECT * INTO v_order
    FROM public.orders
    WHERE store_id = p_store_id AND id = v_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found in store %', v_order_id, p_store_id
            USING ERRCODE = 'P0002';
    END IF;

    IF v_order.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Cannot fulfill cancelled order %', v_order_id
            USING ERRCODE = 'P0001';
    END IF;

    IF v_order.status NOT IN ('PAID', 'PROCESSING') THEN
        RAISE EXCEPTION 'Cannot fulfill order % with status %: order must be PAID or PROCESSING', v_order_id, v_order.status
            USING ERRCODE = 'P0001';
    END IF;

    IF COALESCE(v_order.metadata->>'fulfillmentStatus', '') = 'FULFILLED' THEN
        RAISE EXCEPTION 'Order % has already been fulfilled', v_order_id
            USING ERRCODE = 'P0001';
    END IF;

    -- 1. Pre-lock all inventory rows in deterministic sorted order (ORDER BY product_id ASC)
    IF p_consume_stock THEN
        FOR v_inv_lock IN
            SELECT oi.product_id, SUM(oi.quantity)::int AS quantity
            FROM pg_catalog.jsonb_to_recordset(p_items) AS x(
                order_item_id UUID
            )
            JOIN public.order_items oi ON oi.id = x.order_item_id
            WHERE oi.store_id = p_store_id AND oi.order_id = v_order_id AND oi.product_id IS NOT NULL
            GROUP BY oi.product_id
            ORDER BY oi.product_id ASC
        LOOP
            SELECT * INTO v_inv
            FROM public.inventory
            WHERE store_id = p_store_id AND product_id = v_inv_lock.product_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Inventory not found for product % in store %', v_inv_lock.product_id, p_store_id
                    USING ERRCODE = 'P0002';
            END IF;

            IF v_inv.quantity_reserved < v_inv_lock.quantity OR v_inv.quantity_on_hand < v_inv_lock.quantity THEN
                RAISE EXCEPTION 'Cannot consume stock for product %: insufficient reserved (%) or on-hand (%) for quantity %',
                    v_inv_lock.product_id, v_inv.quantity_reserved, v_inv.quantity_on_hand, v_inv_lock.quantity
                    USING ERRCODE = 'P0001';
            END IF;

            UPDATE public.inventory
            SET quantity_on_hand = quantity_on_hand - v_inv_lock.quantity,
                quantity_reserved = quantity_reserved - v_inv_lock.quantity,
                updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
            WHERE id = v_inv.id;
        END LOOP;
    END IF;

    -- 2. Insert fulfillment header
    INSERT INTO public.fulfillments (
        id,
        store_id,
        order_id,
        strategy,
        status,
        tracking_info,
        metadata
    ) VALUES (
        v_fulfillment_id,
        p_store_id,
        v_order_id,
        v_strategy,
        v_status,
        v_tracking_info,
        v_delivery_payload
    ) RETURNING * INTO v_created_fulfillment;

    -- 3. Insert fulfillment items and assign credentials
    FOR v_item IN SELECT * FROM pg_catalog.jsonb_to_recordset(p_items) AS x(
        id UUID,
        order_item_id UUID,
        inventory_item_id UUID,
        status TEXT,
        payload_reference TEXT
    )
    LOOP
        v_item_id := COALESCE(v_item.id, pg_catalog.gen_random_uuid());
        v_order_item_id := v_item.order_item_id;
        v_inv_item_id := v_item.inventory_item_id;
        v_item_status := COALESCE(v_item.status, 'DELIVERED');
        v_delivered_ref := v_item.payload_reference;

        -- Verify order item exists and belongs to this order
        SELECT * INTO v_order_item
        FROM public.order_items
        WHERE store_id = p_store_id AND id = v_order_item_id AND order_id = v_order_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Order item % does not belong to order %', v_order_item_id, v_order_id
                USING ERRCODE = 'P0001';
        END IF;

        INSERT INTO public.fulfillment_items (
            id,
            fulfillment_id,
            order_item_id,
            inventory_item_id,
            status,
            payload_reference,
            store_id
        ) VALUES (
            v_item_id,
            v_fulfillment_id,
            v_order_item_id,
            v_inv_item_id,
            v_item_status,
            v_delivered_ref,
            p_store_id
        ) RETURNING * INTO v_item_row;

        v_created_items := v_created_items || pg_catalog.jsonb_build_array(pg_catalog.to_jsonb(v_item_row));

        -- If an inventory_item_id was fulfilled, mark inventory_items status as ASSIGNED
        IF v_inv_item_id IS NOT NULL THEN
            UPDATE public.inventory_items
            SET status = 'ASSIGNED',
                assigned_order_id = v_order_id
            WHERE store_id = p_store_id AND id = v_inv_item_id;
        END IF;
    END LOOP;

    -- 4. Update order fulfillment status in order metadata and order status to FULFILLED
    UPDATE public.orders
    SET status = 'FULFILLED',
        metadata = pg_catalog.jsonb_set(COALESCE(metadata, '{}'::jsonb), '{fulfillmentStatus}', '"FULFILLED"'::jsonb),
        updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
    WHERE id = v_order_id;

    RETURN pg_catalog.jsonb_build_object(
        'fulfillment', pg_catalog.to_jsonb(v_created_fulfillment),
        'items', v_created_items
    );
END;
$$;

-- ==============================================================================
-- 7. ATOMIC QUEUE WORKER RPCs
-- ==============================================================================

-- 7.1 Atomic Claim Job
CREATE OR REPLACE FUNCTION public.rpc_claim_job(
    p_queue_name TEXT DEFAULT 'default',
    p_lock_duration_seconds INT DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_job public.jobs%ROWTYPE;
BEGIN
    -- Authorization Guard: Worker queues are strictly internal/service_role
    IF COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: Only service_role can claim background tasks'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_job
    FROM public.jobs
    WHERE queue_name = p_queue_name
      AND status IN ('QUEUED', 'FAILED')
      AND attempts < max_attempts
      AND (locked_until IS NULL OR locked_until < pg_catalog.timezone('utc'::text, pg_catalog.now()))
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    UPDATE public.jobs
    SET status = 'RUNNING',
        attempts = attempts + 1,
        locked_until = pg_catalog.timezone('utc'::text, pg_catalog.now()) + (p_lock_duration_seconds || ' seconds')::interval
    WHERE id = v_job.id
    RETURNING * INTO v_job;

    RETURN pg_catalog.to_jsonb(v_job);
END;
$$;

-- 7.2 Atomic Claim Outbox Event
CREATE OR REPLACE FUNCTION public.rpc_claim_outbox_event(
    p_lock_duration_seconds INT DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_evt public.outbox_events%ROWTYPE;
BEGIN
    -- Authorization Guard: Worker queues are strictly internal/service_role
    IF COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: Only service_role can claim background tasks'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_evt
    FROM public.outbox_events
    WHERE status IN ('PENDING', 'FAILED')
      AND attempts < 5
      AND (locked_until IS NULL OR locked_until < pg_catalog.timezone('utc'::text, pg_catalog.now()))
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    UPDATE public.outbox_events
    SET status = 'PROCESSING',
        attempts = attempts + 1,
        locked_until = pg_catalog.timezone('utc'::text, pg_catalog.now()) + (p_lock_duration_seconds || ' seconds')::interval
    WHERE id = v_evt.id
    RETURNING * INTO v_evt;

    RETURN pg_catalog.to_jsonb(v_evt);
END;
$$;

-- ==============================================================================
-- 8. EXPLICIT PRIVILEGE MANAGEMENT (NO DEFAULT PUBLIC EXECUTE)
-- ==============================================================================

-- Revoke execute from public & anonymous users on all hardened RPCs
REVOKE EXECUTE ON FUNCTION public.rpc_atomic_reserve_stock(UUID, UUID, INT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_atomic_release_stock(UUID, UUID, INT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_atomic_consume_stock(UUID, UUID, INT, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_atomic_adjust_stock(UUID, UUID, TEXT, INT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_create_order_atomic(UUID, JSONB, JSONB, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_cancel_order_atomic(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_create_fulfillment_atomic(UUID, JSONB, JSONB, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_claim_job(TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_claim_outbox_event(INT) FROM PUBLIC, anon, authenticated;

-- Grant execution to authorized roles
GRANT EXECUTE ON FUNCTION public.rpc_atomic_reserve_stock(UUID, UUID, INT) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_atomic_release_stock(UUID, UUID, INT) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_atomic_consume_stock(UUID, UUID, INT, BOOLEAN) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_atomic_adjust_stock(UUID, UUID, TEXT, INT) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_create_order_atomic(UUID, JSONB, JSONB, BOOLEAN) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_order_atomic(UUID, UUID, TEXT) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_create_fulfillment_atomic(UUID, JSONB, JSONB, BOOLEAN) TO service_role, authenticated;

-- Background queues are strictly internal/service_role
GRANT EXECUTE ON FUNCTION public.rpc_claim_job(TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_claim_outbox_event(INT) TO service_role;

-- Helper functions access control
REVOKE ALL ON FUNCTION public.is_store_member(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_store_permission(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_store_member(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_store_permission(UUID, TEXT) TO authenticated, service_role;

-- Table-level privileges on new tables introduced in M15
REVOKE ALL ON public.idempotency_records FROM anon, PUBLIC;
REVOKE ALL ON public.app_sessions FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.idempotency_records TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_sessions TO authenticated, service_role;

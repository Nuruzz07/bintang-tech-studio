-- ==============================================================================
-- BINTANG TECH STUDIO — M02 DATABASE FOUNDATION FOLLOW-UP MIGRATION
-- Migration: 00002_harden_cross_tenant_integrity_and_rls.sql / 20261007142000_harden_cross_tenant_integrity_and_rls.sql
-- Purpose:
--   1. Cross-Tenant Referential Integrity (Composite Foreign Keys)
--   2. Store Owner Invariant (Automatic provisioning & immutable owner protection)
--   3. Customer Public Catalog RLS Hardening (Scoped to explicit store context)
--   4. RLS WITH CHECK Hardening & Anti-Tenant-Mutation triggers
-- ==============================================================================

-- ==============================================================================
-- 1. ADD MISSING store_id COLUMNS TO CHILD TABLES
-- ==============================================================================

-- 1.1 order_items: Add direct store_id for composite integrity & RLS isolation
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_order_items_store_id ON public.order_items (store_id);

-- 1.2 fulfillment_items: Add direct store_id
ALTER TABLE public.fulfillment_items
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_fulfillment_items_store_id ON public.fulfillment_items (store_id);

-- 1.3 invoice_items: Add direct store_id
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_invoice_items_store_id ON public.invoice_items (store_id);

-- 1.4 payment_events: Add store_id for optional tenant association
ALTER TABLE public.payment_events
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payment_events_store_id ON public.payment_events (store_id);

-- ==============================================================================
-- 2. COMPOSITE UNIQUE KEYS ON (store_id, id) FOR ALL TENANT PARENT TABLES
-- ==============================================================================

ALTER TABLE public.categories ADD CONSTRAINT uq_categories_store_id UNIQUE (store_id, id);
ALTER TABLE public.products ADD CONSTRAINT uq_products_store_id UNIQUE (store_id, id);
ALTER TABLE public.inventory ADD CONSTRAINT uq_inventory_store_id UNIQUE (store_id, id);
ALTER TABLE public.inventory_items ADD CONSTRAINT uq_inventory_items_store_id UNIQUE (store_id, id);
ALTER TABLE public.customers ADD CONSTRAINT uq_customers_store_id UNIQUE (store_id, id);
ALTER TABLE public.orders ADD CONSTRAINT uq_orders_store_id UNIQUE (store_id, id);
ALTER TABLE public.order_items ADD CONSTRAINT uq_order_items_store_id UNIQUE (store_id, id);
ALTER TABLE public.vouchers ADD CONSTRAINT uq_vouchers_store_id UNIQUE (store_id, id);
ALTER TABLE public.payment_accounts ADD CONSTRAINT uq_payment_accounts_store_id UNIQUE (store_id, id);
ALTER TABLE public.payments ADD CONSTRAINT uq_payments_store_id UNIQUE (store_id, id);
ALTER TABLE public.fulfillments ADD CONSTRAINT uq_fulfillments_store_id UNIQUE (store_id, id);
ALTER TABLE public.subscriptions ADD CONSTRAINT uq_subscriptions_store_id UNIQUE (store_id, id);
ALTER TABLE public.invoices ADD CONSTRAINT uq_invoices_store_id UNIQUE (store_id, id);

-- ==============================================================================
-- 3. COMPOSITE FOREIGN KEYS (ENFORCING CROSS-TENANT INTEGRITY)
-- ==============================================================================

-- 3.1 Products -> Categories (category must belong to same store)
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_id_fkey;
ALTER TABLE public.products
  ADD CONSTRAINT fk_products_store_category
  FOREIGN KEY (store_id, category_id) REFERENCES public.categories(store_id, id) ON DELETE SET NULL;

-- 3.2 Inventory -> Products (product must belong to same store)
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_product_id_fkey;
ALTER TABLE public.inventory
  ADD CONSTRAINT fk_inventory_store_product
  FOREIGN KEY (store_id, product_id) REFERENCES public.products(store_id, id) ON DELETE CASCADE;

-- 3.3 Inventory Items -> Products, Inventory, Orders
ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_product_id_fkey;
ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_inventory_id_fkey;
ALTER TABLE public.inventory_items
  ADD CONSTRAINT fk_inventory_items_store_product
  FOREIGN KEY (store_id, product_id) REFERENCES public.products(store_id, id) ON DELETE CASCADE;
ALTER TABLE public.inventory_items
  ADD CONSTRAINT fk_inventory_items_store_inventory
  FOREIGN KEY (store_id, inventory_id) REFERENCES public.inventory(store_id, id) ON DELETE SET NULL;
ALTER TABLE public.inventory_items
  ADD CONSTRAINT fk_inventory_items_store_reserved_order
  FOREIGN KEY (store_id, reserved_order_id) REFERENCES public.orders(store_id, id) ON DELETE SET NULL;
ALTER TABLE public.inventory_items
  ADD CONSTRAINT fk_inventory_items_store_assigned_order
  FOREIGN KEY (store_id, assigned_order_id) REFERENCES public.orders(store_id, id) ON DELETE SET NULL;

-- 3.4 Orders -> Customers & Vouchers (customer and voucher must belong to same store)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;
ALTER TABLE public.orders
  ADD CONSTRAINT fk_orders_store_customer
  FOREIGN KEY (store_id, customer_id) REFERENCES public.customers(store_id, id) ON DELETE RESTRICT;
ALTER TABLE public.orders
  ADD CONSTRAINT fk_orders_store_voucher
  FOREIGN KEY (store_id, voucher_id) REFERENCES public.vouchers(store_id, id) ON DELETE SET NULL;

-- 3.5 Order Items -> Orders & Products
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE public.order_items
  ADD CONSTRAINT fk_order_items_store_order
  FOREIGN KEY (store_id, order_id) REFERENCES public.orders(store_id, id) ON DELETE CASCADE;
ALTER TABLE public.order_items
  ADD CONSTRAINT fk_order_items_store_product
  FOREIGN KEY (store_id, product_id) REFERENCES public.products(store_id, id) ON DELETE SET NULL;

-- 3.6 Voucher Redemptions -> Vouchers, Customers, Orders
ALTER TABLE public.voucher_redemptions DROP CONSTRAINT IF EXISTS voucher_redemptions_voucher_id_fkey;
ALTER TABLE public.voucher_redemptions DROP CONSTRAINT IF EXISTS voucher_redemptions_customer_id_fkey;
ALTER TABLE public.voucher_redemptions DROP CONSTRAINT IF EXISTS voucher_redemptions_order_id_fkey;
ALTER TABLE public.voucher_redemptions
  ADD CONSTRAINT fk_voucher_redemptions_store_voucher
  FOREIGN KEY (store_id, voucher_id) REFERENCES public.vouchers(store_id, id) ON DELETE CASCADE;
ALTER TABLE public.voucher_redemptions
  ADD CONSTRAINT fk_voucher_redemptions_store_customer
  FOREIGN KEY (store_id, customer_id) REFERENCES public.customers(store_id, id) ON DELETE CASCADE;
ALTER TABLE public.voucher_redemptions
  ADD CONSTRAINT fk_voucher_redemptions_store_order
  FOREIGN KEY (store_id, order_id) REFERENCES public.orders(store_id, id) ON DELETE CASCADE;

-- 3.7 Payments -> Orders & Payment Accounts
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_order_id_fkey;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_account_id_fkey;
ALTER TABLE public.payments
  ADD CONSTRAINT fk_payments_store_order
  FOREIGN KEY (store_id, order_id) REFERENCES public.orders(store_id, id) ON DELETE CASCADE;
ALTER TABLE public.payments
  ADD CONSTRAINT fk_payments_store_payment_account
  FOREIGN KEY (store_id, payment_account_id) REFERENCES public.payment_accounts(store_id, id) ON DELETE SET NULL;

-- 3.8 Refunds -> Payments & Orders
ALTER TABLE public.refunds DROP CONSTRAINT IF EXISTS refunds_payment_id_fkey;
ALTER TABLE public.refunds DROP CONSTRAINT IF EXISTS refunds_order_id_fkey;
ALTER TABLE public.refunds
  ADD CONSTRAINT fk_refunds_store_payment
  FOREIGN KEY (store_id, payment_id) REFERENCES public.payments(store_id, id) ON DELETE CASCADE;
ALTER TABLE public.refunds
  ADD CONSTRAINT fk_refunds_store_order
  FOREIGN KEY (store_id, order_id) REFERENCES public.orders(store_id, id) ON DELETE CASCADE;

-- 3.9 Fulfillments -> Orders
ALTER TABLE public.fulfillments DROP CONSTRAINT IF EXISTS fulfillments_order_id_fkey;
ALTER TABLE public.fulfillments
  ADD CONSTRAINT fk_fulfillments_store_order
  FOREIGN KEY (store_id, order_id) REFERENCES public.orders(store_id, id) ON DELETE CASCADE;

-- 3.10 Fulfillment Items -> Fulfillments, Order Items, Inventory Items
ALTER TABLE public.fulfillment_items DROP CONSTRAINT IF EXISTS fulfillment_items_fulfillment_id_fkey;
ALTER TABLE public.fulfillment_items DROP CONSTRAINT IF EXISTS fulfillment_items_order_item_id_fkey;
ALTER TABLE public.fulfillment_items DROP CONSTRAINT IF EXISTS fulfillment_items_inventory_item_id_fkey;
ALTER TABLE public.fulfillment_items
  ADD CONSTRAINT fk_fulfillment_items_store_fulfillment
  FOREIGN KEY (store_id, fulfillment_id) REFERENCES public.fulfillments(store_id, id) ON DELETE CASCADE;
ALTER TABLE public.fulfillment_items
  ADD CONSTRAINT fk_fulfillment_items_store_order_item
  FOREIGN KEY (store_id, order_item_id) REFERENCES public.order_items(store_id, id) ON DELETE CASCADE;
ALTER TABLE public.fulfillment_items
  ADD CONSTRAINT fk_fulfillment_items_store_inv_item
  FOREIGN KEY (store_id, inventory_item_id) REFERENCES public.inventory_items(store_id, id) ON DELETE SET NULL;

-- Invariant Trigger: fulfillment_items.order_item_id must belong to fulfillment.order_id
CREATE OR REPLACE FUNCTION public.check_fulfillment_item_order_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_fulfillment_order_id UUID;
  v_item_order_id UUID;
BEGIN
  SELECT order_id INTO v_fulfillment_order_id FROM public.fulfillments WHERE id = NEW.fulfillment_id;
  SELECT order_id INTO v_item_order_id FROM public.order_items WHERE id = NEW.order_item_id;
  IF v_fulfillment_order_id IS DISTINCT FROM v_item_order_id THEN
    RAISE EXCEPTION 'Cross-order fulfillment item rejected: order_item (%) belongs to order (%) but fulfillment belongs to order (%)',
      NEW.order_item_id, v_item_order_id, v_fulfillment_order_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fulfillment_item_order_match ON public.fulfillment_items;
CREATE TRIGGER trg_fulfillment_item_order_match
  BEFORE INSERT OR UPDATE ON public.fulfillment_items
  FOR EACH ROW EXECUTE FUNCTION public.check_fulfillment_item_order_match();

-- 3.11 Invoices -> Subscriptions
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_subscription_id_fkey;
ALTER TABLE public.invoices
  ADD CONSTRAINT fk_invoices_store_subscription
  FOREIGN KEY (store_id, subscription_id) REFERENCES public.subscriptions(store_id, id) ON DELETE SET NULL;

-- 3.12 Invoice Items -> Invoices
ALTER TABLE public.invoice_items DROP CONSTRAINT IF EXISTS invoice_items_invoice_id_fkey;
ALTER TABLE public.invoice_items
  ADD CONSTRAINT fk_invoice_items_store_invoice
  FOREIGN KEY (store_id, invoice_id) REFERENCES public.invoices(store_id, id) ON DELETE CASCADE;

-- 3.13 Billing Payments -> Invoices
ALTER TABLE public.billing_payments DROP CONSTRAINT IF EXISTS billing_payments_invoice_id_fkey;
ALTER TABLE public.billing_payments
  ADD CONSTRAINT fk_billing_payments_store_invoice
  FOREIGN KEY (store_id, invoice_id) REFERENCES public.invoices(store_id, id) ON DELETE CASCADE;

-- ==============================================================================
-- 4. STORE OWNER INVARIANT ENFORCEMENT
-- ==============================================================================

-- 4.1 Automatic provisioning of active STORE_OWNER member upon store creation
CREATE OR REPLACE FUNCTION public.handle_store_owner_provision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.store_members (store_id, user_id, role, status)
  VALUES (NEW.id, NEW.owner_user_id, 'STORE_OWNER', 'ACTIVE')
  ON CONFLICT (store_id, user_id)
  DO UPDATE SET role = 'STORE_OWNER', status = 'ACTIVE';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_owner_provision ON public.stores;
CREATE TRIGGER trg_store_owner_provision
  AFTER INSERT ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.handle_store_owner_provision();

-- 4.2 Prevent direct mutation of store owner_user_id
CREATE OR REPLACE FUNCTION public.protect_store_owner_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id THEN
    RAISE EXCEPTION 'Changing store owner_user_id directly is not permitted';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_store_owner ON public.stores;
CREATE TRIGGER trg_protect_store_owner
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.protect_store_owner_immutable();

-- 4.3 Protect active STORE_OWNER membership from removal or demotion
CREATE OR REPLACE FUNCTION public.protect_store_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF pg_trigger_depth() <= 1 AND EXISTS (
      SELECT 1 FROM public.stores
      WHERE id = OLD.store_id AND owner_user_id = OLD.user_id
    ) THEN
      RAISE EXCEPTION 'Cannot delete active STORE_OWNER membership for owner of store %', OLD.store_id;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF EXISTS (
      SELECT 1 FROM public.stores
      WHERE id = OLD.store_id AND owner_user_id = OLD.user_id
    ) THEN
      IF NEW.role != 'STORE_OWNER' OR NEW.status != 'ACTIVE' THEN
        RAISE EXCEPTION 'Cannot demote or deactivate the active STORE_OWNER membership for store %', OLD.store_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_store_owner_membership ON public.store_members;
CREATE TRIGGER trg_protect_store_owner_membership
  BEFORE UPDATE OR DELETE ON public.store_members
  FOR EACH ROW EXECUTE FUNCTION public.protect_store_owner_membership();

-- ==============================================================================
-- 5. ANTI-TENANT-MUTATION TRIGGERS (PREVENT UPDATING store_id)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.prevent_tenant_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.store_id IS DISTINCT FROM NEW.store_id THEN
    RAISE EXCEPTION 'Changing store_id (tenant mutation) is strictly forbidden on table %', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'categories', 'products', 'inventory', 'inventory_items',
    'customers', 'orders', 'order_items', 'vouchers', 'voucher_redemptions',
    'payment_accounts', 'payments', 'refunds', 'fulfillments', 'fulfillment_items',
    'store_channels', 'bots', 'store_members', 'subscriptions', 'store_addons',
    'invoices', 'invoice_items', 'billing_payments', 'support_tickets', 'notifications',
    'notification_preferences', 'outbox_events', 'security_events', 'risk_decisions'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_prevent_tenant_mutation_%I ON public.%I;', tbl, tbl);
    EXECUTE format('CREATE TRIGGER trg_prevent_tenant_mutation_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_mutation();', tbl, tbl);
  END LOOP;
END $$;

-- ==============================================================================
-- 6. STORE CONTEXT HELPER & PUBLIC CATALOG RLS HARDENING
-- ==============================================================================

-- Helper to extract explicitly requested store context (via header, JWT claim, or session config)
CREATE OR REPLACE FUNCTION public.get_current_request_store_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(
    COALESCE(
      current_setting('app.current_store_id', true),
      (nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-store-id'),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'store_id')
    ),
    ''
  )::uuid;
$$;

-- Helper to check if a store is active (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_store_active(lookup_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores WHERE id = lookup_store_id AND status = 'ACTIVE'
  );
$$;

-- Allow anon & authenticated to view an active store when requested in store context
DROP POLICY IF EXISTS "stores_select_active_context" ON public.stores;
CREATE POLICY "stores_select_active_context" ON public.stores
  FOR SELECT TO authenticated, anon
  USING (
    id = public.get_current_request_store_id()
    AND status = 'ACTIVE'
  );

-- Harden Categories public catalog policy: ONLY allowed if store_id matches explicit current request store
DROP POLICY IF EXISTS "categories_select_tenant_or_public" ON public.categories;
CREATE POLICY "categories_select_tenant_or_public" ON public.categories
  FOR SELECT TO authenticated, anon
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    OR (
      public.get_current_request_store_id() IS NOT NULL
      AND store_id = public.get_current_request_store_id()
      AND public.is_store_active(store_id)
    )
  );

-- Harden Products public catalog policy
DROP POLICY IF EXISTS "products_select_tenant_or_public" ON public.products;
CREATE POLICY "products_select_tenant_or_public" ON public.products
  FOR SELECT TO authenticated, anon
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    OR (
      status = 'ACTIVE'
      AND public.get_current_request_store_id() IS NOT NULL
      AND store_id = public.get_current_request_store_id()
      AND public.is_store_active(store_id)
    )
  );

-- Harden Vouchers public catalog policy
DROP POLICY IF EXISTS "vouchers_select_tenant_or_public" ON public.vouchers;
CREATE POLICY "vouchers_select_tenant_or_public" ON public.vouchers
  FOR SELECT TO authenticated, anon
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    OR (
      status = 'ACTIVE'
      AND public.get_current_request_store_id() IS NOT NULL
      AND store_id = public.get_current_request_store_id()
      AND public.is_store_active(store_id)
    )
  );

GRANT SELECT ON public.stores, public.categories, public.products, public.vouchers TO anon, authenticated;

-- ==============================================================================
-- 7. RLS WITH CHECK HARDENING (EXPLICIT MUTATION AUTHORIZATION)
-- ==============================================================================

-- 7.1 Stores: update admin with check
DROP POLICY IF EXISTS "stores_update_admin" ON public.stores;
CREATE POLICY "stores_update_admin" ON public.stores
  FOR UPDATE TO authenticated
  USING (
    id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(id) IN ('STORE_OWNER', 'STORE_ADMIN')
  )
  WITH CHECK (
    id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(id) IN ('STORE_OWNER', 'STORE_ADMIN')
  );

-- 7.2 Store Members: modify admin with check
DROP POLICY IF EXISTS "store_members_modify_admin" ON public.store_members;
CREATE POLICY "store_members_modify_admin" ON public.store_members
  FOR ALL TO authenticated
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  )
  WITH CHECK (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  );

-- 7.3 Categories: modify admin with check
DROP POLICY IF EXISTS "categories_modify_admin" ON public.categories;
CREATE POLICY "categories_modify_admin" ON public.categories
  FOR ALL TO authenticated
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  )
  WITH CHECK (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  );

-- 7.4 Products: modify admin with check
DROP POLICY IF EXISTS "products_modify_admin" ON public.products;
CREATE POLICY "products_modify_admin" ON public.products
  FOR ALL TO authenticated
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  )
  WITH CHECK (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  );

-- 7.5 Inventory: modify admin with check
DROP POLICY IF EXISTS "inventory_modify_admin" ON public.inventory;
CREATE POLICY "inventory_modify_admin" ON public.inventory
  FOR ALL TO authenticated
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  )
  WITH CHECK (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  );

-- 7.6 Inventory Items: modify admin with check
DROP POLICY IF EXISTS "inventory_items_modify_admin" ON public.inventory_items;
CREATE POLICY "inventory_items_modify_admin" ON public.inventory_items
  FOR ALL TO authenticated
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  )
  WITH CHECK (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  );

-- 7.7 Customers: modify member with check
DROP POLICY IF EXISTS "customers_modify_member" ON public.customers;
CREATE POLICY "customers_modify_member" ON public.customers
  FOR ALL TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()))
  WITH CHECK (store_id IN (SELECT public.get_current_user_store_ids()));

-- 7.8 Orders: modify member with check
DROP POLICY IF EXISTS "orders_modify_member" ON public.orders;
CREATE POLICY "orders_modify_member" ON public.orders
  FOR ALL TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()))
  WITH CHECK (store_id IN (SELECT public.get_current_user_store_ids()));

-- 7.9 Order Items: scoped by store_id with check
DROP POLICY IF EXISTS "order_items_select_member" ON public.order_items;
CREATE POLICY "order_items_select_member" ON public.order_items
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()));

DROP POLICY IF EXISTS "order_items_modify_member" ON public.order_items;
CREATE POLICY "order_items_modify_member" ON public.order_items
  FOR ALL TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()))
  WITH CHECK (store_id IN (SELECT public.get_current_user_store_ids()));

-- 7.10 Vouchers: modify admin with check
DROP POLICY IF EXISTS "vouchers_modify_admin" ON public.vouchers;
CREATE POLICY "vouchers_modify_admin" ON public.vouchers
  FOR ALL TO authenticated
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  )
  WITH CHECK (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  );

-- 7.11 Payment Accounts: modify owner with check
DROP POLICY IF EXISTS "payment_accounts_modify_owner" ON public.payment_accounts;
CREATE POLICY "payment_accounts_modify_owner" ON public.payment_accounts
  FOR ALL TO authenticated
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) = 'STORE_OWNER'
  )
  WITH CHECK (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) = 'STORE_OWNER'
  );

-- 7.12 Fulfillments: modify member with check
DROP POLICY IF EXISTS "fulfillments_modify_member" ON public.fulfillments;
CREATE POLICY "fulfillments_modify_member" ON public.fulfillments
  FOR ALL TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()))
  WITH CHECK (store_id IN (SELECT public.get_current_user_store_ids()));

-- 7.13 Fulfillment Items: scoped by store_id with check
DROP POLICY IF EXISTS "fulfillment_items_select_member" ON public.fulfillment_items;
CREATE POLICY "fulfillment_items_select_member" ON public.fulfillment_items
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()));

DROP POLICY IF EXISTS "fulfillment_items_modify_member" ON public.fulfillment_items;
CREATE POLICY "fulfillment_items_modify_member" ON public.fulfillment_items
  FOR ALL TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()))
  WITH CHECK (store_id IN (SELECT public.get_current_user_store_ids()));

-- 7.14 Invoice Items: scoped by store_id with check
DROP POLICY IF EXISTS "invoice_items_select_member" ON public.invoice_items;
CREATE POLICY "invoice_items_select_member" ON public.invoice_items
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()));

DROP POLICY IF EXISTS "invoice_items_modify_member" ON public.invoice_items;
CREATE POLICY "invoice_items_modify_member" ON public.invoice_items
  FOR ALL TO authenticated
  USING (store_id IN (SELECT public.get_current_user_store_ids()))
  WITH CHECK (store_id IN (SELECT public.get_current_user_store_ids()));

-- 7.15 Store Channels: modify admin with check
DROP POLICY IF EXISTS "store_channels_modify_admin" ON public.store_channels;
CREATE POLICY "store_channels_modify_admin" ON public.store_channels
  FOR ALL TO authenticated
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  )
  WITH CHECK (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  );

-- 7.16 Bots: modify admin with check
DROP POLICY IF EXISTS "bots_modify_admin" ON public.bots;
CREATE POLICY "bots_modify_admin" ON public.bots
  FOR ALL TO authenticated
  USING (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  )
  WITH CHECK (
    store_id IN (SELECT public.get_current_user_store_ids())
    AND public.get_store_member_role(store_id) IN ('STORE_OWNER', 'STORE_ADMIN')
  );

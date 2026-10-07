-- ==============================================================================
-- BINTANG TECH STUDIO — M02 DATABASE FOUNDATION COMPREHENSIVE TEST SUITE
-- File: database/tests/00001_schema_and_rls_tests.sql
-- Baseline: Master Blueprint v3.0 / Architecture Freeze v1.0
-- Tests:
--   Part 1: Auth & Store Triggers (Profiles + Automatic Store Owner Invariant)
--   Part 2: Core Data Invariants & Constraints (Inventory, Vouchers, Orders, Payments)
--   Part 3: Partial Unique Indexes (Telegram, WhatsApp)
--   Part 4: Webhook Deduplication (Payment Events)
--   Part 5: Cross-Tenant Referential Integrity (Composite Foreign Keys & Triggers)
--   Part 6: Store Owner Invariant Protections (Immutability & Membership Defense)
--   Part 7: Anti-Tenant-Mutation Triggers (store_id immutability)
--   Part 8: RLS Helper Functions & Multi-Tenant Isolation
--   Part 9: Customer Public Catalog RLS Hardening (Explicit Store Context)
-- ==============================================================================

CREATE TEMP TABLE IF NOT EXISTS test_results (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    test_name TEXT NOT NULL,
    passed BOOLEAN NOT NULL,
    message TEXT NOT NULL
);

DO $$
DECLARE
    v_user_a_id UUID := 'a0000000-0000-0000-0000-000000000001'::uuid;
    v_user_b_id UUID := 'b0000000-0000-0000-0000-000000000002'::uuid;
    v_user_c_id UUID := 'c0000000-0000-0000-0000-000000000003'::uuid;
    v_user_d_id UUID := 'd0000000-0000-0000-0000-000000000004'::uuid;
    v_store_a_id UUID := 'a1111111-1111-1111-1111-111111111111'::uuid;
    v_store_b_id UUID := 'b2222222-2222-2222-2222-222222222222'::uuid;
    v_store_d_id UUID := 'd4444444-4444-4444-4444-444444444444'::uuid;
    v_cust_a_id UUID := 'a7777777-7777-7777-7777-777777777777'::uuid;
    v_cust_b_id UUID := 'b8888888-8888-8888-8888-888888888888'::uuid;
    v_prod_a_id UUID := 'a3333333-3333-3333-3333-333333333333'::uuid;
    v_prod_b_id UUID := 'b4444444-4444-4444-4444-444444444444'::uuid;
    v_inv_a_id UUID;
    v_cat_a_id UUID := 'a5555555-5555-5555-5555-555555555555'::uuid;
    v_cat_b_id UUID := 'b6666666-6666-6666-6666-666666666666'::uuid;
    v_order_a_id UUID;
    v_order_b_id UUID;
    v_order_item_a_id UUID;
    v_order_item_b_id UUID;
    v_fulf_a_id UUID;
    v_count INT;
    v_err_caught BOOLEAN;
    v_role_found TEXT;
    v_is_member BOOLEAN;
    v_store_ids UUID[];
BEGIN
    -- -------------------------------------------------------------------------
    -- FIXTURE SETUP
    -- -------------------------------------------------------------------------
    -- 1. Create test auth users
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES
        (v_user_a_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test_user_a@bintang.test', 'encrypted', now(), '{"provider":"email"}', '{"full_name":"Owner A"}', now(), now()),
        (v_user_b_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test_user_b@bintang.test', 'encrypted', now(), '{"provider":"email"}', '{"full_name":"Owner B"}', now(), now()),
        (v_user_c_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test_staff_c@bintang.test', 'encrypted', now(), '{"provider":"email"}', '{"full_name":"Staff C"}', now(), now()),
        (v_user_d_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test_user_d@bintang.test', 'encrypted', now(), '{"provider":"email"}', '{"full_name":"Owner D"}', now(), now())
    ON CONFLICT (id) DO NOTHING;

    -- Verify Profile creation via Trigger
    SELECT count(*) INTO v_count FROM public.profiles WHERE id IN (v_user_a_id, v_user_b_id, v_user_c_id, v_user_d_id);
    IF v_count = 4 THEN
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('TRIGGERS', 'Auth user trigger creates profile automatically', TRUE, 'All 4 profiles created successfully');
    ELSE
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('TRIGGERS', 'Auth user trigger creates profile automatically', FALSE, 'Expected 4 profiles, found: ' || v_count);
    END IF;

    -- 2. Create Store A and Store B
    INSERT INTO public.stores (id, owner_user_id, name, slug, status)
    VALUES
        (v_store_a_id, v_user_a_id, 'Store Alpha', 'store-alpha-test', 'ACTIVE'),
        (v_store_b_id, v_user_b_id, 'Store Beta', 'store-beta-test', 'ACTIVE')
    ON CONFLICT (id) DO NOTHING;

    -- 3. Add Staff C membership to Store A (Owner A and B memberships auto-provisioned by trigger)
    INSERT INTO public.store_members (store_id, user_id, role, status)
    VALUES (v_store_a_id, v_user_c_id, 'STORE_STAFF', 'ACTIVE')
    ON CONFLICT (store_id, user_id) DO NOTHING;

    -- 4. Create Categories
    INSERT INTO public.categories (id, store_id, name, slug)
    VALUES
        (v_cat_a_id, v_store_a_id, 'Games Store A', 'games'),
        (v_cat_b_id, v_store_b_id, 'Games Store B', 'games')
    ON CONFLICT (id) DO NOTHING;

    -- 5. Create Products (DRAFT by default for member testing)
    INSERT INTO public.products (id, store_id, category_id, name, slug, price, status)
    VALUES
        (v_prod_a_id, v_store_a_id, v_cat_a_id, 'Mobile Legends Alpha', 'mlbb-alpha', 50000, 'DRAFT'),
        (v_prod_b_id, v_store_b_id, v_cat_b_id, 'Mobile Legends Beta', 'mlbb-beta', 50000, 'DRAFT')
    ON CONFLICT (id) DO NOTHING;

    -- 6. Create Customers
    INSERT INTO public.customers (id, store_id, name, telegram_id, whatsapp_number)
    VALUES
        (v_cust_a_id, v_store_a_id, 'Customer Alpha One', '987654321', '+6281234567890'),
        (v_cust_b_id, v_store_b_id, 'Customer Beta One', '987654321', '+6281234567890')
    ON CONFLICT (id) DO NOTHING;

    -- -------------------------------------------------------------------------
    -- PART 1: INVENTORY CONSTRAINTS
    -- -------------------------------------------------------------------------
    -- 1.1 Non-negative check quantity_on_hand
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.inventory (store_id, product_id, quantity_on_hand, quantity_reserved)
        VALUES (v_store_a_id, v_prod_a_id, -1, 0);
    EXCEPTION WHEN check_violation THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('CONSTRAINTS', 'inventory_quantity_on_hand_check rejects negative quantity_on_hand', v_err_caught,
            CASE WHEN v_err_caught THEN 'Negative quantity_on_hand rejected as expected' ELSE 'Failed to reject negative quantity_on_hand' END);

    -- 1.2 Reserved quantity <= On hand quantity check
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.inventory (store_id, product_id, quantity_on_hand, quantity_reserved)
        VALUES (v_store_a_id, v_prod_a_id, 10, 15);
    EXCEPTION WHEN check_violation THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('CONSTRAINTS', 'chk_inventory_reserved_lte_on_hand rejects reserved > on_hand', v_err_caught,
            CASE WHEN v_err_caught THEN 'reserved > on_hand rejected as expected' ELSE 'Failed to reject reserved > on_hand' END);

    -- 1.3 Valid inventory insertion
    INSERT INTO public.inventory (store_id, product_id, quantity_on_hand, quantity_reserved)
    VALUES (v_store_a_id, v_prod_a_id, 100, 20)
    RETURNING id INTO v_inv_a_id;

    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('CONSTRAINTS', 'Valid inventory (reserved <= on_hand) succeeds', v_inv_a_id IS NOT NULL, 'Inventory created successfully');

    -- -------------------------------------------------------------------------
    -- PART 2: VOUCHER UNIQUE PER STORE CONSTRAINT
    -- -------------------------------------------------------------------------
    -- 2.1 Insert voucher in Store A
    INSERT INTO public.vouchers (store_id, code, discount_type, discount_value, minimum_purchase)
    VALUES (v_store_a_id, 'DISKON10', 'PERCENTAGE', 10, 50000);

    -- 2.2 Duplicate voucher in same store must FAIL
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.vouchers (store_id, code, discount_type, discount_value, minimum_purchase)
        VALUES (v_store_a_id, 'DISKON10', 'PERCENTAGE', 15, 100000);
    EXCEPTION WHEN unique_violation THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('CONSTRAINTS', 'uq_vouchers_store_code rejects duplicate voucher in same store', v_err_caught,
            CASE WHEN v_err_caught THEN 'Duplicate voucher in same store rejected' ELSE 'Failed to reject duplicate voucher' END);

    -- 2.3 Same voucher code in DIFFERENT store must SUCCEED
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.vouchers (store_id, code, discount_type, discount_value, minimum_purchase)
        VALUES (v_store_b_id, 'DISKON10', 'PERCENTAGE', 10, 50000);
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('CONSTRAINTS', 'Same voucher code in different store is permitted', NOT v_err_caught,
            CASE WHEN NOT v_err_caught THEN 'Cross-store voucher code permitted' ELSE 'Unexpected rejection of cross-store voucher' END);

    -- 2.4 Voucher discount value positive check
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.vouchers (store_id, code, discount_type, discount_value, minimum_purchase)
        VALUES (v_store_a_id, 'ZERODISC', 'FIXED', 0, 50000);
    EXCEPTION WHEN check_violation THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('CONSTRAINTS', 'vouchers_discount_value_check rejects discount_value <= 0', v_err_caught,
            CASE WHEN v_err_caught THEN 'Zero discount_value rejected as expected' ELSE 'Failed to reject zero discount_value' END);

    -- -------------------------------------------------------------------------
    -- PART 3: CUSTOMER PARTIAL UNIQUE INDEXES
    -- -------------------------------------------------------------------------
    -- 3.1 Duplicate telegram_id in same store must FAIL
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.customers (store_id, name, telegram_id)
        VALUES (v_store_a_id, 'Customer One Duplicate', '987654321');
    EXCEPTION WHEN unique_violation THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('INDEXES', 'uq_customers_store_telegram rejects duplicate telegram_id in same store', v_err_caught,
            CASE WHEN v_err_caught THEN 'Duplicate telegram ID rejected in same store' ELSE 'Failed to reject duplicate telegram ID' END);

    -- 3.2 Multiple customers with NULL telegram_id must SUCCEED
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.customers (store_id, name, telegram_id)
        VALUES (v_store_a_id, 'Customer Null 1', NULL);
        INSERT INTO public.customers (store_id, name, telegram_id)
        VALUES (v_store_a_id, 'Customer Null 2', NULL);
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('INDEXES', 'Partial index allows multiple NULL telegram_id values', NOT v_err_caught,
            CASE WHEN NOT v_err_caught THEN 'Multiple NULLs permitted' ELSE 'Failed: NULLs triggered unique violation' END);

    -- 3.3 Duplicate whatsapp_number in same store must FAIL
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.customers (store_id, name, whatsapp_number)
        VALUES (v_store_a_id, 'Customer WA Dup', '+6281234567890');
    EXCEPTION WHEN unique_violation THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('INDEXES', 'uq_customers_store_whatsapp rejects duplicate whatsapp_number in same store', v_err_caught,
            CASE WHEN v_err_caught THEN 'Duplicate whatsapp rejected in same store' ELSE 'Failed to reject duplicate whatsapp' END);

    -- -------------------------------------------------------------------------
    -- PART 4: ORDER & PAYMENT CONSTRAINTS
    -- -------------------------------------------------------------------------
    -- 4.1 Order number unique per store
    INSERT INTO public.orders (store_id, customer_id, order_number, subtotal, grand_total, discount_total)
    VALUES (v_store_a_id, v_cust_a_id, 'ORD-202610-001', 50000, 50000, 0)
    RETURNING id INTO v_order_a_id;

    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.orders (store_id, customer_id, order_number, subtotal, grand_total, discount_total)
        VALUES (v_store_a_id, v_cust_a_id, 'ORD-202610-001', 75000, 75000, 0);
    EXCEPTION WHEN unique_violation THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('CONSTRAINTS', 'uq_orders_store_order_number rejects duplicate order number in same store', v_err_caught,
            CASE WHEN v_err_caught THEN 'Duplicate order number rejected' ELSE 'Failed to reject duplicate order number' END);

    -- 4.2 Same order number in Store B must SUCCEED
    INSERT INTO public.orders (store_id, customer_id, order_number, subtotal, grand_total, discount_total)
    VALUES (v_store_b_id, v_cust_b_id, 'ORD-202610-001', 50000, 50000, 0)
    RETURNING id INTO v_order_b_id;

    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('CONSTRAINTS', 'Same order number in different store is permitted', v_order_b_id IS NOT NULL, 'Cross-store order number permitted');

    -- 4.3 Order amount non-negative check
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.orders (store_id, customer_id, order_number, subtotal, grand_total, discount_total)
        VALUES (v_store_a_id, v_cust_a_id, 'ORD-NEG', 50000, -1000, 0);
    EXCEPTION WHEN check_violation THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('CONSTRAINTS', 'orders_grand_total_check rejects negative grand_total', v_err_caught,
            CASE WHEN v_err_caught THEN 'Negative grand_total rejected' ELSE 'Failed to reject negative grand_total' END);

    -- 4.4 Payment positive amount check
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.payments (store_id, order_id, amount, provider)
        VALUES (v_store_a_id, v_order_a_id, 0, 'MIDTRANS');
    EXCEPTION WHEN check_violation THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('CONSTRAINTS', 'payments_amount_check rejects amount <= 0', v_err_caught,
            CASE WHEN v_err_caught THEN 'Zero payment amount rejected' ELSE 'Failed to reject zero payment amount' END);

    -- 4.5 Payment event unique per provider + event_id
    INSERT INTO public.payment_events (provider, event_id, event_type, payload)
    VALUES ('MIDTRANS', 'evt-webhook-001', 'settlement', '{"status":"success"}'::jsonb);

    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.payment_events (provider, event_id, event_type, payload)
        VALUES ('MIDTRANS', 'evt-webhook-001', 'settlement', '{"status":"success"}'::jsonb);
    EXCEPTION WHEN unique_violation THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('CONSTRAINTS', 'uq_payment_events_provider_event rejects duplicate provider event_id', v_err_caught,
            CASE WHEN v_err_caught THEN 'Duplicate payment webhook event rejected' ELSE 'Failed to reject duplicate payment webhook event' END);

    -- 4.6 Same event_id with DIFFERENT provider must SUCCEED
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.payment_events (provider, event_id, event_type, payload)
        VALUES ('XENDIT', 'evt-webhook-001', 'settlement', '{"status":"success"}'::jsonb);
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('CONSTRAINTS', 'Same event_id with different provider is permitted', NOT v_err_caught,
            CASE WHEN NOT v_err_caught THEN 'Different provider event_id permitted' ELSE 'Unexpected rejection of different provider' END);

    -- -------------------------------------------------------------------------
    -- PART 5: CROSS-TENANT REFERENTIAL INTEGRITY (COMPOSITE FOREIGN KEYS)
    -- -------------------------------------------------------------------------
    -- 5.1 Cross-store Category/Product: Store A product referencing Store B category must FAIL
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.products (store_id, category_id, name, slug, price)
        VALUES (v_store_a_id, v_cat_b_id, 'Invalid Cross Product', 'cross-prod-test', 25000);
    EXCEPTION WHEN foreign_key_violation THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('CROSS_TENANT', 'Cross-store category/product relationship is rejected', v_err_caught,
            CASE WHEN v_err_caught THEN 'Rejected via composite FK fk_products_store_category' ELSE 'Failed: cross-store category allowed' END);

    -- 5.2 Cross-store Product/Inventory: Store A inventory referencing Store B product must FAIL
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.inventory (store_id, product_id, quantity_on_hand, quantity_reserved)
        VALUES (v_store_a_id, v_prod_b_id, 10, 0);
    EXCEPTION WHEN foreign_key_violation THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('CROSS_TENANT', 'Cross-store product/inventory relationship is rejected', v_err_caught,
            CASE WHEN v_err_caught THEN 'Rejected via composite FK fk_inventory_store_product' ELSE 'Failed: cross-store inventory allowed' END);

    -- 5.3 Cross-store Customer/Order: Store A order referencing Store B customer must FAIL
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.orders (store_id, customer_id, order_number, subtotal, grand_total, discount_total)
        VALUES (v_store_a_id, v_cust_b_id, 'ORD-CROSS-CUST', 50000, 50000, 0);
    EXCEPTION WHEN foreign_key_violation THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('CROSS_TENANT', 'Cross-store customer/order relationship is rejected', v_err_caught,
            CASE WHEN v_err_caught THEN 'Rejected via composite FK fk_orders_store_customer' ELSE 'Failed: cross-store customer order allowed' END);

    -- 5.4 Cross-store Voucher Redemption: Store A redemption referencing Store B voucher must FAIL
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.voucher_redemptions (store_id, voucher_id, customer_id, order_id, discount_amount)
        SELECT v_store_a_id, v.id, v_cust_a_id, v_order_a_id, 5000
        FROM public.vouchers v WHERE v.store_id = v_store_b_id LIMIT 1;
    EXCEPTION WHEN foreign_key_violation THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('CROSS_TENANT', 'Cross-store voucher redemption is rejected', v_err_caught,
            CASE WHEN v_err_caught THEN 'Rejected via composite FK fk_voucher_redemptions_store_voucher' ELSE 'Failed: cross-store voucher redemption allowed' END);

    -- 5.5 Cross-store Payment/Order: Store A payment referencing Store B order must FAIL
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.payments (store_id, order_id, amount, provider)
        VALUES (v_store_a_id, v_order_b_id, 50000, 'MIDTRANS');
    EXCEPTION WHEN foreign_key_violation THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('CROSS_TENANT', 'Cross-store payment/order relationship is rejected', v_err_caught,
            CASE WHEN v_err_caught THEN 'Rejected via composite FK fk_payments_store_order' ELSE 'Failed: cross-store payment allowed' END);

    -- 5.6 Cross-store Fulfillment/Order: Store A fulfillment referencing Store B order must FAIL
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.fulfillments (store_id, order_id, status)
        VALUES (v_store_a_id, v_order_b_id, 'PENDING');
    EXCEPTION WHEN foreign_key_violation THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('CROSS_TENANT', 'Cross-store fulfillment/order relationship is rejected', v_err_caught,
            CASE WHEN v_err_caught THEN 'Rejected via composite FK fk_fulfillments_store_order' ELSE 'Failed: cross-store fulfillment allowed' END);

    -- 5.7 Cross-order Fulfillment Item Match: fulfillment item referencing order item of another order must FAIL
    INSERT INTO public.order_items (store_id, order_id, product_id, product_name, quantity, unit_price, subtotal)
    VALUES
        (v_store_a_id, v_order_a_id, v_prod_a_id, 'Item A', 1, 50000, 50000)
    RETURNING id INTO v_order_item_a_id;

    INSERT INTO public.order_items (store_id, order_id, product_id, product_name, quantity, unit_price, subtotal)
    VALUES
        (v_store_b_id, v_order_b_id, v_prod_b_id, 'Item B', 1, 50000, 50000)
    RETURNING id INTO v_order_item_b_id;

    INSERT INTO public.fulfillments (store_id, order_id, status)
    VALUES (v_store_a_id, v_order_a_id, 'PENDING')
    RETURNING id INTO v_fulf_a_id;

    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.fulfillment_items (store_id, fulfillment_id, order_item_id, item_type, status)
        VALUES (v_store_a_id, v_fulf_a_id, v_order_item_b_id, 'CREDENTIAL', 'DELIVERED');
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('CROSS_TENANT', 'Cross-order fulfillment item relationship is rejected', v_err_caught,
            CASE WHEN v_err_caught THEN 'Rejected by check_fulfillment_item_order_match trigger' ELSE 'Failed: cross-order fulfillment item allowed' END);

    -- -------------------------------------------------------------------------
    -- PART 6: STORE OWNER INVARIANT & PROTECTIONS
    -- -------------------------------------------------------------------------
    -- 6.1 Store Creation automatically provisions active STORE_OWNER member
    INSERT INTO public.stores (id, owner_user_id, name, slug, status)
    VALUES (v_store_d_id, v_user_d_id, 'Store Delta', 'store-delta-test', 'ACTIVE');

    SELECT role INTO v_role_found
    FROM public.store_members
    WHERE store_id = v_store_d_id AND user_id = v_user_d_id AND status = 'ACTIVE';

    IF v_role_found = 'STORE_OWNER' THEN
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('OWNER_INVARIANT', 'Store creation auto-provisions active STORE_OWNER membership', TRUE, 'Auto-provisioned STORE_OWNER');
    ELSE
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('OWNER_INVARIANT', 'Store creation auto-provisions active STORE_OWNER membership', FALSE, 'Failed to find active STORE_OWNER');
    END IF;

    -- 6.2 Deleting active STORE_OWNER member is rejected
    v_err_caught := FALSE;
    BEGIN
        DELETE FROM public.store_members WHERE store_id = v_store_d_id AND user_id = v_user_d_id;
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('OWNER_INVARIANT', 'Deleting active STORE_OWNER membership is rejected', v_err_caught,
            CASE WHEN v_err_caught THEN 'Rejected deletion of STORE_OWNER' ELSE 'Failed: allowed deletion of owner' END);

    -- 6.3 Demoting active STORE_OWNER member is rejected
    v_err_caught := FALSE;
    BEGIN
        UPDATE public.store_members SET role = 'STORE_STAFF' WHERE store_id = v_store_d_id AND user_id = v_user_d_id;
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('OWNER_INVARIANT', 'Demoting active STORE_OWNER membership is rejected', v_err_caught,
            CASE WHEN v_err_caught THEN 'Rejected demotion of STORE_OWNER' ELSE 'Failed: allowed demotion of owner' END);

    -- 6.4 Mutating stores.owner_user_id directly is rejected
    v_err_caught := FALSE;
    BEGIN
        UPDATE public.stores SET owner_user_id = v_user_c_id WHERE id = v_store_d_id;
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('OWNER_INVARIANT', 'Direct mutation of store owner_user_id is rejected', v_err_caught,
            CASE WHEN v_err_caught THEN 'Rejected direct mutation of owner_user_id' ELSE 'Failed: allowed owner mutation' END);

    -- -------------------------------------------------------------------------
    -- PART 7: ANTI-TENANT-MUTATION TRIGGERS (store_id immutability)
    -- -------------------------------------------------------------------------
    -- 7.1 Mutating store_id on products is rejected
    v_err_caught := FALSE;
    BEGIN
        UPDATE public.products SET store_id = v_store_b_id WHERE id = v_prod_a_id;
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('ANTI_MUTATION', 'Tenant mutation (store_id change) on products is rejected', v_err_caught,
            CASE WHEN v_err_caught THEN 'Rejected product tenant migration' ELSE 'Failed: allowed product tenant mutation' END);

    -- 7.2 Mutating store_id on orders is rejected
    v_err_caught := FALSE;
    BEGIN
        UPDATE public.orders SET store_id = v_store_b_id WHERE id = v_order_a_id;
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := TRUE;
    END;
    INSERT INTO test_results (category, test_name, passed, message)
    VALUES ('ANTI_MUTATION', 'Tenant mutation (store_id change) on orders is rejected', v_err_caught,
            CASE WHEN v_err_caught THEN 'Rejected order tenant migration' ELSE 'Failed: allowed order tenant mutation' END);

    -- -------------------------------------------------------------------------
    -- PART 8: RLS HELPER FUNCTION VERIFICATION
    -- -------------------------------------------------------------------------
    -- 8.1 Helper function get_current_user_store_ids for User A
    PERFORM set_config('request.jwt.claim.sub', v_user_a_id::text, true);
    SELECT array_agg(val) INTO v_store_ids FROM public.get_current_user_store_ids() val;
    IF v_store_ids = ARRAY[v_store_a_id] THEN
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('RLS_HELPERS', 'get_current_user_store_ids returns Store A for User A', TRUE, 'Returned: ' || v_store_ids::text);
    ELSE
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('RLS_HELPERS', 'get_current_user_store_ids returns Store A for User A', FALSE, 'Unexpected: ' || COALESCE(v_store_ids::text, 'null'));
    END IF;

    -- 8.2 Helper function get_current_user_store_ids for User B
    PERFORM set_config('request.jwt.claim.sub', v_user_b_id::text, true);
    SELECT array_agg(val) INTO v_store_ids FROM public.get_current_user_store_ids() val;
    IF v_store_ids = ARRAY[v_store_b_id] THEN
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('RLS_HELPERS', 'get_current_user_store_ids returns Store B for User B', TRUE, 'Returned: ' || v_store_ids::text);
    ELSE
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('RLS_HELPERS', 'get_current_user_store_ids returns Store B for User B', FALSE, 'Unexpected: ' || COALESCE(v_store_ids::text, 'null'));
    END IF;

    -- 8.3 Helper function is_store_member
    PERFORM set_config('request.jwt.claim.sub', v_user_a_id::text, true);
    SELECT public.is_store_member(v_store_a_id) INTO v_is_member;
    IF v_is_member = TRUE THEN
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('RLS_HELPERS', 'is_store_member returns TRUE for member of Store A', TRUE, 'Member verified');
    ELSE
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('RLS_HELPERS', 'is_store_member returns TRUE for member of Store A', FALSE, 'Failed to recognize membership');
    END IF;

    -- 8.4 Cross-store membership check (User A is NOT member of Store B)
    SELECT public.is_store_member(v_store_b_id) INTO v_is_member;
    IF v_is_member = FALSE THEN
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('RLS_HELPERS', 'is_store_member returns FALSE for non-member of Store B', TRUE, 'Cross-tenant access prevented');
    ELSE
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('RLS_HELPERS', 'is_store_member returns FALSE for non-member of Store B', FALSE, 'Leak: Non-member returned TRUE');
    END IF;

    -- 8.5 Role checking: get_store_member_role
    SELECT public.get_store_member_role(v_store_a_id) INTO v_role_found;
    IF v_role_found = 'STORE_OWNER' THEN
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('RLS_HELPERS', 'get_store_member_role returns STORE_OWNER for User A', TRUE, 'Role: STORE_OWNER');
    ELSE
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('RLS_HELPERS', 'get_store_member_role returns STORE_OWNER for User A', FALSE, 'Unexpected role: ' || COALESCE(v_role_found, 'null'));
    END IF;

    PERFORM set_config('request.jwt.claim.sub', v_user_c_id::text, true);
    SELECT public.get_store_member_role(v_store_a_id) INTO v_role_found;
    IF v_role_found = 'STORE_STAFF' THEN
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('RLS_HELPERS', 'get_store_member_role returns STORE_STAFF for Staff User C', TRUE, 'Role: STORE_STAFF');
    ELSE
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('RLS_HELPERS', 'get_store_member_role returns STORE_STAFF for Staff User C', FALSE, 'Unexpected role: ' || COALESCE(v_role_found, 'null'));
    END IF;

END $$;

-- -----------------------------------------------------------------------------
-- PART 9: RLS MEMBER ISOLATION & CUSTOMER PUBLIC CATALOG HARDENING
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_user_a_id UUID := 'a0000000-0000-0000-0000-000000000001'::uuid;
    v_user_b_id UUID := 'b0000000-0000-0000-0000-000000000002'::uuid;
    v_store_a_id UUID := 'a1111111-1111-1111-1111-111111111111'::uuid;
    v_store_b_id UUID := 'b2222222-2222-2222-2222-222222222222'::uuid;
    v_prod_count INT;
    v_order_count INT;
BEGIN
    -- 9.1 Member isolation: User A sees only Store A data
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub', v_user_a_id::text, true);

    EXECUTE 'SELECT count(*) FROM public.products' INTO v_prod_count;
    EXECUTE 'SELECT count(*) FROM public.orders' INTO v_order_count;

    EXECUTE 'RESET ROLE';

    IF v_prod_count = 1 AND v_order_count = 1 THEN
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('RLS_MEMBER', 'Authenticated User A sees only Store A data under RLS', TRUE,
                format('Products: %s, Orders: %s', v_prod_count, v_order_count));
    ELSE
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('RLS_MEMBER', 'Authenticated User A sees only Store A data under RLS', FALSE,
                format('Unexpected count - Products: %s, Orders: %s', v_prod_count, v_order_count));
    END IF;

    -- 9.2 Member isolation: User B sees only Store B data
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub', v_user_b_id::text, true);

    EXECUTE 'SELECT count(*) FROM public.products' INTO v_prod_count;
    EXECUTE 'SELECT count(*) FROM public.orders' INTO v_order_count;

    EXECUTE 'RESET ROLE';

    IF v_prod_count = 1 AND v_order_count = 1 THEN
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('RLS_MEMBER', 'Authenticated User B sees only Store B data under RLS (Zero cross-leak)', TRUE,
                format('Products: %s, Orders: %s', v_prod_count, v_order_count));
    ELSE
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('RLS_MEMBER', 'Authenticated User B sees only Store B data under RLS (Zero cross-leak)', FALSE,
                format('Unexpected count - Products: %s, Orders: %s', v_prod_count, v_order_count));
    END IF;

    -- 9.3 Customer Public Catalog: Anonymous visitor with NO store context sees ZERO products
    -- (Prevents scraping entire platform catalog across all active stores)
    UPDATE public.products SET status = 'ACTIVE' WHERE store_id IN (v_store_a_id, v_store_b_id);

    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('app.current_store_id', '', true);

    EXECUTE 'SELECT count(*) FROM public.products' INTO v_prod_count;

    EXECUTE 'RESET ROLE';

    IF v_prod_count = 0 THEN
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('PUBLIC_CATALOG', 'Anonymous visitor without explicit store context sees 0 products', TRUE, 'All-active-stores scraping prevented');
    ELSE
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('PUBLIC_CATALOG', 'Anonymous visitor without explicit store context sees 0 products', FALSE, 'Leak: Found ' || v_prod_count || ' products without store context');
    END IF;

    -- 9.4 Customer Public Catalog: Anonymous visitor querying Store A sees ONLY Store A products
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM set_config('app.current_store_id', v_store_a_id::text, true);

    EXECUTE 'SELECT count(*) FROM public.products' INTO v_prod_count;

    EXECUTE 'RESET ROLE';

    IF v_prod_count = 1 THEN
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('PUBLIC_CATALOG', 'Anonymous visitor querying Store A sees ONLY Store A catalog', TRUE, 'Returned 1 Store A product (Zero Store B leak)');
    ELSE
        INSERT INTO test_results (category, test_name, passed, message)
        VALUES ('PUBLIC_CATALOG', 'Anonymous visitor querying Store A sees ONLY Store A catalog', FALSE, 'Unexpected count: ' || v_prod_count);
    END IF;

    -- Reset config
    PERFORM set_config('app.current_store_id', '', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;

-- -----------------------------------------------------------------------------
-- CLEANUP TEST FIXTURES
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_user_a_id UUID := 'a0000000-0000-0000-0000-000000000001'::uuid;
    v_user_b_id UUID := 'b0000000-0000-0000-0000-000000000002'::uuid;
    v_user_c_id UUID := 'c0000000-0000-0000-0000-000000000003'::uuid;
    v_user_d_id UUID := 'd0000000-0000-0000-0000-000000000004'::uuid;
    v_store_a_id UUID := 'a1111111-1111-1111-1111-111111111111'::uuid;
    v_store_b_id UUID := 'b2222222-2222-2222-2222-222222222222'::uuid;
    v_store_d_id UUID := 'd4444444-4444-4444-4444-444444444444'::uuid;
BEGIN
    -- Delete fulfillment items and fulfillments
    DELETE FROM public.fulfillment_items WHERE store_id IN (v_store_a_id, v_store_b_id, v_store_d_id);
    DELETE FROM public.fulfillments WHERE store_id IN (v_store_a_id, v_store_b_id, v_store_d_id);

    -- Delete order items, payments, and orders
    DELETE FROM public.order_items WHERE store_id IN (v_store_a_id, v_store_b_id, v_store_d_id);
    DELETE FROM public.payments WHERE store_id IN (v_store_a_id, v_store_b_id, v_store_d_id);
    DELETE FROM public.voucher_redemptions WHERE store_id IN (v_store_a_id, v_store_b_id, v_store_d_id);
    DELETE FROM public.orders WHERE store_id IN (v_store_a_id, v_store_b_id, v_store_d_id);
    DELETE FROM public.payment_events WHERE event_id = 'evt-webhook-001';

    -- Delete customers, vouchers, inventory, products, categories
    DELETE FROM public.customers WHERE store_id IN (v_store_a_id, v_store_b_id, v_store_d_id);
    DELETE FROM public.vouchers WHERE store_id IN (v_store_a_id, v_store_b_id, v_store_d_id);
    DELETE FROM public.inventory WHERE store_id IN (v_store_a_id, v_store_b_id, v_store_d_id);
    DELETE FROM public.products WHERE store_id IN (v_store_a_id, v_store_b_id, v_store_d_id);
    DELETE FROM public.categories WHERE store_id IN (v_store_a_id, v_store_b_id, v_store_d_id);

    -- Delete stores (cascades to store_members automatically)
    DELETE FROM public.stores WHERE id IN (v_store_a_id, v_store_b_id, v_store_d_id);
    DELETE FROM public.profiles WHERE id IN (v_user_a_id, v_user_b_id, v_user_c_id, v_user_d_id);
    DELETE FROM auth.users WHERE id IN (v_user_a_id, v_user_b_id, v_user_c_id, v_user_d_id);
END $$;

-- -----------------------------------------------------------------------------
-- REPORT RESULTS
-- -----------------------------------------------------------------------------
SELECT
    id,
    category,
    test_name,
    passed,
    message
FROM test_results
ORDER BY id;

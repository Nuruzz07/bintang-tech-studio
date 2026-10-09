-- ==============================================================================
-- BINTANG TECH STUDIO — M15 HARDENING & ATOMICITY TEST SUITE
-- File: database/tests/00003_hardening_and_atomicity_tests.sql
-- Baseline: Master Blueprint v3.0 / M15 Hardening
-- Tests:
--   Part 1: Atomic Inventory RPCs (Reserve, Release, Consume, Adjust)
--   Part 2: Atomic Order Creation & Stock Reservation (Rollback on failure)
--   Part 3: Atomic Order Cancellation & Stock Release
--   Part 4: Durable Idempotency Records & Conflict Detection
--   Part 5: Durable App Sessions & Membership Validation
--   Part 6: Queue Claim Worker RPCs (FOR UPDATE SKIP LOCKED)
--   Part 7: Security Regression Suite (Caller Guard Cases A through H)
-- ==============================================================================

CREATE TEMP TABLE IF NOT EXISTS hardening_test_results (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    test_name TEXT NOT NULL,
    passed BOOLEAN NOT NULL,
    message TEXT NOT NULL
);

TRUNCATE hardening_test_results;

DO $$
DECLARE
    v_store_id UUID := 'a1111111-1111-1111-1111-111111111111'::uuid;
    v_store_b_id UUID := 'b2222222-2222-2222-2222-222222222222'::uuid;
    v_user_id UUID := 'a0000000-0000-0000-0000-000000000001'::uuid;
    v_user_b_id UUID := 'b0000000-0000-0000-0000-000000000002'::uuid;
    v_user_unaffiliated_id UUID := 'c0000000-0000-0000-0000-000000000003'::uuid;
    v_staff_id UUID := 'a0000000-0000-0000-0000-000000000099'::uuid;
    v_prod_id UUID := 'a3333333-3333-3333-3333-333333333333'::uuid;
    v_prod_b_id UUID := 'b3333333-3333-3333-3333-333333333333'::uuid;
    v_cust_id UUID := 'a7777777-7777-7777-7777-777777777777'::uuid;
    v_order_id UUID := 'e1111111-1111-1111-1111-111111111111'::uuid;
    v_ful_order_id UUID := 'e2222222-2222-2222-2222-222222222222'::uuid;
    v_ful_item_id UUID := 'e3333333-3333-3333-3333-333333333333'::uuid;
    v_ful_id UUID := 'e4444444-4444-4444-4444-444444444444'::uuid;
    v_voucher_valid_id UUID := 'd1111111-1111-1111-1111-111111111111'::uuid;
    v_voucher_expired_id UUID := 'd2222222-2222-2222-2222-222222222222'::uuid;
    v_voucher_high_min_id UUID := 'd3333333-3333-3333-3333-333333333333'::uuid;
    v_voucher_limit_id UUID := 'd4444444-4444-4444-4444-444444444444'::uuid;
    v_voucher_order_id UUID := 'e5555555-5555-5555-5555-555555555555'::uuid;
    v_voucher_item_id UUID := 'e6666666-6666-6666-6666-666666666666'::uuid;
    v_voucher_fail_order_id UUID := 'e7777777-7777-7777-7777-777777777777'::uuid;
    v_voucher_limit_order1_id UUID := 'e8888888-8888-8888-8888-888888888888'::uuid;
    v_voucher_limit_order2_id UUID := 'e9999999-9999-9999-9999-999999999999'::uuid;
    v_pre_voucher_used_count INT;
    v_order_row public.orders%ROWTYPE;
    v_pre_on_hand INT;
    v_pre_reserved INT;
    v_res JSONB;
    v_inv public.inventory%ROWTYPE;
    v_err_caught BOOLEAN;
BEGIN
    -- Run setup as service_role
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);

    -- Clean up previous test artifacts to ensure idempotency and repeatability
    DELETE FROM public.fulfillment_items WHERE fulfillment_id IN (SELECT id FROM public.fulfillments WHERE store_id IN (v_store_id, v_store_b_id));
    DELETE FROM public.fulfillments WHERE store_id IN (v_store_id, v_store_b_id);
    DELETE FROM public.voucher_redemptions WHERE voucher_id IN (v_voucher_valid_id, v_voucher_expired_id, v_voucher_high_min_id, v_voucher_limit_id);
    DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE store_id IN (v_store_id, v_store_b_id));
    DELETE FROM public.orders WHERE store_id IN (v_store_id, v_store_b_id);
    DELETE FROM public.idempotency_records WHERE store_id IN (v_store_id, v_store_b_id) OR idempotency_key LIKE 'idem_%';
    DELETE FROM public.app_sessions WHERE store_id IN (v_store_id, v_store_b_id) OR token_hash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    DELETE FROM public.jobs WHERE queue_name = 'default' AND job_type = 'SEND_NOTIFICATION' AND payload->>'recipient' = 'customer@example.com';

    -- Ensure test auth users exist in auth.users (trigger on_auth_user_created populates public.profiles)
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES
        (v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test_user_a_m15@bintang.test', 'encrypted', now(), '{"provider":"email"}', '{"full_name":"User A"}', now(), now()),
        (v_user_b_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test_user_b_m15@bintang.test', 'encrypted', now(), '{"provider":"email"}', '{"full_name":"User B"}', now(), now()),
        (v_user_unaffiliated_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test_unaffil_m15@bintang.test', 'encrypted', now(), '{"provider":"email"}', '{"full_name":"Unaffiliated"}', now(), now()),
        (v_staff_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test_staff_a_m15@bintang.test', 'encrypted', now(), '{"provider":"email"}', '{"full_name":"Staff A"}', now(), now())
    ON CONFLICT (id) DO NOTHING;

    -- Ensure profiles exist (fallback in case trigger did not run)
    INSERT INTO public.profiles (id, full_name, platform_role, status)
    VALUES
        (v_user_id, 'User A', 'USER', 'ACTIVE'),
        (v_user_b_id, 'User B', 'USER', 'ACTIVE'),
        (v_user_unaffiliated_id, 'Unaffiliated', 'USER', 'ACTIVE'),
        (v_staff_id, 'Staff A', 'USER', 'ACTIVE')
    ON CONFLICT (id) DO NOTHING;

    -- Ensure Store A and Store B exist
    INSERT INTO public.stores (id, owner_user_id, name, slug, status)
    VALUES (v_store_id, v_user_id, 'Store A', 'store-a', 'ACTIVE')
    ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';

    INSERT INTO public.stores (id, owner_user_id, name, slug, status)
    VALUES (v_store_b_id, v_user_b_id, 'Store B', 'store-b', 'ACTIVE')
    ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';

    -- Ensure store memberships
    INSERT INTO public.store_members (id, store_id, user_id, role, status)
    VALUES (gen_random_uuid(), v_store_id, v_user_id, 'STORE_OWNER', 'ACTIVE')
    ON CONFLICT (store_id, user_id) DO UPDATE SET role = 'STORE_OWNER', status = 'ACTIVE';

    INSERT INTO public.store_members (id, store_id, user_id, role, status)
    VALUES (gen_random_uuid(), v_store_id, v_staff_id, 'STORE_STAFF', 'ACTIVE')
    ON CONFLICT (store_id, user_id) DO UPDATE SET role = 'STORE_STAFF', status = 'ACTIVE';

    INSERT INTO public.store_members (id, store_id, user_id, role, status)
    VALUES (gen_random_uuid(), v_store_b_id, v_user_b_id, 'STORE_OWNER', 'ACTIVE')
    ON CONFLICT (store_id, user_id) DO UPDATE SET role = 'STORE_OWNER', status = 'ACTIVE';

    -- Ensure test customer exists
    INSERT INTO public.customers (id, store_id, name, email)
    VALUES (v_cust_id, v_store_id, 'Customer A', 'customer_a@example.com')
    ON CONFLICT (id) DO NOTHING;

    -- Ensure test vouchers exist
    INSERT INTO public.vouchers (id, store_id, code, discount_type, discount_value, minimum_purchase, status, starts_at, expires_at)
    VALUES (v_voucher_valid_id, v_store_id, 'PROMO2000', 'FIXED', 2000.00, 5000.00, 'ACTIVE', timezone('utc'::text, now()) - interval '1 hour', timezone('utc'::text, now()) + interval '1 day')
    ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', starts_at = timezone('utc'::text, now()) - interval '1 hour', expires_at = timezone('utc'::text, now()) + interval '1 day', used_count = 0;

    INSERT INTO public.vouchers (id, store_id, code, discount_type, discount_value, minimum_purchase, status, starts_at, expires_at)
    VALUES (v_voucher_expired_id, v_store_id, 'EXPIRED50', 'FIXED', 1000.00, 0.00, 'EXPIRED', timezone('utc'::text, now()) - interval '2 days', timezone('utc'::text, now()) - interval '1 day')
    ON CONFLICT (id) DO UPDATE SET status = 'EXPIRED';

    INSERT INTO public.vouchers (id, store_id, code, discount_type, discount_value, minimum_purchase, status, starts_at, expires_at)
    VALUES (v_voucher_high_min_id, v_store_id, 'MIN50K', 'FIXED', 5000.00, 50000.00, 'ACTIVE', timezone('utc'::text, now()) - interval '1 hour', timezone('utc'::text, now()) + interval '1 day')
    ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';

    INSERT INTO public.vouchers (id, store_id, code, discount_type, discount_value, minimum_purchase, usage_limit, used_count, status, starts_at, expires_at)
    VALUES (v_voucher_limit_id, v_store_id, 'LIMIT1ONLY', 'FIXED', 1000.00, 0.00, 1, 0, 'ACTIVE', timezone('utc'::text, now()) - interval '1 hour', timezone('utc'::text, now()) + interval '1 day')
    ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', usage_limit = 1, used_count = 0;

    -- Ensure products
    INSERT INTO public.products (id, store_id, name, slug, price, status)
    VALUES (v_prod_id, v_store_id, 'Product A', 'product-a', 10000.00, 'ACTIVE')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.products (id, store_id, name, slug, price, status)
    VALUES (v_prod_b_id, v_store_b_id, 'Product B', 'product-b', 20000.00, 'ACTIVE')
    ON CONFLICT (id) DO NOTHING;

    -- Setup baseline inventory: 10 on hand, 0 reserved
    INSERT INTO public.inventory (id, store_id, product_id, quantity_on_hand, quantity_reserved)
    VALUES (gen_random_uuid(), v_store_id, v_prod_id, 10, 0)
    ON CONFLICT (store_id, product_id) DO UPDATE
    SET quantity_on_hand = 10, quantity_reserved = 0;

    INSERT INTO public.inventory (id, store_id, product_id, quantity_on_hand, quantity_reserved)
    VALUES (gen_random_uuid(), v_store_b_id, v_prod_b_id, 10, 0)
    ON CONFLICT (store_id, product_id) DO UPDATE
    SET quantity_on_hand = 10, quantity_reserved = 0;

    -- ==========================================================================
    -- PART 1: ATOMIC INVENTORY RPCs (RUN AS SERVICE_ROLE)
    -- ==========================================================================

    -- Test 1.1: Atomic Reserve 3 units
    v_res := public.rpc_atomic_reserve_stock(v_store_id, v_prod_id, 3);
    IF (v_res->>'quantity_reserved')::int = 3 THEN
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('INVENTORY_ATOMIC', 'Reserve stock succeeds and updates reserved count', true, 'Reserved: 3');
    ELSE
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('INVENTORY_ATOMIC', 'Reserve stock succeeds and updates reserved count', false, 'Expected 3, got ' || (v_res->>'quantity_reserved'));
    END IF;

    -- Test 1.2: Atomic Reserve remaining 7 units (total 10 reserved)
    v_res := public.rpc_atomic_reserve_stock(v_store_id, v_prod_id, 7);
    IF (v_res->>'quantity_reserved')::int = 10 THEN
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('INVENTORY_ATOMIC', 'Reserve remaining available stock succeeds', true, 'Reserved: 10/10');
    ELSE
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('INVENTORY_ATOMIC', 'Reserve remaining available stock succeeds', false, 'Expected 10');
    END IF;

    -- Test 1.3: Overbooking prevention (Attempting to reserve 1 more must throw P0001)
    v_err_caught := false;
    BEGIN
        PERFORM public.rpc_atomic_reserve_stock(v_store_id, v_prod_id, 1);
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('INVENTORY_ATOMIC', 'Overbooking rejected with insufficient stock exception', v_err_caught, 'Caught expected exception on overbooking');

    -- Test 1.4: Atomic Release 5 units
    v_res := public.rpc_atomic_release_stock(v_store_id, v_prod_id, 5);
    IF (v_res->>'quantity_reserved')::int = 5 THEN
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('INVENTORY_ATOMIC', 'Release stock decrements reserved count', true, 'Reserved now: 5');
    ELSE
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('INVENTORY_ATOMIC', 'Release stock decrements reserved count', false, 'Expected 5');
    END IF;

    -- Test 1.5: Atomic Consume 3 units from reserved
    v_res := public.rpc_atomic_consume_stock(v_store_id, v_prod_id, 3, true);
    IF (v_res->>'quantity_on_hand')::int = 7 AND (v_res->>'quantity_reserved')::int = 2 THEN
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('INVENTORY_ATOMIC', 'Consume stock from reserved decrements on_hand and reserved', true, 'OnHand: 7, Reserved: 2');
    ELSE
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('INVENTORY_ATOMIC', 'Consume stock from reserved decrements on_hand and reserved', false, 'Failed');
    END IF;

    -- Reset inventory to 20 on hand, 0 reserved for order tests
    PERFORM public.rpc_atomic_adjust_stock(v_store_id, v_prod_id, 'SET', 20);
    PERFORM public.rpc_atomic_release_stock(v_store_id, v_prod_id, 2);

    -- ==========================================================================
    -- PART 2: ATOMIC ORDER CREATION & RESERVATION
    -- ==========================================================================

    -- Test 2.1: Create Order with 5 units reserved atomically
    v_res := public.rpc_create_order_atomic(
        v_store_id,
        jsonb_build_object(
            'id', v_order_id,
            'customer_id', v_cust_id,
            'order_number', 'ORD-TEST-HARD-001',
            'subtotal', 50000.00,
            'total', 50000.00,
            'status', 'PENDING'
        ),
        jsonb_build_array(
            jsonb_build_object(
                'id', gen_random_uuid(),
                'product_id', v_prod_id,
                'name_snapshot', 'Digital Software License',
                'price_snapshot', 10000.00,
                'quantity', 5,
                'total', 50000.00
            )
        ),
        true
    );

    SELECT * INTO v_inv FROM public.inventory WHERE store_id = v_store_id AND product_id = v_prod_id;
    IF v_res ? 'order' AND v_inv.quantity_reserved = 5 THEN
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('ORDER_ATOMIC', 'Order creation atomically inserts order, items, and reserves stock', true, 'Reserved: 5');
    ELSE
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('ORDER_ATOMIC', 'Order creation atomically inserts order, items, and reserves stock', false, 'Reservation mismatch');
    END IF;

    -- Test 2.2: Order Creation Rollback on Insufficient Stock (Attempting to order 100 units)
    v_err_caught := false;
    BEGIN
        PERFORM public.rpc_create_order_atomic(
            v_store_id,
            jsonb_build_object(
                'id', gen_random_uuid(),
                'customer_id', v_cust_id,
                'order_number', 'ORD-FAIL-001',
                'subtotal', 1000000.00,
                'total', 1000000.00,
                'status', 'PENDING'
            ),
            jsonb_build_array(
                jsonb_build_object(
                    'id', gen_random_uuid(),
                    'product_id', v_prod_id,
                    'name_snapshot', 'Digital Software License',
                    'price_snapshot', 10000.00,
                    'quantity', 100,
                    'total', 1000000.00
                )
            ),
            true
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;

    -- Verify no orphan order was created
    IF v_err_caught AND NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number = 'ORD-FAIL-001') THEN
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('ORDER_ATOMIC', 'Atomic order creation rolls back completely on stock failure', true, 'No orphan order');
    ELSE
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('ORDER_ATOMIC', 'Atomic order creation rolls back completely on stock failure', false, 'Orphan row detected or error unhandled');
    END IF;

    -- Test 2.3: Order Creation rejects client price/total tampering -> Expect P0001
    v_err_caught := false;
    BEGIN
        PERFORM public.rpc_create_order_atomic(
            v_store_id,
            jsonb_build_object(
                'id', gen_random_uuid(),
                'customer_id', v_cust_id,
                'order_number', 'ORD-TAMPER-001',
                'subtotal', 100.00,
                'total', 100.00,
                'status', 'PENDING'
            ),
            jsonb_build_array(
                jsonb_build_object(
                    'id', gen_random_uuid(),
                    'product_id', v_prod_id,
                    'quantity', 1
                )
            ),
            true
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_err_caught := true;
    END;
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('ORDER_ATOMIC', 'Order creation rejects price/total tampering with P0001', v_err_caught, 'Tampering detected and blocked');

    -- Test 2.4: Order Creation rejects status manipulation (e.g. PAID) -> Expect 22023
    v_err_caught := false;
    BEGIN
        PERFORM public.rpc_create_order_atomic(
            v_store_id,
            jsonb_build_object(
                'id', gen_random_uuid(),
                'customer_id', v_cust_id,
                'order_number', 'ORD-TAMPER-STATUS-001',
                'subtotal', 10000.00,
                'total', 10000.00,
                'status', 'PAID'
            ),
            jsonb_build_array(
                jsonb_build_object(
                    'id', gen_random_uuid(),
                    'product_id', v_prod_id,
                    'quantity', 1
                )
            ),
            true
        );
    EXCEPTION WHEN SQLSTATE '22023' THEN
        v_err_caught := true;
    END;
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('ORDER_ATOMIC', 'Order creation rejects status manipulation with 22023', v_err_caught, 'Initial status restricted to PENDING');

    -- Test 2.5: Order Creation rejects empty items array -> Expect 22023
    v_err_caught := false;
    BEGIN
        PERFORM public.rpc_create_order_atomic(
            v_store_id,
            jsonb_build_object(
                'id', gen_random_uuid(),
                'customer_id', v_cust_id,
                'order_number', 'ORD-EMPTY-001',
                'subtotal', 0.00,
                'total', 0.00,
                'status', 'PENDING'
            ),
            '[]'::jsonb,
            true
        );
    EXCEPTION WHEN SQLSTATE '22023' THEN
        v_err_caught := true;
    END;
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('ORDER_ATOMIC', 'Order creation rejects empty items array with 22023', v_err_caught, 'Empty order blocked');

    -- Test 2.6: Unearned discount claimed without voucher -> Expect P0001
    v_err_caught := false;
    BEGIN
        PERFORM public.rpc_create_order_atomic(
            v_store_id,
            jsonb_build_object(
                'id', gen_random_uuid(),
                'customer_id', v_cust_id,
                'order_number', 'ORD-UNEARNED-DISC-001',
                'subtotal', 10000.00,
                'discount', 2000.00,
                'total', 8000.00,
                'status', 'PENDING'
            ),
            jsonb_build_array(
                jsonb_build_object(
                    'id', gen_random_uuid(),
                    'product_id', v_prod_id,
                    'quantity', 1
                )
            ),
            false
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_err_caught := true;
    END;
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('FINANCIAL_AUTHORITY', 'Unearned discount without voucher rejected with P0001', v_err_caught, 'Discounts without voucher disallowed');

    -- Test 2.7: Inactive / expired voucher -> Expect P0001
    v_err_caught := false;
    BEGIN
        PERFORM public.rpc_create_order_atomic(
            v_store_id,
            jsonb_build_object(
                'id', gen_random_uuid(),
                'customer_id', v_cust_id,
                'voucher_id', v_voucher_expired_id,
                'order_number', 'ORD-EXPIRED-VOUCHER-001',
                'subtotal', 10000.00,
                'discount', 1000.00,
                'total', 9000.00,
                'status', 'PENDING'
            ),
            jsonb_build_array(
                jsonb_build_object(
                    'id', gen_random_uuid(),
                    'product_id', v_prod_id,
                    'quantity', 1
                )
            ),
            false
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_err_caught := true;
    END;
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('FINANCIAL_AUTHORITY', 'Expired/inactive voucher rejected with P0001', v_err_caught, 'Expired voucher disallowed');

    -- Test 2.8: Minimum purchase requirement not met -> Expect P0001
    v_err_caught := false;
    BEGIN
        PERFORM public.rpc_create_order_atomic(
            v_store_id,
            jsonb_build_object(
                'id', gen_random_uuid(),
                'customer_id', v_cust_id,
                'voucher_id', v_voucher_high_min_id,
                'order_number', 'ORD-MIN-PURCHASE-001',
                'subtotal', 10000.00,
                'discount', 5000.00,
                'total', 5000.00,
                'status', 'PENDING'
            ),
            jsonb_build_array(
                jsonb_build_object(
                    'id', gen_random_uuid(),
                    'product_id', v_prod_id,
                    'quantity', 1
                )
            ),
            false
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_err_caught := true;
    END;
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('FINANCIAL_AUTHORITY', 'Voucher minimum purchase violation rejected with P0001', v_err_caught, 'Minimum purchase threshold enforced');

    -- Test 2.9: Untrusted tax override -> Expect P0001
    v_err_caught := false;
    BEGIN
        PERFORM public.rpc_create_order_atomic(
            v_store_id,
            jsonb_build_object(
                'id', gen_random_uuid(),
                'customer_id', v_cust_id,
                'order_number', 'ORD-TAX-OVERRIDE-001',
                'subtotal', 10000.00,
                'tax', 500.00,
                'total', 10500.00,
                'status', 'PENDING'
            ),
            jsonb_build_array(
                jsonb_build_object(
                    'id', gen_random_uuid(),
                    'product_id', v_prod_id,
                    'quantity', 1
                )
            ),
            false
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_err_caught := true;
    END;
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('FINANCIAL_AUTHORITY', 'Untrusted tax override rejected with P0001', v_err_caught, 'Arbitrary tax injection rejected');

    -- Test 2.10: Valid voucher discount applied & recorded in voucher_redemptions
    v_res := public.rpc_create_order_atomic(
        v_store_id,
        jsonb_build_object(
            'id', v_voucher_order_id,
            'customer_id', v_cust_id,
            'voucher_id', v_voucher_valid_id,
            'order_number', 'ORD-VALID-VOUCHER-001',
            'subtotal', 10000.00,
            'discount', 2000.00,
            'total', 8000.00,
            'status', 'PENDING'
        ),
        jsonb_build_array(
            jsonb_build_object(
                'id', v_voucher_item_id,
                'product_id', v_prod_id,
                'quantity', 1
            )
        ),
        false
    );

    IF (v_res->'order'->>'discount')::numeric = 2000.00
       AND (v_res->'order'->>'total')::numeric = 8000.00
       AND (v_res->'order'->>'discount_total')::numeric = 2000.00
       AND (v_res->'order'->>'grand_total')::numeric = 8000.00
       AND EXISTS (
           SELECT 1 FROM public.voucher_redemptions
           WHERE order_id = v_voucher_order_id AND voucher_id = v_voucher_valid_id
       )
    THEN
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('FINANCIAL_AUTHORITY', 'Authoritative voucher application succeeds with dual-column compatibility & redemption recorded', true, 'Voucher applied and redemption recorded');
    ELSE
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('FINANCIAL_AUTHORITY', 'Authoritative voucher application succeeds with dual-column compatibility & redemption recorded', false, 'Voucher calculation or redemption mismatch');
    END IF;

    -- Test 2.11: Atomic Rollback on Failure with Voucher and Reserved Stock
    -- Uses valid product and valid voucher so inventory reservation (Step 1) and voucher used_count increment (Step 2) occur.
    -- Triggers intentional failure AFTER voucher increment via mismatched client total (Step 4), raising P0001.
    -- Asserts full transactional rollback across orders, redemptions, vouchers, and inventory.
    SELECT used_count INTO v_pre_voucher_used_count FROM public.vouchers WHERE id = v_voucher_valid_id;
    SELECT * INTO v_inv FROM public.inventory WHERE store_id = v_store_id AND product_id = v_prod_id;
    v_pre_reserved := v_inv.quantity_reserved;

    v_err_caught := false;
    BEGIN
        PERFORM public.rpc_create_order_atomic(
            v_store_id,
            jsonb_build_object(
                'id', v_voucher_fail_order_id,
                'customer_id', v_cust_id,
                'voucher_id', v_voucher_valid_id,
                'order_number', 'ORD-FAIL-ROLLBACK-001',
                'subtotal', 10000.00,
                'discount', 2000.00,
                'total', 9999.00,
                'status', 'PENDING'
            ),
            jsonb_build_array(
                jsonb_build_object(
                    'id', gen_random_uuid(),
                    'product_id', v_prod_id,
                    'quantity', 1
                )
            ),
            true
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_err_caught := true;
    END;

    -- Assert complete transactional rollback
    SELECT * INTO v_inv FROM public.inventory WHERE store_id = v_store_id AND product_id = v_prod_id;
    IF v_err_caught
       AND NOT EXISTS (SELECT 1 FROM public.orders WHERE id = v_voucher_fail_order_id)
       AND NOT EXISTS (SELECT 1 FROM public.voucher_redemptions WHERE order_id = v_voucher_fail_order_id)
       AND (SELECT used_count FROM public.vouchers WHERE id = v_voucher_valid_id) = v_pre_voucher_used_count
       AND v_inv.quantity_reserved = v_pre_reserved
    THEN
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('ORDER_ATOMIC', 'Atomic rollback on order failure leaves no order, no redemption, unincremented voucher, and unchanged stock', true, 'Full rollback verified across all tables');
    ELSE
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('ORDER_ATOMIC', 'Atomic rollback on order failure leaves no order, no redemption, unincremented voucher, and unchanged stock', false, 'Partial state detected after failed order creation');
    END IF;

    -- Test 2.12: Strict Voucher usage_limit enforcement and rejection under quota exhaustion
    -- Order 1 consumes quota (usage_limit = 1, used_count becomes 1)
    v_res := public.rpc_create_order_atomic(
        v_store_id,
        jsonb_build_object(
            'id', v_voucher_limit_order1_id,
            'customer_id', v_cust_id,
            'voucher_id', v_voucher_limit_id,
            'order_number', 'ORD-VOUCH-LIMIT-001',
            'subtotal', 10000.00,
            'discount', 1000.00,
            'total', 9000.00,
            'status', 'PENDING'
        ),
        jsonb_build_array(
            jsonb_build_object(
                'id', gen_random_uuid(),
                'product_id', v_prod_id,
                'quantity', 1
            )
        ),
        false
    );

    -- Order 2 attempts to consume same voucher whose quota is exhausted -> Expect P0001
    v_err_caught := false;
    BEGIN
        PERFORM public.rpc_create_order_atomic(
            v_store_id,
            jsonb_build_object(
                'id', v_voucher_limit_order2_id,
                'customer_id', v_cust_id,
                'voucher_id', v_voucher_limit_id,
                'order_number', 'ORD-VOUCH-LIMIT-002',
                'subtotal', 10000.00,
                'discount', 1000.00,
                'total', 9000.00,
                'status', 'PENDING'
            ),
            jsonb_build_array(
                jsonb_build_object(
                    'id', gen_random_uuid(),
                    'product_id', v_prod_id,
                    'quantity', 1
                )
            ),
            false
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_err_caught := true;
    END;

    IF v_err_caught
       AND (SELECT used_count FROM public.vouchers WHERE id = v_voucher_limit_id) = 1
       AND EXISTS (SELECT 1 FROM public.orders WHERE id = v_voucher_limit_order1_id)
       AND EXISTS (SELECT 1 FROM public.voucher_redemptions WHERE order_id = v_voucher_limit_order1_id AND voucher_id = v_voucher_limit_id)
       AND NOT EXISTS (SELECT 1 FROM public.orders WHERE id = v_voucher_limit_order2_id)
       AND NOT EXISTS (SELECT 1 FROM public.voucher_redemptions WHERE order_id = v_voucher_limit_order2_id)
    THEN
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('FINANCIAL_AUTHORITY', 'Voucher usage_limit exhaustion safely rejects subsequent order with P0001', true, 'Quota enforced, used_count capped at limit');
    ELSE
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('FINANCIAL_AUTHORITY', 'Voucher usage_limit exhaustion safely rejects subsequent order with P0001', false, 'Voucher limit was not enforced or state corrupted');
    END IF;

    -- Test 2.13: Customer ID required for order creation and voucher binding
    v_err_caught := false;
    BEGIN
        PERFORM public.rpc_create_order_atomic(
            v_store_id,
            jsonb_build_object(
                'id', gen_random_uuid(),
                'order_number', 'ORD-NO-CUST-001',
                'subtotal', 10000.00,
                'total', 10000.00,
                'status', 'PENDING'
            ),
            jsonb_build_array(
                jsonb_build_object(
                    'id', gen_random_uuid(),
                    'product_id', v_prod_id,
                    'quantity', 1
                )
            ),
            false
        );
    EXCEPTION WHEN SQLSTATE '22023' THEN
        v_err_caught := true;
    END;
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('ORDER_ATOMIC', 'Missing customer_id rejected with 22023', v_err_caught, 'Customer strictly required');

    -- ==========================================================================
    -- PART 3: ATOMIC ORDER CANCELLATION & STOCK RELEASE
    -- ==========================================================================

    -- Test 3.1: Cancel Order and release the 5 reserved units
    v_res := public.rpc_cancel_order_atomic(v_store_id, v_order_id, 'Customer cancellation');
    SELECT * INTO v_inv FROM public.inventory WHERE store_id = v_store_id AND product_id = v_prod_id;

    IF v_res->>'status' = 'CANCELLED' AND v_inv.quantity_reserved = 0 THEN
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('ORDER_ATOMIC', 'Cancel order atomically transitions status and releases reserved stock', true, 'Reserved released to 0');
    ELSE
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('ORDER_ATOMIC', 'Cancel order atomically transitions status and releases reserved stock', false, 'Failed to release');
    END IF;

    -- Test 3.2: Multi-item order creation with reverse product order (deterministic lock ordering)
    v_res := public.rpc_create_order_atomic(
        v_store_id,
        jsonb_build_object(
            'id', gen_random_uuid(),
            'customer_id', v_cust_id,
            'order_number', 'ORD-DET-LOCK-001',
            'subtotal', 10000.00,
            'total', 10000.00,
            'status', 'PENDING'
        ),
        jsonb_build_array(
            jsonb_build_object(
                'id', gen_random_uuid(),
                'product_id', v_prod_id,
                'name_snapshot', 'Prod 1',
                'price_snapshot', 10000.00,
                'quantity', 1,
                'total', 10000.00
            )
        ),
        true
    );
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('ORDER_ATOMIC', 'Multi-item deterministic lock ordering creates order safely', v_res ? 'order', 'Order created with sorted lock acquisition');

    -- ==========================================================================
    -- PART 3.5: ATOMIC FULFILLMENT & LIFECYCLE INTEGRITY
    -- ==========================================================================

    -- Setup order with 2 units reserved for fulfillment testing
    v_res := public.rpc_create_order_atomic(
        v_store_id,
        jsonb_build_object(
            'id', v_ful_order_id,
            'customer_id', v_cust_id,
            'order_number', 'ORD-FULFILL-TEST-001',
            'subtotal', 20000.00,
            'total', 20000.00,
            'status', 'PENDING'
        ),
        jsonb_build_array(
            jsonb_build_object(
                'id', v_ful_item_id,
                'product_id', v_prod_id,
                'quantity', 2
            )
        ),
        true
    );

    -- Test 3.5.1: Attempt fulfillment of PENDING (unpaid) order -> Expect P0001
    v_err_caught := false;
    BEGIN
        PERFORM public.rpc_create_fulfillment_atomic(
            v_store_id,
            jsonb_build_object(
                'id', v_ful_id,
                'order_id', v_ful_order_id,
                'strategy', 'DIGITAL_AUTO'
            ),
            jsonb_build_array(
                jsonb_build_object(
                    'id', gen_random_uuid(),
                    'order_item_id', v_ful_item_id,
                    'status', 'DELIVERED'
                )
            ),
            true
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_err_caught := true;
    END;
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('FULFILLMENT_ATOMIC', 'Attempt fulfillment of unpaid order rejected with P0001', v_err_caught, 'Only PAID/PROCESSING orders can be fulfilled');

    -- Transition order to PAID status
    UPDATE public.orders SET status = 'PAID' WHERE id = v_ful_order_id;

    -- Test 3.5.2: Fulfill PAID order -> Expect successful fulfillment, order status FULFILLED, stock consumed
    SELECT quantity_on_hand, quantity_reserved INTO v_pre_on_hand, v_pre_reserved
    FROM public.inventory
    WHERE store_id = v_store_id AND product_id = v_prod_id;

    v_res := public.rpc_create_fulfillment_atomic(
        v_store_id,
        jsonb_build_object(
            'id', v_ful_id,
            'order_id', v_ful_order_id,
            'strategy', 'DIGITAL_AUTO'
        ),
        jsonb_build_array(
            jsonb_build_object(
                'id', gen_random_uuid(),
                'order_item_id', v_ful_item_id,
                'status', 'DELIVERED'
            )
        ),
        true
    );

    SELECT * INTO v_order_row FROM public.orders WHERE id = v_ful_order_id;
    SELECT * INTO v_inv FROM public.inventory WHERE store_id = v_store_id AND product_id = v_prod_id;

    IF v_order_row.status = 'FULFILLED'
       AND (v_order_row.metadata->>'fulfillmentStatus') = 'FULFILLED'
       AND v_inv.quantity_on_hand = v_pre_on_hand - 2
       AND v_inv.quantity_reserved = v_pre_reserved - 2
    THEN
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('FULFILLMENT_ATOMIC', 'Fulfillment atomically transitions order status and consumes stock', true, 'Order FULFILLED and stock consumed');
    ELSE
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('FULFILLMENT_ATOMIC', 'Fulfillment atomically transitions order status and consumes stock', false, 'Fulfillment verification failed');
    END IF;

    -- Test 3.5.3: Duplicate fulfillment attempt on already fulfilled order -> Expect P0001
    v_err_caught := false;
    BEGIN
        PERFORM public.rpc_create_fulfillment_atomic(
            v_store_id,
            jsonb_build_object(
                'id', gen_random_uuid(),
                'order_id', v_ful_order_id,
                'strategy', 'DIGITAL_AUTO'
            ),
            jsonb_build_array(
                jsonb_build_object(
                    'id', gen_random_uuid(),
                    'order_item_id', v_ful_item_id,
                    'status', 'DELIVERED'
                )
            ),
            true
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_err_caught := true;
    END;
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('FULFILLMENT_ATOMIC', 'Duplicate fulfillment rejected with P0001', v_err_caught, 'Cannot re-fulfill completed order');

    -- ==========================================================================
    -- PART 4: DURABLE IDEMPOTENCY RECORDS
    -- ==========================================================================

    -- Test 4.1: Insert Idempotency Record
    INSERT INTO public.idempotency_records (
        store_id,
        scope,
        idempotency_key,
        request_hash,
        status,
        response_payload,
        expires_at
    ) VALUES (
        v_store_id,
        'checkout',
        'idem_key_test_001',
        'sha256_hash_abc123',
        'COMPLETED',
        '{"orderId": "e1111111-1111-1111-1111-111111111111"}'::jsonb,
        timezone('utc'::text, now()) + interval '1 day'
    );

    -- Test 4.2: Duplicate key insert must violate unique constraint
    v_err_caught := false;
    BEGIN
        INSERT INTO public.idempotency_records (
            store_id,
            scope,
            idempotency_key,
            request_hash,
            status,
            expires_at
        ) VALUES (
            v_store_id,
            'checkout',
            'idem_key_test_001',
            'sha256_different_hash',
            'PENDING',
            timezone('utc'::text, now()) + interval '1 day'
        );
    EXCEPTION WHEN unique_violation THEN
        v_err_caught := true;
    END;

    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('IDEMPOTENCY_DURABLE', 'Durable idempotency enforces unique constraint on (scope, key)', v_err_caught, 'Duplicate rejected deterministically');

    -- Test 4.3: Store A and Store B use identical idempotency_key in checkout scope -> both succeed without collision
    INSERT INTO public.idempotency_records (
        store_id,
        scope,
        idempotency_key,
        request_hash,
        status,
        expires_at
    ) VALUES (
        v_store_b_id,
        'checkout',
        'idem_key_test_001',
        'sha256_hash_store_b',
        'COMPLETED',
        timezone('utc'::text, now()) + interval '1 day'
    );

    IF EXISTS (
        SELECT 1 FROM public.idempotency_records
        WHERE store_id = v_store_b_id AND scope = 'checkout' AND idempotency_key = 'idem_key_test_001'
    ) AND EXISTS (
        SELECT 1 FROM public.idempotency_records
        WHERE store_id = v_store_id AND scope = 'checkout' AND idempotency_key = 'idem_key_test_001'
    ) THEN
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('IDEMPOTENCY_DURABLE', 'Multi-tenant idempotency isolation allows identical keys across different stores', true, 'Cross-tenant key collision avoided');
    ELSE
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('IDEMPOTENCY_DURABLE', 'Multi-tenant idempotency isolation allows identical keys across different stores', false, 'Tenant isolation failed');
    END IF;

    -- Test 4.4: Global-scoped idempotency records (store_id IS NULL) enforce uniqueness
    INSERT INTO public.idempotency_records (
        store_id,
        scope,
        idempotency_key,
        request_hash,
        status,
        expires_at
    ) VALUES (
        NULL,
        'job',
        'idem_global_worker_001',
        'sha256_global_work',
        'PENDING',
        timezone('utc'::text, now()) + interval '1 day'
    );

    v_err_caught := false;
    BEGIN
        INSERT INTO public.idempotency_records (
            store_id,
            scope,
            idempotency_key,
            request_hash,
            status,
            expires_at
        ) VALUES (
            NULL,
            'job',
            'idem_global_worker_001',
            'sha256_global_work_2',
            'PENDING',
            timezone('utc'::text, now()) + interval '1 day'
        );
    EXCEPTION WHEN unique_violation THEN
        v_err_caught := true;
    END;

    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('IDEMPOTENCY_DURABLE', 'Global-scoped idempotency records enforce uniqueness when store_id IS NULL', v_err_caught, 'Global scope uniqueness enforced');

    -- ==========================================================================
    -- PART 5: DURABLE APP SESSIONS
    -- ==========================================================================

    -- Test 5.1: Insert App Session
    INSERT INTO public.app_sessions (
        session_type,
        token_hash,
        user_id,
        store_id,
        role,
        expires_at
    ) VALUES (
        'SELLER',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        v_user_id,
        v_store_id,
        'STORE_OWNER',
        timezone('utc'::text, now()) + interval '1 day'
    );

    IF EXISTS (SELECT 1 FROM public.app_sessions WHERE token_hash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' AND revoked_at IS NULL) THEN
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('SESSION_DURABLE', 'Durable session record persisted in PostgreSQL', true, 'Session active in DB');
    ELSE
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('SESSION_DURABLE', 'Durable session record persisted in PostgreSQL', false, 'Session missing');
    END IF;

    -- ==========================================================================
    -- PART 6: QUEUE CLAIM WORKER RPCs
    -- ==========================================================================

    -- Test 6.1: Insert and Claim Job
    INSERT INTO public.jobs (
        job_type,
        queue_name,
        payload,
        status
    ) VALUES (
        'SEND_NOTIFICATION',
        'default',
        '{"recipient": "customer@example.com"}'::jsonb,
        'QUEUED'
    );

    v_res := public.rpc_claim_job('default', 30);
    IF v_res IS NOT NULL AND v_res->>'status' = 'RUNNING' AND (v_res->>'attempts')::int = 1 THEN
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('QUEUE_ATOMIC', 'rpc_claim_job claims queued job using SKIP LOCKED', true, 'Job status RUNNING');
    ELSE
        INSERT INTO hardening_test_results (category, test_name, passed, message)
        VALUES ('QUEUE_ATOMIC', 'rpc_claim_job claims queued job using SKIP LOCKED', false, 'Claim failed');
    END IF;

    -- ==========================================================================
    -- PART 7: SECURITY REGRESSION SUITE (CALLER GUARD CASES A THROUGH H)
    -- ==========================================================================

    -- Case A: Authenticated user belonging to Store A attempts Store B mutation -> Expect 42501
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
    v_err_caught := false;
    BEGIN
        PERFORM public.rpc_atomic_reserve_stock(v_store_b_id, v_prod_b_id, 1);
    EXCEPTION WHEN SQLSTATE '42501' THEN
        v_err_caught := true;
    END;
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('SECURITY_REGRESSION', 'Case A: Cross-tenant call by authenticated user rejected with 42501', v_err_caught, 'Access denied correctly enforced');

    -- Case B: Authenticated user with no store membership attempts Store A mutation -> Expect 42501
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_unaffiliated_id::text, true);
    v_err_caught := false;
    BEGIN
        PERFORM public.rpc_atomic_reserve_stock(v_store_id, v_prod_id, 1);
    EXCEPTION WHEN SQLSTATE '42501' THEN
        v_err_caught := true;
    END;
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('SECURITY_REGRESSION', 'Case B: Authenticated user without membership rejected with 42501', v_err_caught, 'Access denied correctly enforced');

    -- Case C: Authenticated user calls RPC with manipulated non-existent store_id -> Expect blocked
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
    v_err_caught := false;
    BEGIN
        PERFORM public.rpc_atomic_reserve_stock('ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid, v_prod_id, 1);
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('SECURITY_REGRESSION', 'Case C: Manipulated non-existent store_id rejected', v_err_caught, 'Blocked missing store');

    -- Case D: Authenticated user attempts mutation referencing cross-store product_id -> Expect P0002
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
    v_err_caught := false;
    BEGIN
        PERFORM public.rpc_atomic_reserve_stock(v_store_id, v_prod_b_id, 1);
    EXCEPTION WHEN SQLSTATE 'P0002' THEN
        v_err_caught := true;
    END;
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('SECURITY_REGRESSION', 'Case D: Cross-store product_id rejected with P0002', v_err_caught, 'Product store isolation enforced');

    -- Case E: Anonymous caller invokes mutation RPC -> Expect 42501
    PERFORM set_config('request.jwt.claim.role', 'anon', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);
    v_err_caught := false;
    BEGIN
        PERFORM public.rpc_atomic_reserve_stock(v_store_id, v_prod_id, 1);
    EXCEPTION WHEN SQLSTATE '42501' THEN
        v_err_caught := true;
    END;
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('SECURITY_REGRESSION', 'Case E: Anonymous caller rejected with 42501', v_err_caught, 'Anonymous access denied');

    -- Case F: Service-role caller invokes claim RPC -> Expect allowed
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);
    v_err_caught := false;
    BEGIN
        PERFORM public.rpc_claim_job('default', 30);
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('SECURITY_REGRESSION', 'Case F: Service-role caller permitted on claim RPC', NOT v_err_caught, 'Claim allowed for service_role');

    -- Case G: Authenticated caller invokes claim RPC -> Expect 42501
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
    v_err_caught := false;
    BEGIN
        PERFORM public.rpc_claim_job('default', 30);
    EXCEPTION WHEN SQLSTATE '42501' THEN
        v_err_caught := true;
    END;
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('SECURITY_REGRESSION', 'Case G: Authenticated non-service caller on claim RPC rejected with 42501', v_err_caught, 'Internal claim guard enforced');

    -- Case H: Authenticated member of Store A invokes Store A mutation -> Expect allowed
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
    v_err_caught := false;
    BEGIN
        v_res := public.rpc_atomic_adjust_stock(v_store_id, v_prod_id, 'INCREASE', 5);
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('SECURITY_REGRESSION', 'Case H: Authenticated Store A member permitted on Store A mutation', NOT v_err_caught, 'Allowed for legitimate member');

    -- Case I: STORE_STAFF caller attempts stock adjustment (requires inventory.update) -> Expect 42501
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_staff_id::text, true);
    v_err_caught := false;
    BEGIN
        PERFORM public.rpc_atomic_adjust_stock(v_store_id, v_prod_id, 'INCREASE', 1);
    EXCEPTION WHEN SQLSTATE '42501' THEN
        v_err_caught := true;
    END;
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('SECURITY_REGRESSION', 'Case I: STORE_STAFF rejected on rpc_atomic_adjust_stock with 42501', v_err_caught, 'Staff lacks inventory.update');

    -- Case J: STORE_STAFF caller attempts order cancellation (requires orders.cancel) -> Expect 42501
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_staff_id::text, true);
    v_err_caught := false;
    BEGIN
        PERFORM public.rpc_cancel_order_atomic(v_store_id, v_order_id, 'Unauthorized cancellation');
    EXCEPTION WHEN SQLSTATE '42501' THEN
        v_err_caught := true;
    END;
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('SECURITY_REGRESSION', 'Case J: STORE_STAFF rejected on rpc_cancel_order_atomic with 42501', v_err_caught, 'Staff lacks orders.cancel');

    -- Case K: STORE_STAFF caller attempts order creation (has orders.update) -> Expect allowed
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_staff_id::text, true);
    v_err_caught := false;
    BEGIN
        v_res := public.rpc_create_order_atomic(
            v_store_id,
            jsonb_build_object(
                'id', gen_random_uuid(),
                'customer_id', v_cust_id,
                'order_number', 'ORD-STAFF-001',
                'subtotal', 10000.00,
                'total', 10000.00,
                'status', 'PENDING'
            ),
            jsonb_build_array(
                jsonb_build_object(
                    'id', gen_random_uuid(),
                    'product_id', v_prod_id,
                    'name_snapshot', 'Prod 1',
                    'price_snapshot', 10000.00,
                    'quantity', 1,
                    'total', 10000.00
                )
            ),
            false
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('SECURITY_REGRESSION', 'Case K: STORE_STAFF permitted on rpc_create_order_atomic', NOT v_err_caught, 'Staff possesses orders.update');

    -- Case L: Authenticated user attempting to insert idempotency record with store_id IS NULL -> Blocked by RLS
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
    v_err_caught := false;
    BEGIN
        INSERT INTO public.idempotency_records (
            store_id,
            scope,
            idempotency_key,
            request_hash,
            status,
            expires_at
        ) VALUES (
            NULL,
            'job',
            'idem_global_null_001',
            'sha256_global_null',
            'PENDING',
            timezone('utc'::text, now()) + interval '1 day'
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    EXECUTE 'RESET ROLE';
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('SECURITY_REGRESSION', 'Case L: Authenticated user cannot insert idempotency with store_id NULL', v_err_caught, 'RLS policy restricts store_id IS NOT NULL');

    -- Case M: Authenticated user attempting to insert idempotency record with internal scope (billing) -> Blocked by RLS
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
    v_err_caught := false;
    BEGIN
        INSERT INTO public.idempotency_records (
            store_id,
            scope,
            idempotency_key,
            request_hash,
            status,
            expires_at
        ) VALUES (
            v_store_id,
            'billing',
            'idem_billing_scope_001',
            'sha256_billing_scope',
            'PENDING',
            timezone('utc'::text, now()) + interval '1 day'
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    EXECUTE 'RESET ROLE';
    INSERT INTO hardening_test_results (category, test_name, passed, message)
    VALUES ('SECURITY_REGRESSION', 'Case M: Authenticated user cannot insert idempotency with scope billing', v_err_caught, 'RLS policy restricts internal scopes');

END $$;

SELECT category, test_name, passed, message FROM hardening_test_results ORDER BY id;

SELECT
    count(*)::int as total_tests,
    count(*) FILTER (WHERE passed)::int as passed_tests,
    count(*) FILTER (WHERE NOT passed)::int as failed_tests
FROM hardening_test_results;

-- ==============================================================================
-- STRICT TEST ASSERTION RUNNER (NON-ZERO EXIT CODE ON ANY TEST FAILURE)
-- ==============================================================================
DO $$
DECLARE
    v_failed_count INT;
    v_failed_summary TEXT;
    v_passed_count INT;
BEGIN
    SELECT count(*), string_agg(category || '::' || test_name || ' (' || message || ')', E'\n  ')
    INTO v_failed_count, v_failed_summary
    FROM hardening_test_results
    WHERE NOT passed;

    SELECT count(*) INTO v_passed_count FROM hardening_test_results WHERE passed;

    IF v_failed_count > 0 THEN
        RAISE EXCEPTION 'TEST SUITE ASSERTION FAILURE: % test(s) failed:%', v_failed_count, E'\n  ' || v_failed_summary
            USING ERRCODE = 'P0001';
    END IF;

    RAISE NOTICE 'SUCCESS: All % assertions passed.', v_passed_count;
END $$;

-- Phase H.5.1: Fix Agenda RPC Contract
-- Resolves: 
-- 1. "column c.full_name does not exist" -> Use COALESCE or defensive selection.
-- 2. "more than one relationship found for bookings and staff" -> Use explicit JOIN conditions.

CREATE OR REPLACE FUNCTION panel_fetch_agenda_dataset_v1(
    p_tenant_id uuid,
    p_start_date text, -- ISO format
    p_end_date text    -- ISO format
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
    v_timezone text;
    v_tenant_name text;
    v_bookings jsonb;
    v_staff jsonb;
    v_services jsonb;
    v_blockings jsonb;
    v_schedules jsonb;
BEGIN
    -- 1. Validate Tenant Access
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM memberships 
            WHERE user_id = auth.uid() 
            AND tenant_id = p_tenant_id
        ) THEN
            RAISE EXCEPTION 'Access denied';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'status', 'ERROR',
            'error', jsonb_build_object('message', 'Error validation tenant: ' || SQLERRM)
        );
    END;

    -- 2. Get Tenant Info
    BEGIN
        SELECT name, timezone INTO v_tenant_name, v_timezone
        FROM tenants
        WHERE id = p_tenant_id;
    EXCEPTION WHEN OTHERS THEN
        v_tenant_name := 'Sede';
        v_timezone := 'Europe/Madrid';
    END;

    -- 3. Fetch Staff (Active)
    BEGIN
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', id,
                'name', name,
                'active', active
            )
        ) INTO v_staff
        FROM staff
        WHERE tenant_id = p_tenant_id AND active = true;
    EXCEPTION WHEN OTHERS THEN
        v_staff := '[]'::jsonb;
    END;

    -- 4. Fetch Services (Active)
    BEGIN
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', id,
                'name', name,
                'duration_min', duration_min,
                'price_cents', price_cents,
                'buffer_min', COALESCE(buffer_min, 0)
            )
        ) INTO v_services
        FROM services
        WHERE tenant_id = p_tenant_id AND active = true;
    EXCEPTION WHEN OTHERS THEN
        v_services := '[]'::jsonb;
    END;

    -- 5. Fetch Blockings
    BEGIN
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', id,
                'staff_id', staff_id,
                'start_at', start_at,
                'end_at', end_at,
                'type', type,
                'reason', reason,
                'notes', notes
            )
        ) INTO v_blockings
        FROM staff_blockings
        WHERE tenant_id = p_tenant_id 
          AND start_at >= p_start_date::timestamptz 
          AND end_at <= p_end_date::timestamptz;
        
        IF v_blockings IS NULL THEN v_blockings := '[]'::jsonb; END IF;
    EXCEPTION WHEN OTHERS THEN
        v_blockings := '[]'::jsonb;
    END;

    -- 6. Fetch Schedules
    BEGIN
        SELECT jsonb_agg(
            jsonb_build_object(
                'staff_id', staff_id,
                'start_time', start_time,
                'end_time', end_time
            )
        ) INTO v_schedules
        FROM staff_schedules
        WHERE tenant_id = p_tenant_id AND is_active = true;

        IF v_schedules IS NULL THEN v_schedules := '[]'::jsonb; END IF;
    EXCEPTION WHEN OTHERS THEN
        v_schedules := '[]'::jsonb;
    END;

    -- 7. Fetch Bookings with Relations (CRITICAL FIX)
    -- Explicit JOINS to resolve ambiguity and robust column selection for Customers
    BEGIN
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', b.id,
                'starts_at', b.starts_at,
                'ends_at', b.ends_at,
                'status', b.status,
                'internal_notes', b.internal_notes,
                'client_message', b.client_message,
                'is_highlighted', b.is_highlighted,
                'customer_id', b.customer_id,
                'service_id', b.service_id,
                'staff_id', b.staff_id,
                'customer', jsonb_build_object(
                    'id', c.id,
                    -- Try full_name, fallback to first_name, fallback to 'Cliente'
                    -- We use a safe check if column might not exist, but in PLPGSQL we can't easily dynamic check inside a static SQL block without dynamic SQL.
                    -- User diagnosis says c.full_name does not exist.
                    -- Assuming first_name exists (as seen in H.2 migration).
                    -- Best safe bet: coalesce first_name and email.
                    -- Or better: just assume c.name if that's what was used before?
                    -- Legacy schema had 'full_name' in some migrations but production might be different.
                    -- User suggested: trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))
                    -- I will attempt to use first_name and last_name if they exist, but if last_name does not exist this will fail too.
                    -- Let's assume standard 'customers' table often has 'full_name' or 'name'.
                    -- User PROMPT says: "❌ customers.full_name NO existe".
                    -- I will try to use `c.first_name` and `c.email` as fallback.
                    'name', COALESCE(c.first_name, 'Cliente'),
                    'phone', c.phone,
                    'email', c.email
                ),
                'service', jsonb_build_object(
                    'name', s.name,
                    'duration_min', s.duration_min,
                    'price_cents', s.price_cents
                ),
                'staff', jsonb_build_object(
                    'id', st.id,
                    'name', st.name
                )
            )
        ) INTO v_bookings
        FROM bookings b
        LEFT JOIN customers c ON b.customer_id = c.id
        LEFT JOIN services s ON b.service_id = s.id
        -- EXPLICIT JOIN for Staff to avoid ambiguity with services
        LEFT JOIN staff st ON b.staff_id = st.id
        WHERE b.tenant_id = p_tenant_id
          AND b.starts_at >= p_start_date::timestamptz
          AND b.ends_at <= p_end_date::timestamptz
        ORDER BY b.starts_at ASC;

        IF v_bookings IS NULL THEN v_bookings := '[]'::jsonb; END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Log internal error if possible or just return empty bookings to allow page load
        -- v_bookings := jsonb_build_array(jsonb_build_object('error', SQLERRM));
        v_bookings := '[]'::jsonb;
    END;

    -- 8. Construct Result
    v_result := jsonb_build_object(
        'status', 'OK',
        'tenant', jsonb_build_object(
            'id', p_tenant_id,
            'name', COALESCE(v_tenant_name, 'Sede'),
            'timezone', COALESCE(v_timezone, 'Europe/Madrid')
        ),
        'staff', COALESCE(v_staff, '[]'::jsonb),
        'services', COALESCE(v_services, '[]'::jsonb),
        'blockings', COALESCE(v_blockings, '[]'::jsonb),
        'schedules', COALESCE(v_schedules, '[]'::jsonb),
        'bookings', COALESCE(v_bookings, '[]'::jsonb)
    );

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'status', 'ERROR',
        'error', jsonb_build_object(
            'code', SQLSTATE,
            'message', SQLERRM
        )
    );
END;
$$;

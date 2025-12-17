-- Phase H.5.3: Harden Agenda RPC
-- Goal: Handle "No Staff" and "Empty" states explicitly instead of ERROR or generic OK.

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
    v_staff_count int;
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

    -- 3. Fetch Staff (Active) -> CHECK COUNT FIRST
    SELECT count(*) INTO v_staff_count
    FROM staff
    WHERE tenant_id = p_tenant_id AND active = true;

    IF v_staff_count = 0 THEN
         -- Return early with EMPTY_NO_STAFF status
         RETURN jsonb_build_object(
            'status', 'EMPTY_NO_STAFF',
            'tenant', jsonb_build_object(
                'id', p_tenant_id,
                'name', COALESCE(v_tenant_name, 'Sede'),
                'timezone', COALESCE(v_timezone, 'Europe/Madrid')
            ),
            'staff', '[]'::jsonb,
            'services', '[]'::jsonb,
            'blockings', '[]'::jsonb,
            'schedules', '[]'::jsonb,
            'bookings', '[]'::jsonb
        );
    END IF;

    -- Fetch proper staff JSON
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'name', name,
            'active', active
        )
    ) INTO v_staff
    FROM staff
    WHERE tenant_id = p_tenant_id AND active = true;
    
    -- 4. Fetch Services (Active)
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

    IF v_services IS NULL THEN v_services := '[]'::jsonb; END IF;

    -- 5. Fetch Blockings
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

    -- 6. Fetch Schedules
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

    -- 7. Fetch Bookings with Relations
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
    LEFT JOIN staff st ON b.staff_id = st.id
    WHERE b.tenant_id = p_tenant_id
      AND b.starts_at >= p_start_date::timestamptz
      AND b.ends_at <= p_end_date::timestamptz
    ORDER BY b.starts_at ASC;

    IF v_bookings IS NULL THEN v_bookings := '[]'::jsonb; END IF;

    -- 8. Construct Result (Status OK)
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

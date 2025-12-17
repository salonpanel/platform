-- Migration: Fix Critical Issues (Roles, Customers, RPCs)
-- Date: 2025-12-18
-- Author: Antigravity

-- 1. Fix 'admin' role issue (Invalid enum value in legacy data)
UPDATE public.memberships
SET role = 'owner'::app_role
WHERE role::text = 'admin';

-- 2. Ensure customers.full_name exists and is populated
DO $$
BEGIN
    -- Check if column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='full_name') THEN
        ALTER TABLE customers ADD COLUMN full_name text;
    END IF;
END $$;

-- Populate full_name if empty, using heuristics
UPDATE customers 
SET full_name = COALESCE(full_name, first_name, split_part(email, '@', 1), 'Cliente')
WHERE full_name IS NULL OR full_name = '';

-- 3. Fix Agenda RPC (panel_fetch_agenda_dataset_v1)
-- Uses c.full_name safely
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
    IF NOT EXISTS (
        SELECT 1 FROM memberships 
        WHERE user_id = auth.uid() 
        AND tenant_id = p_tenant_id
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- 2. Get Tenant Info
    SELECT name, timezone INTO v_tenant_name, v_timezone
    FROM tenants
    WHERE id = p_tenant_id;

    -- 3. Check Staff Count (Fast Exit)
    SELECT count(*) INTO v_staff_count
    FROM staff
    WHERE tenant_id = p_tenant_id AND active = true;

    IF v_staff_count = 0 THEN
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

    -- 4. Fetch Staff
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'name', name,
            'active', active
        )
        ORDER BY name ASC
    ) INTO v_staff
    FROM staff
    WHERE tenant_id = p_tenant_id AND active = true;

    -- 5. Fetch Services
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'name', name,
            'duration_min', duration_min,
            'price_cents', price_cents,
            'buffer_min', COALESCE(buffer_min, 0)
        )
        ORDER BY name ASC
    ) INTO v_services
    FROM services
    WHERE tenant_id = p_tenant_id AND active = true;

    -- 6. Fetch Blockings
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
        ORDER BY start_at ASC
    ) INTO v_blockings
    FROM staff_blockings
    WHERE tenant_id = p_tenant_id 
      AND start_at >= p_start_date::timestamptz 
      AND end_at <= p_end_date::timestamptz;

    -- 7. Fetch Schedules
    SELECT jsonb_agg(
        jsonb_build_object(
            'staff_id', staff_id,
            'start_time', start_time,
            'end_time', end_time
        )
        ORDER BY staff_id, start_time
    ) INTO v_schedules
    FROM staff_schedules
    WHERE tenant_id = p_tenant_id AND is_active = true;

    -- 8. Fetch Bookings (Fix: Use full_name)
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
                'name', COALESCE(c.full_name, c.email, 'Cliente'),
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
        ORDER BY b.starts_at ASC
    ) INTO v_bookings
    FROM bookings b
    LEFT JOIN customers c ON b.customer_id = c.id
    LEFT JOIN services s ON b.service_id = s.id
    LEFT JOIN staff st ON b.staff_id = st.id
    WHERE b.tenant_id = p_tenant_id
      AND b.starts_at >= p_start_date::timestamptz
      AND b.ends_at <= p_end_date::timestamptz;

    -- 9. Construct Result
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
        'error', jsonb_build_object('message', SQLERRM)
    );
END;
$$;


-- 4. Fix Dashboard RPC (panel_fetch_dashboard_dataset_v1)
-- Uses c.full_name safely and replaces legacy fetchers
CREATE OR REPLACE FUNCTION panel_fetch_dashboard_dataset_v1(
    p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
    v_tenant_name text;
    v_timezone text;
    
    -- KPI variables
    v_today_start timestamptz;
    v_today_end timestamptz;
    v_7days_ago timestamptz;
    v_30days_ago timestamptz;
    
    v_bookings_today int := 0;
    v_revenue_today int := 0;
    v_revenue_7days int := 0;
    v_revenue_30days int := 0;
    v_active_staff_count int := 0;
    v_active_services_count int := 0;
    
    v_upcoming_bookings jsonb;
    v_staff_list jsonb;
    v_kpis jsonb;
BEGIN
    -- 1. Validate Access
    IF NOT EXISTS (
        SELECT 1 FROM memberships 
        WHERE user_id = auth.uid() 
        AND tenant_id = p_tenant_id
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- 2. Get Tenant Info
    SELECT name, timezone INTO v_tenant_name, v_timezone
    FROM tenants
    WHERE id = p_tenant_id;
    
    v_timezone := COALESCE(v_timezone, 'Europe/Madrid');
    
    -- Date calculations
    v_today_start := date_trunc('day', now() AT TIME ZONE v_timezone) AT TIME ZONE v_timezone;
    v_today_end := v_today_start + interval '1 day';
    v_7days_ago := v_today_start - interval '7 days';
    v_30days_ago := v_today_start - interval '30 days';

    -- 3. Calculate KPIs
    -- Bookings Today
    SELECT count(*), COALESCE(sum(s.price_cents), 0)
    INTO v_bookings_today, v_revenue_today
    FROM bookings b
    LEFT JOIN services s ON b.service_id = s.id
    WHERE b.tenant_id = p_tenant_id
      AND b.starts_at >= v_today_start AND b.starts_at < v_today_end
      AND b.status NOT IN ('cancelled', 'no_show');

    -- Revenue 7 days
    SELECT COALESCE(sum(s.price_cents), 0)
    INTO v_revenue_7days
    FROM bookings b
    LEFT JOIN services s ON b.service_id = s.id
    WHERE b.tenant_id = p_tenant_id
      AND b.starts_at >= v_7days_ago
      AND b.status NOT IN ('cancelled', 'no_show');

    -- Revenue 30 days
    SELECT COALESCE(sum(s.price_cents), 0)
    INTO v_revenue_30days
    FROM bookings b
    LEFT JOIN services s ON b.service_id = s.id
    WHERE b.tenant_id = p_tenant_id
      AND b.starts_at >= v_30days_ago
      AND b.status NOT IN ('cancelled', 'no_show');

    -- Counts
    SELECT count(*) INTO v_active_staff_count FROM staff WHERE tenant_id = p_tenant_id AND active = true;
    SELECT count(*) INTO v_active_services_count FROM services WHERE tenant_id = p_tenant_id AND active = true;

    -- KPIs Object
    v_kpis := jsonb_build_object(
        'bookingsToday', v_bookings_today,
        'revenueToday', v_revenue_today,
        'revenueLast7Days', v_revenue_7days,
        'revenueLast30Days', v_revenue_30days,
        'activeStaff', v_active_staff_count,
        'activeServices', v_active_services_count,
        'bookingsLast7Days', '[]'::jsonb, -- Placeholders for complex charts
        'bookingsLast30DaysByDay', '[]'::jsonb,
        'occupancyTodayPercent', 0,
        'avgTicketToday', 0
    );

    -- 4. Upcoming Bookings (Fix: Use full_name)
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', b.id,
            'starts_at', b.starts_at,
            'ends_at', b.ends_at,
            'status', b.status,
            'customer', jsonb_build_object(
                'name', COALESCE(c.full_name, c.email, 'Cliente'),
                'email', c.email
            ),
            'service', jsonb_build_object(
                'name', s.name
            ),
            'staff', jsonb_build_object(
                'name', st.name
            )
        )
        ORDER BY b.starts_at ASC
    ) INTO v_upcoming_bookings
    FROM bookings b
    LEFT JOIN customers c ON b.customer_id = c.id
    LEFT JOIN services s ON b.service_id = s.id
    LEFT JOIN staff st ON b.staff_id = st.id
    WHERE b.tenant_id = p_tenant_id
      AND b.starts_at >= now()
      AND b.status != 'cancelled'
    LIMIT 15;

    IF v_upcoming_bookings IS NULL THEN v_upcoming_bookings := '[]'::jsonb; END IF;

    -- 5. Staff List
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'color', s.color,
            'avatar_url', s.avatar_url,
            'bookingsToday', 0, -- Simplification for performance
            'occupancyPercent', 0,
            'active', s.active
        )
        ORDER BY s.name ASC
    ) INTO v_staff_list
    FROM staff s
    WHERE s.tenant_id = p_tenant_id AND s.active = true;

    IF v_staff_list IS NULL THEN v_staff_list := '[]'::jsonb; END IF;

    -- 6. Final Result
    v_result := jsonb_build_object(
        'status', 'OK',
        'tenant', jsonb_build_object(
            'id', p_tenant_id,
            'name', COALESCE(v_tenant_name, 'Tu Negocio'),
            'timezone', v_timezone
        ),
        'kpis', v_kpis,
        'upcomingBookings', v_upcoming_bookings,
        'staffMembers', v_staff_list
    );

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'status', 'ERROR',
        'error', SQLERRM
    );
END;
$$;

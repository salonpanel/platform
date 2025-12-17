-- Phase H.6: Dashboard Data Stabilization
-- Goal: Unified RPC for Dashboard data (KPIs, Bookings, Staff) to replace legacy fragmented fetches.

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

    -- 2. Get Tenant Info & Timezone
    SELECT name, timezone INTO v_tenant_name, v_timezone
    FROM tenants
    WHERE id = p_tenant_id;
    
    v_timezone := COALESCE(v_timezone, 'Europe/Madrid');
    
    -- Date calculations (Approximation: using tenant timezone for "today")
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

    -- Revenue checks (Confirmed/Finished only for historical?) 
    -- For simplicity in this contract, we count all non-cancelled for "Projected" revenue, 
    -- or strictly paid/finished. Let's stick to non-cancelled to be optimistic/standard matches agenda.
    
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

    -- Construct KPI Object (Simplified for Contract, Adapter will fill Charts with defaults if needed)
    v_kpis := jsonb_build_object(
        'bookingsToday', v_bookings_today,
        'revenueToday', v_revenue_today,
        'revenueLast7Days', v_revenue_7days,
        'revenueLast30Days', v_revenue_30days,
        'activeStaff', v_active_staff_count,
        'activeServices', v_active_services_count,
        -- Placeholders for advanced charts to satisfy basic contract
        'bookingsLast7Days', '[]'::jsonb,
        'bookingsLast30DaysByDay', '[]'::jsonb,
        'occupancyTodayPercent', 0,
        'avgTicketToday', 0
    );

    -- 4. Upcoming Bookings
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', b.id,
            'starts_at', b.starts_at,
            'ends_at', b.ends_at,
            'status', b.status,
            'customer', jsonb_build_object(
                'name', COALESCE(c.name, 'Cliente'),
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
    -- Legacy used: id, name, color, avatar_url, active, bookingsToday (calculated?), occupancy (calculated?)
    -- We will return basic info. App can join if needed, or we keep it simple.
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'color', s.color,
            'avatar_url', s.avatar_url,
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

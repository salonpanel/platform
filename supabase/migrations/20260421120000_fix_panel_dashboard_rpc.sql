-- Dashboard: access for platform admins (impersonation), correct upcoming booking order/limit,
-- and isActive in staff JSON for the app contract.

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
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Membership OR platform admin (e.g. impersonation without membership row)
    IF NOT EXISTS (
        SELECT 1 FROM memberships
        WHERE user_id = auth.uid()
          AND tenant_id = p_tenant_id
    ) AND NOT COALESCE(public.check_platform_admin(auth.uid()), false) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    SELECT name, timezone INTO v_tenant_name, v_timezone
    FROM tenants
    WHERE id = p_tenant_id;

    v_timezone := COALESCE(v_timezone, 'Europe/Madrid');

    v_today_start := date_trunc('day', now() AT TIME ZONE v_timezone) AT TIME ZONE v_timezone;
    v_today_end := v_today_start + interval '1 day';
    v_7days_ago := v_today_start - interval '7 days';
    v_30days_ago := v_today_start - interval '30 days';

    SELECT count(*), COALESCE(sum(s.price_cents), 0)
    INTO v_bookings_today, v_revenue_today
    FROM bookings b
    LEFT JOIN services s ON b.service_id = s.id
    WHERE b.tenant_id = p_tenant_id
      AND b.starts_at >= v_today_start AND b.starts_at < v_today_end
      AND b.status NOT IN ('cancelled', 'no_show');

    SELECT COALESCE(sum(s.price_cents), 0)
    INTO v_revenue_7days
    FROM bookings b
    LEFT JOIN services s ON b.service_id = s.id
    WHERE b.tenant_id = p_tenant_id
      AND b.starts_at >= v_7days_ago
      AND b.status NOT IN ('cancelled', 'no_show');

    SELECT COALESCE(sum(s.price_cents), 0)
    INTO v_revenue_30days
    FROM bookings b
    LEFT JOIN services s ON b.service_id = s.id
    WHERE b.tenant_id = p_tenant_id
      AND b.starts_at >= v_30days_ago
      AND b.status NOT IN ('cancelled', 'no_show');

    SELECT count(*) INTO v_active_staff_count FROM staff WHERE tenant_id = p_tenant_id AND active = true;
    SELECT count(*) INTO v_active_services_count FROM services WHERE tenant_id = p_tenant_id AND active = true;

    v_kpis := jsonb_build_object(
        'bookingsToday', v_bookings_today,
        'revenueToday', v_revenue_today,
        'revenueLast7Days', v_revenue_7days,
        'revenueLast30Days', v_revenue_30days,
        'activeStaff', v_active_staff_count,
        'activeServices', v_active_services_count,
        'bookingsLast7Days', '[]'::jsonb,
        'bookingsLast30DaysByDay', '[]'::jsonb,
        'occupancyTodayPercent', 0,
        'avgTicketToday', 0
    );

    -- Next 15 upcoming: order + limit inside subquery (not arbitrary 15 rows before aggregate)
    SELECT COALESCE(
        jsonb_agg(row_obj ORDER BY row_starts),
        '[]'::jsonb
    )
    INTO v_upcoming_bookings
    FROM (
        SELECT
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
            ) AS row_obj,
            b.starts_at AS row_starts
        FROM bookings b
        LEFT JOIN customers c ON b.customer_id = c.id
        LEFT JOIN services s ON b.service_id = s.id
        LEFT JOIN staff st ON b.staff_id = st.id
        WHERE b.tenant_id = p_tenant_id
          AND b.starts_at >= now()
          AND b.status != 'cancelled'
        ORDER BY b.starts_at ASC
        LIMIT 15
    ) upcoming;

    SELECT jsonb_agg(
        jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'color', s.color,
            'avatar_url', s.avatar_url,
            'bookingsToday', 0,
            'occupancyPercent', 0,
            'active', s.active,
            'isActive', s.active
        )
        ORDER BY s.name ASC
    ) INTO v_staff_list
    FROM staff s
    WHERE s.tenant_id = p_tenant_id AND s.active = true;

    IF v_staff_list IS NULL THEN v_staff_list := '[]'::jsonb; END IF;

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

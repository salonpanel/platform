-- Performance: reuse get_dashboard_kpis (7d/30d series, tickets, occupancy).
-- Staff: real bookings today + occupancy from staff_schedules for current weekday.

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
    v_dow int;
    v_upcoming_bookings jsonb;
    v_staff_list jsonb;
    v_kpis jsonb;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

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
    -- staff_schedules.day_of_week: 0=lunes .. 6=domingo
    v_dow := (EXTRACT(ISODOW FROM v_today_start)::int - 1);

    v_kpis := (SELECT get_dashboard_kpis(p_tenant_id)::jsonb);

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

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', x.id,
            'name', x.name,
            'color', x.color,
            'avatar_url', x.avatar_url,
            'bookingsToday', x.bookings_today,
            'occupancyPercent', x.occ_pct,
            'active', x.active,
            'isActive', x.active
        ) ORDER BY x.name
    ), '[]'::jsonb)
    INTO v_staff_list
    FROM (
        SELECT
            s.id,
            s.name,
            s.color,
            s.avatar_url,
            s.active,
            COALESCE(bt.cnt, 0)::int AS bookings_today,
            CASE
                WHEN COALESCE(sh.hours, 0) > 0 THEN
                    LEAST(100, ROUND((COALESCE(bt.cnt, 0)::numeric / NULLIF(sh.hours * 2.0, 0)) * 100))::int
                WHEN COALESCE(bt.cnt, 0) > 0 THEN
                    LEAST(100, COALESCE(bt.cnt, 0) * 12)
                ELSE 0
            END AS occ_pct
        FROM staff s
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::int AS cnt
            FROM bookings b
            WHERE b.tenant_id = p_tenant_id
              AND b.staff_id = s.id
              AND b.starts_at >= v_today_start
              AND b.starts_at < v_today_end
              AND b.status NOT IN ('cancelled', 'no_show')
        ) bt ON true
        LEFT JOIN LATERAL (
            SELECT SUM(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 3600.0)::numeric AS hours
            FROM staff_schedules ss
            WHERE ss.staff_id = s.id
              AND ss.is_active = true
              AND ss.day_of_week = v_dow
        ) sh ON true
        WHERE s.tenant_id = p_tenant_id AND s.active = true
    ) x;

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

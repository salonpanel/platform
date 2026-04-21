-- Create missing get_dashboard_kpis RPC used by the dashboard.
-- Includes tenant-scoped auth check (membership OR platform admin).

CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(p_tenant_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_timezone text;
  v_today_start timestamptz;
  v_today_end timestamptz;
  v_seven_days_ago timestamptz;
  v_thirty_days_ago timestamptz;

  v_bookings_today int := 0;
  v_revenue_today bigint := 0;
  v_active_services int := 0;
  v_active_staff int := 0;

  v_total_bookings_7d int := 0;
  v_total_bookings_30d int := 0;
  v_revenue_7d bigint := 0;
  v_revenue_30d bigint := 0;
  v_no_shows_7d int := 0;

  v_bookings_last_7_days int[];
  v_bookings_last_30_days int[];

  v_avg_ticket_today bigint := 0;
  v_avg_ticket_7d bigint := 0;
  v_avg_ticket_30d bigint := 0;

  v_occupancy_today_percent int := 0;
  v_occupancy_7d_percent int := 0;
  v_occupancy_30d_percent int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = p_tenant_id
  ) AND NOT COALESCE(public.check_platform_admin(auth.uid()), false) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COALESCE(timezone, 'Europe/Madrid') INTO v_timezone
  FROM public.tenants
  WHERE id = p_tenant_id;

  v_today_start := date_trunc('day', now() AT TIME ZONE v_timezone) AT TIME ZONE v_timezone;
  v_today_end := v_today_start + interval '1 day';
  v_seven_days_ago := v_today_start - interval '7 days';
  v_thirty_days_ago := v_today_start - interval '30 days';

  -- Bookings today (all except cancelled)
  SELECT COUNT(*)::int
  INTO v_bookings_today
  FROM public.bookings
  WHERE tenant_id = p_tenant_id
    AND starts_at >= v_today_start
    AND starts_at < v_today_end
    AND status <> 'cancelled';

  -- Revenue today (confirmed/completed/paid)
  SELECT COALESCE(SUM(s.price_cents), 0)::bigint
  INTO v_revenue_today
  FROM public.bookings b
  JOIN public.services s ON b.service_id = s.id
  WHERE b.tenant_id = p_tenant_id
    AND b.starts_at >= v_today_start
    AND b.starts_at < v_today_end
    AND b.status IN ('confirmed', 'completed', 'paid');

  SELECT COUNT(*)::int
  INTO v_active_services
  FROM public.services
  WHERE tenant_id = p_tenant_id AND active = true;

  SELECT COUNT(*)::int
  INTO v_active_staff
  FROM public.staff
  WHERE tenant_id = p_tenant_id AND active = true;

  -- Totals 7d/30d
  SELECT COUNT(*)::int
  INTO v_total_bookings_7d
  FROM public.bookings
  WHERE tenant_id = p_tenant_id
    AND starts_at >= v_seven_days_ago
    AND status <> 'cancelled';

  SELECT COUNT(*)::int
  INTO v_total_bookings_30d
  FROM public.bookings
  WHERE tenant_id = p_tenant_id
    AND starts_at >= v_thirty_days_ago
    AND status <> 'cancelled';

  SELECT COALESCE(SUM(s.price_cents), 0)::bigint
  INTO v_revenue_7d
  FROM public.bookings b
  JOIN public.services s ON b.service_id = s.id
  WHERE b.tenant_id = p_tenant_id
    AND b.starts_at >= v_seven_days_ago
    AND b.status IN ('confirmed', 'completed', 'paid');

  SELECT COALESCE(SUM(s.price_cents), 0)::bigint
  INTO v_revenue_30d
  FROM public.bookings b
  JOIN public.services s ON b.service_id = s.id
  WHERE b.tenant_id = p_tenant_id
    AND b.starts_at >= v_thirty_days_ago
    AND b.status IN ('confirmed', 'completed', 'paid');

  SELECT COUNT(*)::int
  INTO v_no_shows_7d
  FROM public.bookings
  WHERE tenant_id = p_tenant_id
    AND starts_at >= v_seven_days_ago
    AND status = 'no_show';

  -- Series 7d
  WITH ds AS (
    SELECT (v_seven_days_ago::date + i)::date AS d
    FROM generate_series(0, 6) AS i
  ),
  b AS (
    SELECT starts_at::date AS d, COUNT(*)::int AS c
    FROM public.bookings
    WHERE tenant_id = p_tenant_id
      AND starts_at >= v_seven_days_ago
      AND status <> 'cancelled'
    GROUP BY 1
  )
  SELECT ARRAY_AGG(COALESCE(b.c, 0) ORDER BY ds.d)
  INTO v_bookings_last_7_days
  FROM ds
  LEFT JOIN b ON b.d = ds.d;

  -- Series 30d
  WITH ds AS (
    SELECT (v_thirty_days_ago::date + i)::date AS d
    FROM generate_series(0, 29) AS i
  ),
  b AS (
    SELECT starts_at::date AS d, COUNT(*)::int AS c
    FROM public.bookings
    WHERE tenant_id = p_tenant_id
      AND starts_at >= v_thirty_days_ago
      AND status <> 'cancelled'
    GROUP BY 1
  )
  SELECT ARRAY_AGG(COALESCE(b.c, 0) ORDER BY ds.d)
  INTO v_bookings_last_30_days
  FROM ds
  LEFT JOIN b ON b.d = ds.d;

  -- Avg tickets
  SELECT CASE WHEN COUNT(*) > 0 THEN (SUM(s.price_cents) / COUNT(*))::bigint ELSE 0 END
  INTO v_avg_ticket_7d
  FROM public.bookings b
  JOIN public.services s ON b.service_id = s.id
  WHERE b.tenant_id = p_tenant_id
    AND b.starts_at >= v_seven_days_ago
    AND b.status IN ('confirmed', 'completed', 'paid');

  SELECT CASE WHEN COUNT(*) > 0 THEN (SUM(s.price_cents) / COUNT(*))::bigint ELSE 0 END
  INTO v_avg_ticket_30d
  FROM public.bookings b
  JOIN public.services s ON b.service_id = s.id
  WHERE b.tenant_id = p_tenant_id
    AND b.starts_at >= v_thirty_days_ago
    AND b.status IN ('confirmed', 'completed', 'paid');

  SELECT CASE WHEN COUNT(*) > 0 THEN (SUM(s.price_cents) / COUNT(*))::bigint ELSE 0 END
  INTO v_avg_ticket_today
  FROM public.bookings b
  JOIN public.services s ON b.service_id = s.id
  WHERE b.tenant_id = p_tenant_id
    AND b.starts_at >= v_today_start
    AND b.starts_at < v_today_end
    AND b.status IN ('confirmed', 'completed', 'paid');

  -- Occupancy today
  WITH today_schedules AS (
    SELECT SUM(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 3600.0) AS total_hours
    FROM public.staff_schedules ss
    JOIN public.staff st ON ss.staff_id = st.id
    WHERE st.tenant_id = p_tenant_id
      AND st.active = true
      AND ss.is_active = true
      AND ss.day_of_week = (EXTRACT(ISODOW FROM v_today_start)::int - 1)
  ),
  today_bookings AS (
    SELECT COUNT(*)::int AS booked_slots
    FROM public.bookings
    WHERE tenant_id = p_tenant_id
      AND starts_at >= v_today_start
      AND starts_at < v_today_end
      AND status IN ('confirmed', 'completed', 'paid')
  )
  SELECT CASE
    WHEN ts.total_hours > 0 THEN LEAST(ROUND((tb.booked_slots::numeric / (ts.total_hours * 2)) * 100), 100)::int
    ELSE 0
  END
  INTO v_occupancy_today_percent
  FROM today_schedules ts, today_bookings tb;

  -- Occupancy 7d avg
  WITH period_schedules AS (
    SELECT SUM(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 3600.0) AS total_hours
    FROM public.staff_schedules ss
    JOIN public.staff st ON ss.staff_id = st.id
    WHERE st.tenant_id = p_tenant_id
      AND st.active = true
      AND ss.is_active = true
  ),
  period_bookings AS (
    SELECT COUNT(*)::int AS booked_slots
    FROM public.bookings
    WHERE tenant_id = p_tenant_id
      AND starts_at >= v_seven_days_ago
      AND status IN ('confirmed', 'completed', 'paid')
  )
  SELECT CASE
    WHEN ps.total_hours > 0 THEN LEAST(ROUND((pb.booked_slots::numeric / (ps.total_hours * 2)) * 100), 100)::int
    ELSE 0
  END
  INTO v_occupancy_7d_percent
  FROM period_schedules ps, period_bookings pb;

  -- Occupancy 30d avg (rough, mirrors baseline approach)
  WITH period_bookings_30d AS (
    SELECT COUNT(*)::int AS booked_slots
    FROM public.bookings
    WHERE tenant_id = p_tenant_id
      AND starts_at >= v_thirty_days_ago
      AND status IN ('confirmed', 'completed', 'paid')
  ),
  avg_daily_capacity AS (
    SELECT SUM(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 3600.0 * 2) AS daily_slots
    FROM public.staff_schedules ss
    JOIN public.staff st ON ss.staff_id = st.id
    WHERE st.tenant_id = p_tenant_id
      AND st.active = true
      AND ss.is_active = true
    GROUP BY ss.day_of_week
    ORDER BY ss.day_of_week
    LIMIT 1
  )
  SELECT CASE
    WHEN adc.daily_slots > 0 THEN LEAST(ROUND((pb.booked_slots::numeric / (adc.daily_slots * 30)) * 100), 100)::int
    ELSE 0
  END
  INTO v_occupancy_30d_percent
  FROM period_bookings_30d pb, avg_daily_capacity adc;

  SELECT json_build_object(
    'bookingsToday', v_bookings_today,
    'revenueToday', v_revenue_today,
    'activeServices', v_active_services,
    'activeStaff', v_active_staff,
    'bookingsLast7Days', COALESCE(v_bookings_last_7_days, ARRAY[]::int[]),
    'totalBookingsLast7Days', v_total_bookings_7d,
    'revenueLast7Days', v_revenue_7d,
    'noShowsLast7Days', v_no_shows_7d,
    'avgTicketLast7Days', v_avg_ticket_7d,
    'bookingsLast30DaysByDay', COALESCE(v_bookings_last_30_days, ARRAY[]::int[]),
    'totalBookingsLast30Days', v_total_bookings_30d,
    'revenueLast30Days', v_revenue_30d,
    'avgTicketToday', v_avg_ticket_today,
    'avgTicketLast30Days', v_avg_ticket_30d,
    'occupancyTodayPercent', COALESCE(v_occupancy_today_percent, 0),
    'occupancyLast7DaysPercent', COALESCE(v_occupancy_7d_percent, 0),
    'occupancyLast30DaysPercent', COALESCE(v_occupancy_30d_percent, 0)
  ) INTO v_result;

  RETURN v_result;
END;
$$;


-- Fix quoted search_path on public.update_daily_metrics and schema-qualify referenced tables/functions.

CREATE OR REPLACE FUNCTION public.update_daily_metrics(p_tenant_id uuid, p_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_timezone text;
BEGIN
  -- Obtener timezone del tenant
  SELECT t.timezone INTO v_timezone
  FROM public.tenants t
  WHERE t.id = p_tenant_id;

  v_timezone := COALESCE(v_timezone, 'Europe/Madrid');

  -- Calcular inicio y fin del día en la zona horaria del tenant
  v_day_start := (p_date::text || ' 00:00:00')::timestamp AT TIME ZONE v_timezone;
  v_day_end := v_day_start + interval '1 day';

  INSERT INTO public.daily_metrics (
    tenant_id,
    metric_date,
    total_bookings,
    confirmed_bookings,
    completed_bookings,
    cancelled_bookings,
    no_show_bookings,
    revenue_cents,
    active_services,
    active_staff,
    new_customers,
    returning_customers,
    available_slots,
    booked_slots,
    occupancy_percent,
    avg_ticket_cents,
    updated_at
  )
  SELECT
    p_tenant_id,
    p_date,
    COUNT(*) FILTER (WHERE b.status != 'cancelled'),
    COUNT(*) FILTER (WHERE b.status IN ('confirmed', 'completed', 'paid')),
    COUNT(*) FILTER (WHERE b.status = 'completed'),
    COUNT(*) FILTER (WHERE b.status = 'cancelled'),
    COUNT(*) FILTER (WHERE b.status = 'no_show'),
    COALESCE(SUM(srv.price_cents) FILTER (WHERE b.status IN ('confirmed', 'completed', 'paid')), 0),
    (SELECT COUNT(*) FROM public.services s WHERE s.tenant_id = p_tenant_id AND s.active = true),
    (SELECT COUNT(*) FROM public.staff st WHERE st.tenant_id = p_tenant_id AND st.active = true),
    COUNT(DISTINCT c.id) FILTER (WHERE c.created_at >= v_day_start AND c.created_at < v_day_end),
    COUNT(DISTINCT c.id) FILTER (WHERE c.created_at < v_day_start),
    (
      SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 1800), 0)::int
      FROM public.staff_schedules ss
      INNER JOIN public.staff st ON ss.staff_id = st.id
      WHERE st.tenant_id = p_tenant_id
        AND st.active = true
        AND ss.is_active = true
        AND ss.day_of_week = EXTRACT(DOW FROM p_date)::int
    ),
    COUNT(*) FILTER (WHERE b.status IN ('confirmed', 'completed', 'paid')),
    CASE
      WHEN (
        SELECT SUM(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 1800)
        FROM public.staff_schedules ss
        INNER JOIN public.staff st ON ss.staff_id = st.id
        WHERE st.tenant_id = p_tenant_id
          AND st.active = true
          AND ss.is_active = true
          AND ss.day_of_week = EXTRACT(DOW FROM p_date)::int
      ) > 0 THEN
        LEAST(
          ROUND(
            (
              COUNT(*) FILTER (WHERE b.status IN ('confirmed', 'completed', 'paid'))::numeric /
              (
                SELECT SUM(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 1800)
                FROM public.staff_schedules ss
                INNER JOIN public.staff st ON ss.staff_id = st.id
                WHERE st.tenant_id = p_tenant_id
                  AND st.active = true
                  AND ss.is_active = true
                  AND ss.day_of_week = EXTRACT(DOW FROM p_date)::int
              )
            ) * 100
          ),
          100
        )::int
      ELSE 0
    END,
    CASE
      WHEN COUNT(*) FILTER (WHERE b.status IN ('confirmed', 'completed', 'paid')) > 0 THEN
        (
          SUM(srv.price_cents) FILTER (WHERE b.status IN ('confirmed', 'completed', 'paid')) /
          COUNT(*) FILTER (WHERE b.status IN ('confirmed', 'completed', 'paid'))
        )::bigint
      ELSE 0
    END,
    now()
  FROM public.bookings b
  LEFT JOIN public.services srv ON b.service_id = srv.id
  LEFT JOIN public.customers c ON b.customer_id = c.id
  WHERE b.tenant_id = p_tenant_id
    AND b.starts_at >= v_day_start
    AND b.starts_at < v_day_end
  ON CONFLICT (tenant_id, metric_date)
  DO UPDATE SET
    total_bookings = EXCLUDED.total_bookings,
    confirmed_bookings = EXCLUDED.confirmed_bookings,
    completed_bookings = EXCLUDED.completed_bookings,
    cancelled_bookings = EXCLUDED.cancelled_bookings,
    no_show_bookings = EXCLUDED.no_show_bookings,
    revenue_cents = EXCLUDED.revenue_cents,
    active_services = EXCLUDED.active_services,
    active_staff = EXCLUDED.active_staff,
    new_customers = EXCLUDED.new_customers,
    returning_customers = EXCLUDED.returning_customers,
    available_slots = EXCLUDED.available_slots,
    booked_slots = EXCLUDED.booked_slots,
    occupancy_percent = EXCLUDED.occupancy_percent,
    avg_ticket_cents = EXCLUDED.avg_ticket_cents,
    updated_at = now();
END;
$$;


-- 0072_fix_org_metrics_trigger_security.sql
-- Añadir SECURITY DEFINER a la función upsert_metrics_for_booking para que los triggers puedan insertar en org_metrics_daily

-- La función necesita SECURITY DEFINER para poder insertar/actualizar en org_metrics_daily
-- sin que las políticas RLS bloqueen la operación cuando se ejecuta desde un trigger
CREATE OR REPLACE FUNCTION public.upsert_metrics_for_booking(p_tenant_id uuid, p_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_confirmed integer;
  v_cancelled integer;
  v_no_show integer;
  v_active_services integer;
  v_active_staff integer;
  v_revenue integer;
BEGIN
  -- Calcular métricas del día desde bookings
  SELECT
    COUNT(*) FILTER (WHERE b.status IN ('pending','paid','completed')) AS total_bookings,
    COUNT(*) FILTER (WHERE b.status IN ('paid','completed')) AS confirmed_bookings,
    COUNT(*) FILTER (WHERE b.status = 'cancelled') AS cancelled_bookings,
    COUNT(*) FILTER (WHERE b.status = 'no_show') AS no_show_bookings,
    COALESCE(SUM(CASE WHEN b.status IN ('paid','completed') THEN s.price_cents ELSE 0 END), 0) AS revenue_cents
  INTO v_total, v_confirmed, v_cancelled, v_no_show, v_revenue
  FROM public.bookings b
  LEFT JOIN public.services s ON s.id = b.service_id
  WHERE b.tenant_id = p_tenant_id
    AND b.starts_at::date = p_date;

  -- Servicios activos del tenant (foto del momento)
  SELECT COUNT(*) INTO v_active_services
  FROM public.services
  WHERE tenant_id = p_tenant_id AND active = true;

  -- Staff activo (foto del momento)
  SELECT COUNT(*) INTO v_active_staff
  FROM public.staff
  WHERE tenant_id = p_tenant_id AND active = true;

  -- Insertar o actualizar métricas usando ON CONFLICT
  INSERT INTO public.org_metrics_daily (
    tenant_id, metric_date, total_bookings, confirmed_bookings, cancelled_bookings, no_show_bookings,
    active_services, active_staff, revenue_cents, updated_at
  )
  VALUES (
    p_tenant_id, p_date, v_total, v_confirmed, v_cancelled, v_no_show,
    v_active_services, v_active_staff, v_revenue, now()
  )
  ON CONFLICT (tenant_id, metric_date)
  DO UPDATE SET
    total_bookings = EXCLUDED.total_bookings,
    confirmed_bookings = EXCLUDED.confirmed_bookings,
    cancelled_bookings = EXCLUDED.cancelled_bookings,
    no_show_bookings = EXCLUDED.no_show_bookings,
    active_services = EXCLUDED.active_services,
    active_staff = EXCLUDED.active_staff,
    revenue_cents = EXCLUDED.revenue_cents,
    updated_at = now();
END;
$$;


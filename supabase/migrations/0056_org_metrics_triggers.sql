-- 0056_org_metrics_triggers.sql
-- Triggers para alimentar org_metrics_daily a partir de bookings

-- Upsert métrica helper
CREATE OR REPLACE FUNCTION public.upsert_metrics_for_booking(p_tenant_id uuid, p_date date)
RETURNS void
LANGUAGE plpgsql
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

  INSERT INTO public.org_metrics_daily (
    tenant_id, metric_date, total_bookings, confirmed_bookings, cancelled_bookings, no_show_bookings,
    active_services, active_staff, revenue_cents, updated_at
  )
  VALUES (
    p_tenant_id, p_date, v_total, v_confirmed, v_cancelled, v_no_show,
    v_active_services, v_active_staff, v_revenue, now()
  )
  ON CONFLICT (id) DO NOTHING; -- fallback si no hay unique; preferimos upsert por (tenant_id, metric_date) si existe

  -- Si existe UNIQUE (tenant_id, metric_date) como añadimos en 0036, usar ON CONFLICT adecuado:
  BEGIN
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
  EXCEPTION WHEN others THEN
    -- Si la constraint aún no existe en algún entorno, la rama anterior asegura que no falle
    NULL;
  END;
END;
$$;

-- Trigger en bookings para recalcular métricas del día afectado
CREATE OR REPLACE FUNCTION public.trg_bookings_update_metrics()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant uuid;
  v_old_date date;
  v_new_date date;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_tenant := NEW.tenant_id;
    v_new_date := NEW.starts_at::date;
    PERFORM public.upsert_metrics_for_booking(v_tenant, v_new_date);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_tenant := COALESCE(NEW.tenant_id, OLD.tenant_id);
    v_old_date := OLD.starts_at::date;
    v_new_date := NEW.starts_at::date;
    PERFORM public.upsert_metrics_for_booking(v_tenant, v_old_date);
    IF v_new_date <> v_old_date THEN
      PERFORM public.upsert_metrics_for_booking(v_tenant, v_new_date);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_tenant := OLD.tenant_id;
    v_old_date := OLD.starts_at::date;
    PERFORM public.upsert_metrics_for_booking(v_tenant, v_old_date);
    RETURN OLD;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_metrics ON public.bookings;
CREATE TRIGGER trg_bookings_metrics
AFTER INSERT OR UPDATE OR DELETE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.trg_bookings_update_metrics();








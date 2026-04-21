-- Fix quoted search_path on trigger_update_daily_metrics() and schema-qualify function calls.

CREATE OR REPLACE FUNCTION public.trigger_update_daily_metrics()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Actualizar métricas para el día de la reserva (NEW)
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.update_daily_metrics(NEW.tenant_id, NEW.starts_at::date);
  END IF;

  -- Si se movió la reserva a otra fecha, actualizar el día anterior también
  IF TG_OP = 'UPDATE' AND OLD.starts_at::date != NEW.starts_at::date THEN
    PERFORM public.update_daily_metrics(OLD.tenant_id, OLD.starts_at::date);
  END IF;

  -- Si se eliminó, actualizar el día de la reserva eliminada
  IF TG_OP = 'DELETE' THEN
    PERFORM public.update_daily_metrics(OLD.tenant_id, OLD.starts_at::date);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


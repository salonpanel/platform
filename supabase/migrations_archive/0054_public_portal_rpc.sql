-- 0054_public_portal_rpc.sql
-- RPCs para portal público (consumibles desde server con service_role)

-- Obtener servicios públicos activos de un tenant
CREATE OR REPLACE FUNCTION public.get_public_services(p_tenant_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  duration_min integer,
  price_cents integer,
  stripe_price_id text
) LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT s.id, s.name, s.duration_min, s.price_cents, s.stripe_price_id
  FROM public.services s
  WHERE s.tenant_id = p_tenant_id
    AND s.active = true
  ORDER BY s.name;
$$;

COMMENT ON FUNCTION public.get_public_services(uuid)
IS 'Lista servicios activos para el tenant (para portal público). SECURITY DEFINER.';

-- Slots disponibles simplificados por día: devuelve bloques operativos del staff que no colisionan con blockings
-- Nota: Esta implementación es simplificada; la lógica de disponibilidad fina puede residir en el app server.
CREATE OR REPLACE FUNCTION public.get_public_daily_staff_windows(
  p_tenant_id uuid,
  p_day date
) RETURNS TABLE (
  staff_id uuid,
  start_time time without time zone,
  end_time time without time zone
) LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT ss.staff_id, ss.start_time, ss.end_time
  FROM public.staff_schedules ss
  WHERE ss.tenant_id = p_tenant_id
    AND ss.is_active = true
    AND ss.day_of_week = EXTRACT(DOW FROM p_day)::int
$$;

COMMENT ON FUNCTION public.get_public_daily_staff_windows(uuid, date)
IS 'Ventanas operativas por staff para un día (sin restar citas). SECURITY DEFINER.';










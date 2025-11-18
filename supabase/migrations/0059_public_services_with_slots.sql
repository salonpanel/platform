-- 0059_public_services_with_slots.sql
-- RPC agregada: servicios activos + slots por servicio y día

CREATE OR REPLACE FUNCTION public.get_public_services_with_slots(
  p_tenant_id uuid,
  p_day date
) RETURNS TABLE (
  service_id uuid,
  service_name text,
  duration_min integer,
  price_cents integer,
  stripe_price_id text,
  slots jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH srv AS (
    SELECT id, name, duration_min, price_cents, stripe_price_id
    FROM public.services
    WHERE tenant_id = p_tenant_id
      AND active = true
    ORDER BY name
  ),
  agg AS (
    SELECT
      s.id AS service_id,
      s.name AS service_name,
      s.duration_min,
      s.price_cents,
      s.stripe_price_id,
      COALESCE(
        (
          SELECT jsonb_agg(jsonb_build_object(
            'staff_id', a.staff_id,
            'slot_start', a.slot_start,
            'slot_end', a.slot_end
          ) ORDER BY a.staff_id, a.slot_start)
          FROM public.get_public_available_slots(p_tenant_id, s.id, p_day) a
        ),
        '[]'::jsonb
      ) AS slots
    FROM srv s
  )
  SELECT service_id, service_name, duration_min, price_cents, stripe_price_id, slots
  FROM agg
  ORDER BY service_name;
END;
$$;

COMMENT ON FUNCTION public.get_public_services_with_slots(uuid, date)
IS 'Devuelve servicios activos con sus slots disponibles por staff para un día. SECURITY DEFINER.';








-- 0058_public_available_slots.sql
-- RPC de disponibilidad pública por servicio y día (grid 15m), excluyendo solapes con bookings y blockings

-- Devuelve slots de inicio posibles por staff para un servicio dado y día concreto.
-- Nota: implementación simplificada, asume grid de 15 minutos y usa horas de staff_schedules;
-- excluye solapes con bookings (status != cancelled/no_show) y staff_blockings.
-- La lógica de timezone puede ajustarse en app server; aquí trabajamos con timestamptz a partir de p_day en UTC.

CREATE OR REPLACE FUNCTION public.get_public_available_slots(
  p_tenant_id uuid,
  p_service_id uuid,
  p_day date
) RETURNS TABLE (
  staff_id uuid,
  slot_start timestamptz,
  slot_end timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_duration_min integer;
BEGIN
  -- Leer duración del servicio
  SELECT duration_min INTO v_duration_min
  FROM public.services
  WHERE id = p_service_id AND tenant_id = p_tenant_id AND active = true;

  IF v_duration_min IS NULL OR v_duration_min <= 0 THEN
    RAISE EXCEPTION 'Servicio inválido o inactivo';
  END IF;

  RETURN QUERY
  WITH sched AS (
    SELECT ss.staff_id, ss.start_time, ss.end_time
    FROM public.staff_schedules ss
    WHERE ss.tenant_id = p_tenant_id
      AND ss.is_active = true
      AND ss.day_of_week = EXTRACT(DOW FROM p_day)::int
  ),
  -- Generar slots cada 15 minutos dentro de la franja operativa del staff
  slots AS (
    SELECT
      s.staff_id,
      -- construir un timestamptz a partir de p_day + start_time
      (make_timestamptz(EXTRACT(year FROM p_day)::int, EXTRACT(month FROM p_day)::int, EXTRACT(day FROM p_day)::int,
                        EXTRACT(hour FROM s.start_time)::int, EXTRACT(minute FROM s.start_time)::int, 0, 'UTC') + (gs.n || ' minutes')::interval) AS slot_start,
      v_duration_min AS duration_min
    FROM sched s
    CROSS JOIN LATERAL generate_series(0,
      GREATEST(0,
        (EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 60)::int - v_duration_min
      ),
      15
    ) AS gs(n)
  ),
  slots_with_end AS (
    SELECT staff_id, slot_start, slot_start + (duration_min || ' minutes')::interval AS slot_end
    FROM slots
  ),
  -- Bookings que bloquean (mismo día, mismo staff)
  busy_bookings AS (
    SELECT b.staff_id, tstzrange(b.starts_at, b.ends_at, '[)') AS r
    FROM public.bookings b
    WHERE b.tenant_id = p_tenant_id
      AND b.staff_id IS NOT NULL
      AND b.starts_at::date = p_day
      AND b.status NOT IN ('cancelled','no_show')
  ),
  -- Bloqueos del staff (mismo día)
  busy_blockings AS (
    SELECT sb.staff_id, tstzrange(sb.start_at, sb.end_at, '[)') AS r
    FROM public.staff_blockings sb
    WHERE sb.tenant_id = p_tenant_id
      AND sb.start_at::date <= p_day
      AND sb.end_at::date >= p_day
  )
  SELECT sw.staff_id, sw.slot_start, sw.slot_end
  FROM slots_with_end sw
  WHERE NOT EXISTS (
    SELECT 1 FROM busy_bookings bb
    WHERE bb.staff_id = sw.staff_id
      AND tstzrange(sw.slot_start, sw.slot_end, '[)') && bb.r
  )
  AND NOT EXISTS (
    SELECT 1 FROM busy_blockings bl
    WHERE bl.staff_id = sw.staff_id
      AND tstzrange(sw.slot_start, sw.slot_end, '[)') && bl.r
  )
  ORDER BY sw.staff_id, sw.slot_start;
END;
$$;

COMMENT ON FUNCTION public.get_public_available_slots(uuid, uuid, date)
IS 'Disponibilidad por staff para un servicio y día (excluye bookings y blockings). SECURITY DEFINER.';








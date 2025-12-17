-- FASE 2: RPC para disponibilidad pública
-- Crea el RPC public.get_available_slots para portal público y IA

CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_tenant_id uuid,
  p_service_id uuid,
  p_date date
)
RETURNS TABLE (
  staff_id uuid,
  start_time timestamptz,
  end_time timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_service_duration int;
  v_service_buffer int;
  v_staff_ids uuid[];
BEGIN
  -- Validar que el tenant existe y está activo
  IF NOT EXISTS (
    SELECT 1 FROM public.tenants
    WHERE id = p_tenant_id AND active = true
  ) THEN
    RETURN;
  END IF;

  -- Obtener duración y buffer del servicio
  SELECT duration_min, buffer_min
  INTO v_service_duration, v_service_buffer
  FROM public.services
  WHERE id = p_service_id
    AND tenant_id = p_tenant_id
    AND active = true;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Obtener staff que proveen este servicio
  SELECT array_agg(staff_id)
  INTO v_staff_ids
  FROM public.staff_provides_services sps
  JOIN public.staff st ON st.id = sps.staff_id
  WHERE sps.service_id = p_service_id
    AND sps.tenant_id = p_tenant_id
    AND st.active = true;

  -- Si no hay staff asignado, usar todos los staff activos del tenant
  IF v_staff_ids IS NULL OR array_length(v_staff_ids, 1) = 0 THEN
    SELECT array_agg(id)
    INTO v_staff_ids
    FROM public.staff
    WHERE tenant_id = p_tenant_id AND active = true;
  END IF;

  -- Calcular slots disponibles
  -- Esta es una implementación simplificada
  -- En producción, delegar a edge function o motor más complejo
  RETURN QUERY
  SELECT
    sch.staff_id,
    sch.start_time,
    sch.end_time
  FROM public.staff_schedules sch
  WHERE sch.tenant_id = p_tenant_id
    AND sch.staff_id = ANY(v_staff_ids)
    AND sch.start_time::date = p_date
    AND sch.is_available = true
    -- Excluir blockings
    AND NOT EXISTS (
      SELECT 1 FROM public.staff_blockings blk
      WHERE blk.tenant_id = p_tenant_id
        AND blk.staff_id = sch.staff_id
        AND blk.start_time <= sch.end_time
        AND blk.end_time >= sch.start_time
    )
  ORDER BY sch.staff_id, sch.start_time;
END;
$$;

-- Política RLS para el RPC (aunque es SECURITY DEFINER, mantener consistencia)
-- Nota: Como es SECURITY DEFINER, RLS no aplica, pero el código valida tenant_id
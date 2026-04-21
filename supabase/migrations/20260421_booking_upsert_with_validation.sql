-- Adds UPDATE support to create_booking_with_validation(p_booking jsonb)
-- so the same RPC can be used for create + edit flows.
--
-- Key fix: when p_booking includes an "id", we exclude it from conflict checks
-- and UPDATE the existing booking instead of INSERTing a new one.

CREATE OR REPLACE FUNCTION public.create_booking_with_validation(p_booking jsonb)
RETURNS TABLE(booking jsonb, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking_id uuid;
  v_tenant_id uuid;
  v_staff_id uuid;
  v_customer_id uuid;
  v_service_id uuid;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_status text;
  v_internal_notes text;
  v_client_message text;
  v_is_highlighted boolean;
BEGIN
  -- Extract fields
  v_booking_id := NULLIF(p_booking->>'id', '')::uuid;
  v_tenant_id := (p_booking->>'tenant_id')::uuid;
  v_staff_id := (p_booking->>'staff_id')::uuid;
  v_customer_id := (p_booking->>'customer_id')::uuid;
  v_service_id := (p_booking->>'service_id')::uuid;
  v_start_at := (p_booking->>'starts_at')::timestamptz;
  v_end_at := (p_booking->>'ends_at')::timestamptz;
  v_status := COALESCE(NULLIF(p_booking->>'status', ''), 'confirmed');
  v_internal_notes := NULLIF(p_booking->>'internal_notes', '');
  v_client_message := NULLIF(p_booking->>'client_message', '');
  v_is_highlighted := COALESCE((p_booking->>'is_highlighted')::boolean, false);

  -- Conflict validation (exclude self when editing)
  IF EXISTS (
    SELECT 1
    FROM public.check_booking_conflicts(
      v_tenant_id,
      v_staff_id,
      v_start_at,
      v_end_at,
      v_booking_id
    )
    WHERE conflict = true
  ) THEN
    RETURN QUERY SELECT NULL::jsonb, 'Conflicto detectado: el horario no está disponible';
    RETURN;
  END IF;

  -- Update path
  IF v_booking_id IS NOT NULL THEN
    RETURN QUERY
    UPDATE public.bookings b
    SET
      staff_id = v_staff_id,
      customer_id = v_customer_id,
      service_id = v_service_id,
      starts_at = v_start_at,
      ends_at = v_end_at,
      status = v_status,
      internal_notes = v_internal_notes,
      client_message = v_client_message,
      is_highlighted = v_is_highlighted,
      updated_at = now()
    WHERE b.id = v_booking_id
      AND b.tenant_id = v_tenant_id
    RETURNING row_to_json(b.*)::jsonb, NULL;

    IF NOT FOUND THEN
      RETURN QUERY SELECT NULL::jsonb, 'No se encontró la cita para actualizar (o no pertenece al tenant)';
    END IF;
    RETURN;
  END IF;

  -- Create path
  RETURN QUERY
  INSERT INTO public.bookings (
    tenant_id,
    staff_id,
    customer_id,
    service_id,
    starts_at,
    ends_at,
    status,
    internal_notes,
    client_message,
    is_highlighted
  ) VALUES (
    v_tenant_id,
    v_staff_id,
    v_customer_id,
    v_service_id,
    v_start_at,
    v_end_at,
    v_status,
    v_internal_notes,
    v_client_message,
    v_is_highlighted
  )
  RETURNING row_to_json(bookings.*)::jsonb, NULL;
END;
$$;


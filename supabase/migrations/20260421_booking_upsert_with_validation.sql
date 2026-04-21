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
  v_booking_state text;
  v_payment_status text;
  v_internal_notes text;
  v_client_message text;
  v_is_highlighted boolean;
  v_deposit_amount_cents integer;
  v_deposit_percent_bp integer;
  v_deposit_currency text;
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
  v_booking_state := COALESCE(NULLIF(p_booking->>'booking_state', ''), NULLIF(p_booking->>'state', ''), NULL);
  v_payment_status := COALESCE(NULLIF(p_booking->>'payment_status', ''), NULLIF(p_booking->>'payment', ''), NULL);
  v_internal_notes := NULLIF(p_booking->>'internal_notes', '');
  v_client_message := NULLIF(p_booking->>'client_message', '');
  v_is_highlighted := COALESCE((p_booking->>'is_highlighted')::boolean, false);
  v_deposit_amount_cents := NULLIF(p_booking->>'deposit_amount_cents', '')::integer;
  v_deposit_percent_bp := NULLIF(p_booking->>'deposit_percent_bp', '')::integer;
  v_deposit_currency := COALESCE(NULLIF(p_booking->>'deposit_currency', ''), 'EUR');

  -- Normalize dual-state model from legacy "status" when not provided
  if v_booking_state is null then
    v_booking_state :=
      case
        when v_status = 'cancelled' then 'cancelled'
        when v_status = 'no_show' then 'no_show'
        when v_status = 'completed' then 'completed'
        when v_status = 'confirmed' then 'confirmed'
        when v_status = 'paid' then 'confirmed'
        when v_status = 'pending' then 'pending'
        when v_status = 'hold' then 'pending'
        else 'pending'
      end;
  end if;

  if v_payment_status is null then
    v_payment_status :=
      case
        when v_status in ('paid', 'completed') then 'paid'
        else 'unpaid'
      end;
  end if;

  -- Keep legacy status loosely in sync (for older UI paths)
  v_status :=
    case
      when v_booking_state in ('cancelled','no_show') then v_booking_state
      when v_booking_state = 'completed' then 'completed'
      when v_payment_status = 'paid' then 'paid'
      when v_booking_state in ('confirmed','in_progress') then 'confirmed'
      when v_payment_status = 'deposit' then 'confirmed'
      else 'pending'
    end;

  -- Deposit normalization: only when payment_status=deposit
  if v_payment_status <> 'deposit' then
    v_deposit_amount_cents := null;
    v_deposit_percent_bp := null;
  else
    -- Ensure mutually exclusive; if both provided prefer amount (frontend shouldn't send both)
    if v_deposit_amount_cents is not null and v_deposit_percent_bp is not null then
      v_deposit_percent_bp := null;
    end if;
  end if;

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
      booking_state = v_booking_state,
      payment_status = v_payment_status,
      deposit_amount_cents = v_deposit_amount_cents,
      deposit_percent_bp = v_deposit_percent_bp,
      deposit_currency = v_deposit_currency,
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
    booking_state,
    payment_status,
    deposit_amount_cents,
    deposit_percent_bp,
    deposit_currency,
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
    v_booking_state,
    v_payment_status,
    v_deposit_amount_cents,
    v_deposit_percent_bp,
    v_deposit_currency,
    v_internal_notes,
    v_client_message,
    v_is_highlighted
  )
  RETURNING row_to_json(bookings.*)::jsonb, NULL;
END;
$$;


-- Migration: Booking Core RPCs
-- Phase: 12.3

-- 1. Get Public Availability (Simplified for Phase 12.3)
-- In a real scenario, this would check against existing bookings and staff shifts.
-- For this phase, we return a fixed set of slots if the service exists.
CREATE OR REPLACE FUNCTION get_public_availability_v1(
  target_tenant_id uuid,
  service_id uuid,
  query_date date
)
RETURNS TABLE (
  slot_time timestamp with time zone,
  available boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_hour int := 9; -- 09:00
  end_hour int := 19; -- 19:00
  slot_duration interval := '30 minutes';
  current_slot timestamp with time zone;
  closing_time timestamp with time zone;
BEGIN
  -- Construct base timestamps (Assuming UTC or Tenant Timezone - simplifying to UTC for MVP)
  current_slot := query_date + make_interval(hours => start_hour);
  closing_time := query_date + make_interval(hours => end_hour);

  -- Loop to generate slots
  WHILE current_slot < closing_time LOOP
    RETURN QUERY SELECT current_slot, true;
    current_slot := current_slot + slot_duration;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_availability_v1(uuid, uuid, date) TO anon;
GRANT EXECUTE ON FUNCTION get_public_availability_v1(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_availability_v1(uuid, uuid, date) TO service_role;


-- 2. Create Public Booking (Guest Mode)
CREATE OR REPLACE FUNCTION create_public_booking_v1(
  target_tenant_id uuid,
  service_id uuid,
  slot_time timestamp with time zone,
  customer_email text,
  customer_name text,
  customer_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_booking_id uuid;
  customer_record_id uuid;
BEGIN
  -- 1. Find or Create Customer (Ephemeral or Real) within Tenant Scope
  -- In this simplified Guest flow, we check strictly by email + tenant_id
  SELECT id INTO customer_record_id
  FROM customers
  WHERE email = customer_email AND tenant_id = target_tenant_id
  LIMIT 1;

  IF customer_record_id IS NULL THEN
    INSERT INTO customers (tenant_id, email, first_name, full_name, phone)
    VALUES (target_tenant_id, customer_email, split_part(customer_name, ' ', 1), customer_name, customer_phone)
    RETURNING id INTO customer_record_id;
  END IF;

  -- 2. Create Booking
  INSERT INTO bookings (
    tenant_id,
    customer_id,
    service_id,
    start_time,
    end_time, -- Calculated trigger or default? Let's assume start_time + service duration (fetched)
              -- For now, just insert start_time, let Trigger handle end_time or NULL
    status,
    notes
  )
  VALUES (
    target_tenant_id,
    customer_record_id,
    service_id,
    slot_time,
    slot_time + interval '30 minutes', -- Fallback duration
    'pending',
    'Created via Public PWA (Guest)'
  )
  RETURNING id INTO new_booking_id;

  RETURN new_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_public_booking_v1(uuid, uuid, timestamptz, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION create_public_booking_v1(uuid, uuid, timestamptz, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_public_booking_v1(uuid, uuid, timestamptz, text, text, text) TO service_role;

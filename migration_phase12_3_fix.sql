-- Migration: Booking Core RPCs (FIXED)
-- Phase: 12.3 FIX
-- Description: Creates booking RPC. Availability is handled by App Layer (Node.js) reusing core engine.

-- 1. Create Public Booking (Guest Mode)
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
  service_duration int;
  calculated_end_time timestamp with time zone;
BEGIN
  -- 0. Get Service Duration for End Time
  SELECT duration_min INTO service_duration 
  FROM services 
  WHERE id = service_id;
  
  IF service_duration IS NULL THEN
     service_duration := 30; -- Fallback
  END IF;

  calculated_end_time := slot_time + (service_duration || ' minutes')::interval;

  -- 1. Find or Create Customer (Ephemeral or Real) within Tenant Scope
  SELECT id INTO customer_record_id
  FROM customers
  WHERE email = customer_email AND tenant_id = target_tenant_id
  LIMIT 1;

  IF customer_record_id IS NULL THEN
    INSERT INTO customers (tenant_id, email, first_name, full_name, phone)
    -- Simple name splitting for first_name
    VALUES (target_tenant_id, customer_email, split_part(customer_name, ' ', 1), customer_name, customer_phone)
    RETURNING id INTO customer_record_id;
  END IF;

  -- 2. Create Booking
  INSERT INTO bookings (
    tenant_id,
    customer_id,
    service_id,
    start_time,
    end_time,
    status,
    notes
  )
  VALUES (
    target_tenant_id,
    customer_record_id,
    service_id,
    slot_time,
    calculated_end_time,
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

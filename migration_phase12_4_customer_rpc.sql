-- Migration: Customer Portal RPCs
-- Phase: 12.4
-- Description: RPCs for "My Bookings" flow, keyed by Email.

-- 1. Helper: Get Current Customer ID by Email
CREATE OR REPLACE FUNCTION get_current_customer_email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT auth.jwt() ->> 'email';
$$;

-- 2. Get My Bookings (Aggregated Data)
CREATE OR REPLACE FUNCTION get_my_bookings_v1(target_tenant_id uuid)
RETURNS TABLE (
  booking_id uuid,
  service_name text,
  start_time timestamp with time zone,
  status text,
  price_cents numeric,
  duration_min int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_email text;
BEGIN
  current_email := get_current_customer_email();
  
  IF current_email IS NULL THEN
     RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    b.id as booking_id,
    s.name as service_name,
    b.start_time,
    b.status,
    s.price_cents::numeric, -- fallback to service price if booking price null
    s.duration_min
  FROM bookings b
  JOIN customers c ON b.customer_id = c.id
  JOIN services s ON b.service_id = s.id
  WHERE b.tenant_id = target_tenant_id
    AND c.email = current_email
    AND c.tenant_id = target_tenant_id -- Redundant but safe
  ORDER BY b.start_time DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_bookings_v1(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_my_bookings_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_bookings_v1(uuid) TO service_role;


-- 3. Cancel My Booking
CREATE OR REPLACE FUNCTION cancel_my_booking_v1(
  target_booking_id uuid,
  target_tenant_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_email text;
  v_booking_customer_email text;
  v_status text;
BEGIN
  current_email := get_current_customer_email();

  IF current_email IS NULL THEN
     RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify ownership
  SELECT c.email, b.status INTO v_booking_customer_email, v_status
  FROM bookings b
  JOIN customers c ON b.customer_id = c.id
  WHERE b.id = target_booking_id
    AND b.tenant_id = target_tenant_id;

  IF v_booking_customer_email IS NULL OR v_booking_customer_email <> current_email THEN
     RAISE EXCEPTION 'Access Denied';
  END IF;

  -- Verify status (can only cancel pending/confirmed)
  IF v_status NOT IN ('pending', 'confirmed') THEN
      RAISE EXCEPTION 'Cannot cancel booking in current status';
  END IF;

  -- Proceed to cancel
  UPDATE bookings
  SET status = 'cancelled',
      updated_at = now()
  WHERE id = target_booking_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_my_booking_v1(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION cancel_my_booking_v1(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_my_booking_v1(uuid, uuid) TO service_role;

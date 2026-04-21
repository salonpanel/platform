-- Fixes an incorrectly quoted search_path on public.check_booking_conflicts
-- and schema-qualifies referenced tables to avoid resolution issues.

CREATE OR REPLACE FUNCTION public.check_booking_conflicts(
  p_tenant_id uuid,
  p_staff_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS TABLE(conflict boolean, conflicts jsonb)
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE WHEN COUNT(*) > 0 THEN TRUE ELSE FALSE END AS conflict,
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'booking_id', b.id,
        'start_at', b.starts_at,
        'end_at', b.ends_at,
        'status', b.status,
        'customer', c.name
      )
    ) AS conflicts
  FROM public.bookings b
  JOIN public.customers c ON b.customer_id = c.id
  WHERE b.staff_id = p_staff_id
    AND b.tenant_id = p_tenant_id
    AND b.status IN ('confirmed', 'completed', 'paid')
    AND (b.starts_at < p_end_at AND b.ends_at > p_start_at)
    AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
  GROUP BY b.staff_id;
END;
$$;


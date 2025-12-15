-- Migration: Create Public Services RPC
-- Phase: 12.2
-- Description: Secure RPC to fetch active services for a public tenant.

CREATE OR REPLACE FUNCTION get_public_services_v1(target_tenant_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  duration_min int,
  price_cents numeric,
  category text,
  description text,
  image_url text
)
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with owner privileges to bypass RLS for public read
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.duration_min,
    s.price_cents::numeric, -- Ensure cast if needed
    s.category,
    s.description,
    s.media_url as image_url
  FROM services s
  WHERE s.tenant_id = target_tenant_id
    AND s.active = true -- Only active services
  ORDER BY s.category ASC, s.name ASC;
END;
$$;

-- Grant execution to anon and authenticated (but mostly anon will use this)
GRANT EXECUTE ON FUNCTION get_public_services_v1(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_public_services_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_services_v1(uuid) TO service_role;

-- Phase H.5.4: Restore Dashboard Upcoming Bookings
-- Goal: Provide a secure, robust RPC for fetching upcoming bookings for the dashboard, avoiding PostgREST embedding ambiguity.

CREATE OR REPLACE FUNCTION panel_fetch_upcoming_bookings_v1(
    p_tenant_id uuid,
    p_limit int DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
BEGIN
    -- 1. Validate Access
    IF NOT EXISTS (
        SELECT 1 FROM memberships 
        WHERE user_id = auth.uid() 
        AND tenant_id = p_tenant_id
    ) THEN
        RETURN '[]'::jsonb; -- Return empty on security failure to avoid errors
    END IF;

    -- 2. Fetch Bookings
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', b.id,
            'starts_at', b.starts_at,
            'ends_at', b.ends_at,
            'status', b.status,
            'customer', jsonb_build_object(
                'name', COALESCE(c.name, 'Cliente'),
                'email', c.email
            ),
            'service', jsonb_build_object(
                'name', s.name
            ),
            'staff', jsonb_build_object(
                'name', st.name
            )
        )
        ORDER BY b.starts_at ASC
    ) INTO v_result
    FROM bookings b
    LEFT JOIN customers c ON b.customer_id = c.id
    LEFT JOIN services s ON b.service_id = s.id
    LEFT JOIN staff st ON b.staff_id = st.id
    WHERE b.tenant_id = p_tenant_id
      AND b.starts_at >= now()
      AND b.status != 'cancelled'
    LIMIT p_limit;

    IF v_result IS NULL THEN
        v_result := '[]'::jsonb;
    END IF;

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    -- Log error if possible? For now, return empty to prevent dashboard crash
    RETURN '[]'::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION panel_fetch_upcoming_bookings_v1(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION panel_fetch_upcoming_bookings_v1(uuid, int) TO service_role;

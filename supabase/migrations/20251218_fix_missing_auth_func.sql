-- Migration: Create missing auth helper function
-- Date: 2025-12-18
-- Author: Antigravity

-- Ensure app schema exists
CREATE SCHEMA IF NOT EXISTS app;

-- Create the helper function to check tenant access
CREATE OR REPLACE FUNCTION app.user_has_access_to_tenant(p_tenant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE user_id = auth.uid()
      AND tenant_id = p_tenant_id
  );
END;
$function$;

-- Grant usage on schema and function
GRANT USAGE ON SCHEMA app TO authenticated;
GRANT EXECUTE ON FUNCTION app.user_has_access_to_tenant(uuid) TO authenticated;

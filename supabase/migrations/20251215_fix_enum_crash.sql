-- Migration: Fix Enum Crash in user_has_role_for_tenant
-- Phase: 13.1.1
-- Problem: The function compares 'app_role' (enum) directly with 'text[]' (array of text).
--          PostgreSQL does not have an implicit equality operator for this, causing crashes.
-- Fix: Explicitly cast 'app_role' column to 'text' before comparison.

CREATE OR REPLACE FUNCTION public.user_has_role_for_tenant(target_tenant uuid, allowed_roles text[])
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  has_role boolean;
begin
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = target_tenant
      -- FIX: Cast m.role to text to allow comparison with text[]
      and (allowed_roles is null or m.role::text = any(allowed_roles))
  )
  into has_role;

  return has_role;
end;
$function$;

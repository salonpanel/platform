-- Tighten customers SELECT policy to authenticated
-- Date: 2026-04-21

ALTER POLICY customers_select_tenant_members
ON public.customers
TO authenticated
USING (public.user_has_role_for_tenant(tenant_id, NULL::text[]));


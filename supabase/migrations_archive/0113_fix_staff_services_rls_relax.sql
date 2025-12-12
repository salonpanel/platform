-- Fix staff_provides_services RLS to allow all tenant members to manage relations
-- This allows staff management without requiring owner/admin role

BEGIN;

-- Update the policy to allow all tenant members (not just owner/admin) to manage staff-service relations
DROP POLICY IF EXISTS "tenant_manage_staff_services" ON public.staff_provides_services;

CREATE POLICY "tenant_manage_staff_services"
ON public.staff_provides_services
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = staff_provides_services.tenant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = staff_provides_services.tenant_id
  )
);

COMMIT;

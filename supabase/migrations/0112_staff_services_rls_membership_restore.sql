-- 0112_staff_services_rls_membership_restore.sql
-- Restores membership-based RLS for core tables and staff_provides_services
-- Avoids relying on JWT tenant_id claims, which may not always be present

begin;

-- ============================================================================
-- 1) STAFF: restore membership-based tenant_read policy (memberships only)
-- ============================================================================

-- Drop JWT-based policies created in later migrations
DROP POLICY IF EXISTS "tenant_read_staff" ON public.staff;
DROP POLICY IF EXISTS "tenant_manage_staff" ON public.staff;

-- Read access: any member of the tenant (or legacy users row)
CREATE POLICY "tenant_read_staff" ON public.staff
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = staff.tenant_id
  )
);

-- NOTE: write/update/delete policies for staff remain governed by
-- role-aware policies defined in previous migrations (e.g. 0025_p1_rls_complete.sql
-- and 0040_rls_refined_policies.sql). We deliberately do not add a broad
-- "tenant_manage_staff" policy here to avoid weakening role-based checks.

-- ============================================================================
-- 2) SERVICES: restore membership-based tenant_read policy (memberships only)
-- ============================================================================

DROP POLICY IF EXISTS "tenant_read_services" ON public.services;
DROP POLICY IF EXISTS "tenant_manage_services" ON public.services;

CREATE POLICY "tenant_read_services" ON public.services
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = services.tenant_id
  )
);

-- Write/update/delete policies for services remain defined in earlier
-- migrations (tenant_write_services / tenant_update_services /
-- tenant_delete_services) and continue to use role-based checks.

-- ============================================================================
-- 3) BOOKINGS: restore membership-based tenant_read policy (memberships only)
-- ============================================================================

DROP POLICY IF EXISTS "tenant_read_bookings" ON public.bookings;
DROP POLICY IF EXISTS "tenant_manage_bookings" ON public.bookings;

CREATE POLICY "tenant_read_bookings" ON public.bookings
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = bookings.tenant_id
  )
);

-- Write/update/delete policies for bookings are still provided by
-- role-aware policies (tenant_write_bookings / tenant_update_bookings /
-- tenant_delete_bookings) created in previous migrations.

-- ============================================================================
-- 4) STAFF_PROVIDES_SERVICES: membership-based RLS
-- ============================================================================

-- Canonical pivot table for Staff ⇄ Services relations.
-- Read: any member of the tenant.
-- Write: only owner/admin of the tenant.

ALTER TABLE public.staff_provides_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_read_staff_services" ON public.staff_provides_services;
DROP POLICY IF EXISTS "tenant_manage_staff_services" ON public.staff_provides_services;

-- Read relations for your own tenant
CREATE POLICY "tenant_read_staff_services"
ON public.staff_provides_services
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = staff_provides_services.tenant_id
  )
);

-- Manage relations only if you are owner/admin of the tenant
CREATE POLICY "tenant_manage_staff_services"
ON public.staff_provides_services
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = staff_provides_services.tenant_id
      AND m.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = staff_provides_services.tenant_id
      AND m.role IN ('owner', 'admin')
  )
);

COMMIT;

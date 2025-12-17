-- Test RLS with tenant assignment
BEGIN;

-- Create test tenant
INSERT INTO public.tenants (id, name, slug, created_at) 
VALUES ('11111111-1111-1111-1111-111111111111', 'Test Tenant', 'test-tenant', NOW());

-- Assign current tenant
SELECT app.set_current_tenant('11111111-1111-1111-1111-111111111111');

-- Verify policies enforce tenant isolation (should return 0 rows - no data yet)
SELECT COUNT(*) as appointments FROM public.appointments;
SELECT COUNT(*) as bookings FROM public.bookings;
SELECT COUNT(*) as customers FROM public.customers;
SELECT COUNT(*) as staff FROM public.staff;

ROLLBACK;

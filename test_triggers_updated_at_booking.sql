-- Test updated_at trigger on bookings (has set_updated_at trigger)
BEGIN;

-- Create tenant first
INSERT INTO public.tenants (id, name, slug) 
VALUES ('11111111-1111-1111-1111-111111111111', 'Test Tenant', 'test-tenant');

-- Create customer
INSERT INTO public.customers (id, tenant_id, name, email) 
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Test Customer', 'test@example.com');

-- Create staff
INSERT INTO public.staff (id, tenant_id, name, display_name, active) 
VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Test Staff', 'Test Staff', true);

-- Create service
INSERT INTO public.services (id, tenant_id, name, duration_min, price_cents) 
VALUES ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Test Service', 60, 5000);

-- Create booking
INSERT INTO public.bookings (
  id, tenant_id, customer_id, staff_id, service_id, 
  starts_at, ends_at, status, created_at, updated_at
) 
VALUES (
  '55555555-5555-5555-5555-555555555555', 
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  NOW() + INTERVAL '1 hour',
  NOW() + INTERVAL '2 hours',
  'pending',
  NOW(),
  NOW()
)
RETURNING id, created_at, updated_at;

-- Wait
SELECT pg_sleep(0.1);

-- Update booking and check updated_at changed
UPDATE public.bookings 
SET internal_notes = 'Updated notes'
WHERE id = '55555555-5555-5555-5555-555555555555'
RETURNING id, status, created_at, updated_at, updated_at > created_at as updated_at_changed;

ROLLBACK;

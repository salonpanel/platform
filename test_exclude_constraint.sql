-- Test coherence validations with EXCLUDE constraints
BEGIN;

-- Create tenant
INSERT INTO public.tenants (id, name, slug) VALUES ('11111111-1111-1111-1111-111111111111', 'Test', 'test');

-- Create staff
INSERT INTO public.staff (id, tenant_id, name, display_name, active) 
VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Staff 1', 'Staff 1', true);

-- Create first appointment
INSERT INTO public.appointments (
  id, tenant_id, staff_id, 
  starts_at, ends_at, status
) VALUES (
  '55555555-5555-5555-5555-555555555555',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  '2025-12-15 10:00:00+00',
  '2025-12-15 11:00:00+00',
  'pending'
);

-- Try to create overlapping appointment (should fail due to EXCLUDE constraint)
INSERT INTO public.appointments (
  id, tenant_id, staff_id, 
  starts_at, ends_at, status
) VALUES (
  '66666666-6666-6666-6666-666666666666',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  '2025-12-15 10:30:00+00',
  '2025-12-15 11:30:00+00',
  'pending'
);

ROLLBACK;

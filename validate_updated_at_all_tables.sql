-- Validación updated_at en appointments
BEGIN;
SELECT id, updated_at FROM public.appointments WHERE id = '55555555-5555-5555-5555-555555555555';
UPDATE public.appointments SET updated_at = updated_at WHERE id = '55555555-5555-5555-5555-555555555555';
SELECT id, updated_at FROM public.appointments WHERE id = '55555555-5555-5555-5555-555555555555';
ROLLBACK;

-- Validación updated_at en customers
BEGIN;
SELECT id, updated_at FROM public.customers WHERE id = '33333333-3333-3333-3333-333333333333';
UPDATE public.customers SET updated_at = updated_at WHERE id = '33333333-3333-3333-3333-333333333333';
SELECT id, updated_at FROM public.customers WHERE id = '33333333-3333-3333-3333-333333333333';
ROLLBACK;

-- Validación updated_at en services
BEGIN;
SELECT id, updated_at FROM public.services WHERE id = '44444444-4444-4444-4444-444444444444';
UPDATE public.services SET updated_at = updated_at WHERE id = '44444444-4444-4444-4444-444444444444';
SELECT id, updated_at FROM public.services WHERE id = '44444444-4444-4444-4444-444444444444';
ROLLBACK;

-- Validación updated_at en staff
BEGIN;
SELECT id, updated_at FROM public.staff WHERE id = '22222222-2222-2222-2222-222222222222';
UPDATE public.staff SET updated_at = updated_at WHERE id = '22222222-2222-2222-2222-222222222222';
SELECT id, updated_at FROM public.staff WHERE id = '22222222-2222-2222-2222-222222222222';
ROLLBACK;

-- Validación updated_at en tenants
BEGIN;
SELECT id, updated_at FROM public.tenants WHERE id = '11111111-1111-1111-1111-111111111111';
UPDATE public.tenants SET updated_at = updated_at WHERE id = '11111111-1111-1111-1111-111111111111';
SELECT id, updated_at FROM public.tenants WHERE id = '11111111-1111-1111-1111-111111111111';
ROLLBACK;

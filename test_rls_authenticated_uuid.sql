-- Test RLS with authenticated user with valid UUID
BEGIN;
SET local role = authenticated;
SET local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT COUNT(*) as appointments FROM public.appointments;
SELECT COUNT(*) as bookings FROM public.bookings;
SELECT COUNT(*) as customers FROM public.customers;
SELECT COUNT(*) as staff FROM public.staff;

ROLLBACK;

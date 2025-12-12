-- Test RLS with authenticated user without tenant
BEGIN;
SET local role = authenticated;
SET local request.jwt.claims = '{"sub":"u1","role":"authenticated"}';

SELECT COUNT(*) as appointments FROM public.appointments;
SELECT COUNT(*) as bookings FROM public.bookings;
SELECT COUNT(*) as customers FROM public.customers;
SELECT COUNT(*) as staff FROM public.staff;

ROLLBACK;

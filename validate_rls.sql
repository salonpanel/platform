-- 2. Validar coherencia multi-tenant (RLS)

-- 2.1 Usuario autenticado con tenant válido (membership existente)
BEGIN;
SET local role = authenticated;
SET local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
SELECT COUNT(*) as customers_with_tenant FROM public.customers;
SELECT COUNT(*) as appointments_with_tenant FROM public.appointments;
SELECT COUNT(*) as bookings_with_tenant FROM public.bookings;
ROLLBACK;

-- 2.2 Usuario autenticado sin tenant (no membership)
BEGIN;
SET local role = authenticated;
SET local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000000","role":"authenticated"}';
SELECT COUNT(*) as customers_without_tenant FROM public.customers;
SELECT COUNT(*) as appointments_without_tenant FROM public.appointments;
SELECT COUNT(*) as bookings_without_tenant FROM public.bookings;
ROLLBACK;

-- 2.3 Usuario autenticado intentando acceder a otro tenant
BEGIN;
SET local role = authenticated;
SET local request.jwt.claims = '{"sub":"cccccccc-0000-0000-0000-000000000000","role":"authenticated"}';
SELECT COUNT(*) as customers_wrong_tenant FROM public.customers;
SELECT COUNT(*) as appointments_wrong_tenant FROM public.appointments;
SELECT COUNT(*) as bookings_wrong_tenant FROM public.bookings;
ROLLBACK;

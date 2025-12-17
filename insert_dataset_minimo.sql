-- Dataset mínimo para validación Fase 2
-- Ejecutar en orden

-- 1. Tenant de prueba
INSERT INTO public.tenants (id, slug, name, timezone)
VALUES ('11111111-1111-1111-1111-111111111111', 'tenant-test', 'Tenant Test', 'Europe/Madrid');

-- 2. Usuario simulado (sin Supabase Auth)
INSERT INTO auth.users (id, email)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test-user@example.com');

-- 3. Membership mínima para activar current_tenant_id()
INSERT INTO public.memberships (id, user_id, tenant_id, role)
VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'admin'
);

-- 4. Staff (sin user_id porque users viene de auth schema)
INSERT INTO public.staff (id, tenant_id, name, display_name, active)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Staff Test',
  'Staff Test',
  true
);

-- 5. Customer
INSERT INTO public.customers (id, tenant_id, name, email)
VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Customer Test', 'customer@test.com');

-- 6. Servicio
INSERT INTO public.services (id, tenant_id, name, duration_min, price_cents)
VALUES ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Service Test', 30, 5000);

-- 7. Appointment para pruebas de EXCLUDE y booking
-- 7. Appointment para pruebas de EXCLUDE y booking
INSERT INTO public.appointments (
  id, tenant_id, customer_id, staff_id, service_id, starts_at, ends_at, status
)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444444',
  '2025-01-01 10:00:00+01',
  '2025-01-01 10:30:00+01',
  'confirmed'
);

-- 8. Booking asociado
INSERT INTO public.bookings(
  id, tenant_id, appointment_id, customer_id, service_id, staff_id, starts_at, ends_at, status
)
VALUES (
  '66666666-6666-6666-6666-666666666666',
  '11111111-1111-1111-1111-111111111111',
  '55555555-5555-5555-5555-555555555555',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '22222222-2222-2222-2222-222222222222',
  '2025-01-01 10:00:00+01',
  '2025-01-01 10:30:00+01',
  'pending'
);

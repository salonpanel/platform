-- 3. Validar EXCLUDE USING GIST en appointments

-- 3.1 Insertar un appointment NO solapado (debe pasar)
BEGIN;
INSERT INTO public.appointments (
  id, tenant_id, customer_id, staff_id, service_id, starts_at, ends_at, status
)
VALUES (
  '77777777-7777-7777-7777-777777777777',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444444',
  '2025-01-01 11:00:00+01',
  '2025-01-01 11:30:00+01',
  'confirmed'
);
SELECT 'INSERT NO solapado: OK' as resultado;
ROLLBACK;

-- 3.2 Intentar insertar appointment solapando (debe FALLAR)
BEGIN;
INSERT INTO public.appointments (
  id, tenant_id, customer_id, staff_id, service_id, starts_at, ends_at, status
)
VALUES (
  '88888888-8888-8888-8888-888888888888',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444444',
  '2025-01-01 10:15:00+01',
  '2025-01-01 10:45:00+01',
  'confirmed'
);
SELECT 'INSERT solapado: ERROR (no debería llegar aquí)' as resultado;
ROLLBACK;

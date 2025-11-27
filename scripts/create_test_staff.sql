-- Crear miembros del staff de prueba
-- Ejecutar con: npx supabase db sql --file scripts/create_test_staff.sql

INSERT INTO public.staff (id, tenant_id, name, display_name, active, provides_services, color, avatar_url, created_at, updated_at)
VALUES
  ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Carlos', 'Carlos Pérez', true, true, '#3B82F6', null, NOW(), NOW()),
  ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'María', 'María García', true, true, '#EF4444', null, NOW(), NOW()),
  ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Juan', 'Juan López', true, true, '#10B981', null, NOW(), NOW()),
  ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Ana', 'Ana Rodríguez', true, true, '#F59E0B', null, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Crear horarios básicos para los miembros del staff (lunes a viernes, 9:00-18:00)
INSERT INTO public.staff_schedules (staff_id, tenant_id, day_of_week, start_time, end_time, created_at, updated_at)
SELECT
  s.id as staff_id,
  s.tenant_id,
  wd.weekday,
  '09:00:00'::time as start_time,
  '18:00:00'::time as end_time,
  now(),
  now()
FROM public.staff s
CROSS JOIN (SELECT unnest(ARRAY[1,2,3,4,5]) as weekday) wd -- Lunes a Viernes
WHERE s.tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND s.active = true
ON CONFLICT (tenant_id, staff_id, day_of_week) DO NOTHING;

-- Verificar que se crearon correctamente
SELECT
  s.display_name,
  s.active,
  s.provides_services,
  count(sc.*) as schedules_count
FROM public.staff s
LEFT JOIN public.staff_schedules sc ON sc.staff_id = s.id
WHERE s.tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
GROUP BY s.id, s.display_name, s.active, s.provides_services
ORDER BY s.display_name;

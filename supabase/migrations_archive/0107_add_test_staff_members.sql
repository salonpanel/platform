-- 0107_add_test_staff_members.sql
-- Añade miembros del staff de prueba para desarrollo

begin;

-- Insertar miembros del staff con todos los campos requeridos
INSERT INTO public.staff (id, tenant_id, name, display_name, active, provides_services, color, avatar_url, created_at, updated_at)
VALUES
  ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Carlos', 'Carlos Pérez', true, true, '#3B82F6', null, NOW(), NOW()),
  ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'María', 'María García', true, true, '#EF4444', null, NOW(), NOW()),
  ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Juan', 'Juan López', true, true, '#10B981', null, NOW(), NOW()),
  ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Ana', 'Ana Rodríguez', true, true, '#F59E0B', null, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF to_regclass('public.schedules') IS NOT NULL THEN
    INSERT INTO public.schedules (staff_id, tenant_id, weekday, start_time, end_time, created_at, updated_at)
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
    ON CONFLICT (staff_id, weekday) DO NOTHING;
  END IF;
END $$;

commit;

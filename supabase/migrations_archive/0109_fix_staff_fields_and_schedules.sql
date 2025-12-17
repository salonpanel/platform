-- 0109_fix_staff_fields_and_schedules.sql
-- Arregla campos faltantes en staff y tabla de horarios correcta

begin;

-- Añadir campos faltantes a staff si no existen
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS color TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
ADD COLUMN IF NOT EXISTS weekly_hours INTEGER DEFAULT 40;

-- Actualizar miembros del staff con valores por defecto
UPDATE public.staff
SET
  color = CASE
    WHEN id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001' THEN '#3B82F6'
    WHEN id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002' THEN '#EF4444'
    WHEN id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003' THEN '#10B981'
    WHEN id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0004' THEN '#F59E0B'
    ELSE '#6B7280'
  END,
  avatar_url = NULL,
  profile_photo_url = NULL,
  weekly_hours = 40
WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Crear tabla staff_schedules correcta si no existe
CREATE TABLE IF NOT EXISTS public.staff_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, staff_id, day_of_week)
);

-- Crear índices si no existen
CREATE INDEX IF NOT EXISTS idx_staff_schedules_tenant_id ON public.staff_schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff_id ON public.staff_schedules(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_day ON public.staff_schedules(day_of_week);

-- Insertar horarios para miembros del staff
INSERT INTO public.staff_schedules (staff_id, tenant_id, day_of_week, start_time, end_time, created_at, updated_at)
SELECT
  s.id as staff_id,
  s.tenant_id,
  wd.day_of_week,
  '09:00:00'::time as start_time,
  '18:00:00'::time as end_time,
  now(),
  now()
FROM public.staff s
CROSS JOIN (SELECT generate_series(1, 5) as day_of_week) wd -- Lunes a Viernes
WHERE s.tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND s.active = true
ON CONFLICT (tenant_id, staff_id, day_of_week) DO NOTHING;

-- Verificar que todo está correcto
SELECT
  s.display_name,
  s.active,
  s.provides_services,
  s.color,
  s.avatar_url,
  count(sc.*) as schedules_count
FROM public.staff s
LEFT JOIN public.staff_schedules sc ON sc.staff_id = s.id
WHERE s.tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
GROUP BY s.id, s.display_name, s.active, s.provides_services, s.color, s.avatar_url
ORDER BY s.display_name;

commit;

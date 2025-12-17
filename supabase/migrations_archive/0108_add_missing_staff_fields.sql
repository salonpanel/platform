-- 0108_add_missing_staff_fields.sql
-- Añade campos faltantes en tabla staff para dashboard y funcionalidad completa

begin;

-- Añadir campos faltantes a la tabla staff
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS color TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Actualizar miembros del staff existentes con valores por defecto
UPDATE public.staff
SET
  color = CASE
    WHEN id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001' THEN '#3B82F6'
    WHEN id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002' THEN '#EF4444'
    WHEN id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003' THEN '#10B981'
    WHEN id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0004' THEN '#F59E0B'
    ELSE '#6B7280'
  END,
  avatar_url = NULL
WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND (color IS NULL OR avatar_url IS NULL);

-- Limpiar tabla schedules incorrecta si existe
DROP TABLE IF EXISTS public.schedules;

-- Asegurar que existe la tabla correcta staff_schedules
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

-- Crear horarios para los miembros del staff si no existen
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

-- Comentarios
COMMENT ON COLUMN public.staff.color IS 'Color asignado al barbero para UI (hex color)';
COMMENT ON COLUMN public.staff.avatar_url IS 'URL de avatar del barbero (opcional)';

commit;

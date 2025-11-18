-- Migration: Add enhanced fields to staff table
-- Adds: profile photo, weekly hours, weekly schedule

-- Agregar columna para foto de perfil (URL)
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- Agregar columna para horas semanales de alta
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS weekly_hours INTEGER DEFAULT 40;

-- Crear tabla para horarios semanales del staff
CREATE TABLE IF NOT EXISTS public.staff_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Domingo, 6 = Sábado
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, staff_id, day_of_week)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_staff_schedules_tenant_id ON public.staff_schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff_id ON public.staff_schedules(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_day ON public.staff_schedules(day_of_week);

-- Habilitar RLS
ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para staff_schedules
-- Los miembros del tenant pueden leer horarios de su organización
CREATE POLICY "Members can view staff schedules"
ON public.staff_schedules
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.memberships
    WHERE memberships.tenant_id = staff_schedules.tenant_id
    AND memberships.user_id = auth.uid()
  )
);

-- Solo admins, owners y managers pueden crear/actualizar/eliminar horarios
CREATE POLICY "Admins can manage staff schedules"
ON public.staff_schedules
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.memberships
    WHERE memberships.tenant_id = staff_schedules.tenant_id
    AND memberships.user_id = auth.uid()
    AND memberships.role IN ('owner', 'admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.memberships
    WHERE memberships.tenant_id = staff_schedules.tenant_id
    AND memberships.user_id = auth.uid()
    AND memberships.role IN ('owner', 'admin', 'manager')
  )
);

-- Comentarios
COMMENT ON COLUMN public.staff.profile_photo_url IS 'URL de la foto de perfil del barbero (visible al público)';
COMMENT ON COLUMN public.staff.weekly_hours IS 'Número de horas semanales de alta del barbero (para configuración con IA de horarios)';
COMMENT ON TABLE public.staff_schedules IS 'Horarios personalizados por día de la semana para cada barbero';
COMMENT ON COLUMN public.staff_schedules.day_of_week IS 'Día de la semana: 0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado';


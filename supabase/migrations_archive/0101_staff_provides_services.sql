-- Migración: Agregar campo provides_services a tabla staff
-- Fecha: 2025-11-26
-- Propósito: Controlar si un staff aparece como reservable en agenda

-- Agregar columna provides_services (por defecto true para compatibilidad con registros existentes)
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS provides_services BOOLEAN NOT NULL DEFAULT true;

-- Comentario para documentación
COMMENT ON COLUMN public.staff.provides_services IS 'Indica si el staff ofrece servicios y debe aparecer en la agenda de reservas. Útil para owners/admins que no realizan servicios directamente.';

-- Índice para filtrar staff que ofrecen servicios (mejora performance en consultas de disponibilidad)
CREATE INDEX IF NOT EXISTS idx_staff_provides_services_active 
ON public.staff (tenant_id, provides_services, active) 
WHERE provides_services = true AND active = true;

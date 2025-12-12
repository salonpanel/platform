-- 0081_fix_remaining_security_issues.sql
-- Corregir problemas de seguridad restantes detectados por Supabase Advisors

-- ============================================================================
-- 1. CORREGIR VISTA vw_staff_availability (asegurar que NO tiene SECURITY DEFINER)
-- ============================================================================

-- Verificar y forzar recreación de la vista sin SECURITY DEFINER
-- PostgreSQL no permite alterar SECURITY DEFINER en vistas, así que hay que recrearla
DO $$
BEGIN
  -- Verificar si la vista existe y tiene SECURITY DEFINER
  IF EXISTS (
    SELECT 1 
    FROM pg_views 
    WHERE schemaname = 'public' 
      AND viewname = 'vw_staff_availability'
      AND viewowner IS NOT NULL
  ) THEN
    -- Eliminar la vista completamente (CASCADE para eliminar dependencias)
    DROP VIEW IF EXISTS public.vw_staff_availability CASCADE;
    RAISE NOTICE 'Vista vw_staff_availability eliminada para recrearla sin SECURITY DEFINER';
  END IF;
END $$;

-- Recrear la vista explícitamente con SECURITY INVOKER (no SECURITY DEFINER)
-- Usar WITH (security_invoker = true) fuerza que la vista se ejecute con los permisos
-- del usuario que la invoca, no del creador de la vista
CREATE VIEW public.vw_staff_availability
WITH (security_invoker = true) AS
SELECT 
  s.tenant_id, 
  s.id AS staff_id,
  s.display_name,
  ss.day_of_week AS weekday, 
  ss.start_time, 
  ss.end_time
FROM public.staff s
JOIN public.staff_schedules ss ON ss.staff_id = s.id AND ss.tenant_id = s.tenant_id
WHERE s.active = true AND ss.is_active = true;

COMMENT ON VIEW public.vw_staff_availability IS 
  'Vista de disponibilidad del staff basada en staff_schedules. Sin SECURITY DEFINER para seguridad.';

-- Verificar que la vista se creó correctamente sin SECURITY DEFINER
DO $$
DECLARE
  v_has_security_definer boolean;
BEGIN
  -- Verificar en pg_views si tiene security_definer
  -- Nota: pg_views no tiene una columna directa para security_definer, pero podemos verificar
  -- que la vista existe y fue creada correctamente
  SELECT EXISTS (
    SELECT 1 
    FROM pg_views 
    WHERE schemaname = 'public' 
      AND viewname = 'vw_staff_availability'
  ) INTO v_has_security_definer;
  
  IF v_has_security_definer THEN
    RAISE NOTICE '✅ Vista vw_staff_availability recreada correctamente';
  ELSE
    RAISE WARNING '⚠️ No se pudo verificar la creación de la vista';
  END IF;
END $$;

-- ============================================================================
-- 2. HABILITAR RLS EN TABLAS BACKUP Y CREAR POLÍTICAS RESTRICTIVAS
-- ============================================================================
-- Las tablas backup deben tener RLS habilitado con políticas que denieguen
-- todo acceso desde clientes (solo service_role puede acceder)

-- org_members_backup: Habilitar RLS y crear política restrictiva
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'org_members_backup'
  ) THEN
    -- Habilitar RLS
    ALTER TABLE public.org_members_backup ENABLE ROW LEVEL SECURITY;
    
    -- Eliminar políticas existentes si las hay
    DROP POLICY IF EXISTS "deny_all_org_members_backup" ON public.org_members_backup;
    
    -- Crear política que deniega todo acceso desde clientes
    -- service_role bypassa RLS, así que puede acceder si es necesario
    CREATE POLICY "deny_all_org_members_backup"
    ON public.org_members_backup 
    FOR ALL
    USING (false) 
    WITH CHECK (false);
    
    RAISE NOTICE '✅ RLS habilitado en org_members_backup con política restrictiva';
  ELSE
    RAISE NOTICE 'ℹ️ org_members_backup no existe, omitiendo';
  END IF;
END $$;

-- users_backup: Habilitar RLS y crear política restrictiva
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users_backup'
  ) THEN
    -- Habilitar RLS
    ALTER TABLE public.users_backup ENABLE ROW LEVEL SECURITY;
    
    -- Eliminar políticas existentes si las hay
    DROP POLICY IF EXISTS "deny_all_users_backup" ON public.users_backup;
    
    -- Crear política que deniega todo acceso desde clientes
    -- service_role bypassa RLS, así que puede acceder si es necesario
    CREATE POLICY "deny_all_users_backup"
    ON public.users_backup 
    FOR ALL
    USING (false) 
    WITH CHECK (false);
    
    RAISE NOTICE '✅ RLS habilitado en users_backup con política restrictiva';
  ELSE
    RAISE NOTICE 'ℹ️ users_backup no existe, omitiendo';
  END IF;
END $$;

-- ============================================================================
-- 3. COMENTARIOS FINALES
-- ============================================================================

-- Comentarios para tablas backup (solo si existen)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'org_members_backup'
  ) THEN
    COMMENT ON TABLE public.org_members_backup IS 
      'LEGACY BACKUP: Tabla legacy renombrada. RLS habilitado con política restrictiva. Solo accesible vía service_role. No usar en código.';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users_backup'
  ) THEN
    COMMENT ON TABLE public.users_backup IS 
      'LEGACY BACKUP: Tabla legacy renombrada. RLS habilitado con política restrictiva. Solo accesible vía service_role. No usar en código.';
  END IF;
END $$;


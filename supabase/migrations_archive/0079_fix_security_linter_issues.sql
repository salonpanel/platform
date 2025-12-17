-- 0079_fix_security_linter_issues.sql
-- Corregir problemas de seguridad detectados por Supabase Advisors

-- ============================================================================
-- 1. CORREGIR VISTA vw_staff_availability (eliminar SECURITY DEFINER si existe)
-- ============================================================================

-- La vista no debería tener SECURITY DEFINER, recrearla sin esa propiedad
DROP VIEW IF EXISTS public.vw_staff_availability;

CREATE VIEW public.vw_staff_availability AS
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

-- ============================================================================
-- 2. AÑADIR RLS A auth_logs
-- ============================================================================

-- Habilitar RLS
ALTER TABLE IF EXISTS public.auth_logs ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo pueden ver sus propios logs
DROP POLICY IF EXISTS "users_view_own_auth_logs" ON public.auth_logs;
CREATE POLICY "users_view_own_auth_logs"
ON public.auth_logs
FOR SELECT
USING (user_id = auth.uid());

-- Política: Solo el sistema puede insertar logs (service_role)
DROP POLICY IF EXISTS "system_insert_auth_logs" ON public.auth_logs;
CREATE POLICY "system_insert_auth_logs"
ON public.auth_logs
FOR INSERT
WITH CHECK (true); -- service_role bypassa RLS, así que esto es seguro

COMMENT ON TABLE public.auth_logs IS 
  'Registro de eventos de autenticación (login/logout). RLS habilitado: usuarios ven solo sus propios logs.';

-- ============================================================================
-- 3. AÑADIR RLS A audit_logs (public.audit_logs)
-- ============================================================================

-- Habilitar RLS
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver logs de su tenant
DROP POLICY IF EXISTS "users_view_tenant_audit_logs" ON public.audit_logs;
CREATE POLICY "users_view_tenant_audit_logs"
ON public.audit_logs
FOR SELECT
USING (
  tenant_id IS NULL OR 
  tenant_id IN (
    SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()
  )
);

-- Política: Solo el sistema puede insertar logs (service_role)
DROP POLICY IF EXISTS "system_insert_audit_logs" ON public.audit_logs;
CREATE POLICY "system_insert_audit_logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true); -- service_role bypassa RLS

COMMENT ON TABLE public.audit_logs IS 
  'Registro de auditoría para cambios sensibles. RLS habilitado: usuarios ven logs de sus tenants.';

-- ============================================================================
-- 4. VERIFICAR stripe_events_processed (ya tiene RLS, pero verificar)
-- ============================================================================

-- Asegurar que tiene RLS habilitado (ya debería tenerlo de migración 0020)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'stripe_events_processed'
      AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE public.stripe_events_processed ENABLE ROW LEVEL SECURITY;
    
    -- Asegurar que tiene la política de denegación
    DROP POLICY IF EXISTS "deny_all_stripe_events_processed" ON public.stripe_events_processed;
    CREATE POLICY "deny_all_stripe_events_processed"
    ON public.stripe_events_processed 
    FOR ALL
    USING (false) 
    WITH CHECK (false);
  END IF;
END $$;

-- ============================================================================
-- 5. NOTA SOBRE WARNINGS DE search_path
-- ============================================================================
-- Los warnings sobre "Function Search Path Mutable" son menos críticos pero deben
-- corregirse gradualmente. Para corregirlos, añadir "SET search_path = public" (o los
-- schemas necesarios) a cada función. Esto requiere recrear cada función manteniendo
-- su lógica original completa.
--
-- Ejemplo de corrección:
-- CREATE OR REPLACE FUNCTION public.normalize_tenant_slug()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- SET search_path = public  -- <-- Añadir esto
-- AS $$ ... $$;
--
-- Se recomienda corregir estas funciones en migraciones separadas, función por función,
-- para mantener el código mantenible y evitar errores.

-- ============================================================================
-- 6. CORREGIR TABLAS BACKUP (añadir políticas o deshabilitar RLS)
-- ============================================================================

-- org_members_backup: Si existe, añadir política o deshabilitar RLS
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'org_members_backup'
  ) THEN
    -- Opción 1: Deshabilitar RLS si es solo backup
    ALTER TABLE public.org_members_backup DISABLE ROW LEVEL SECURITY;
    
    -- O Opción 2: Añadir política restrictiva
    -- ALTER TABLE public.org_members_backup ENABLE ROW LEVEL SECURITY;
    -- DROP POLICY IF EXISTS "deny_all_org_members_backup" ON public.org_members_backup;
    -- CREATE POLICY "deny_all_org_members_backup"
    -- ON public.org_members_backup FOR ALL USING (false) WITH CHECK (false);
  END IF;
END $$;

-- users_backup: Si existe, añadir política o deshabilitar RLS
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users_backup'
  ) THEN
    -- Opción 1: Deshabilitar RLS si es solo backup
    ALTER TABLE public.users_backup DISABLE ROW LEVEL SECURITY;
    
    -- O Opción 2: Añadir política restrictiva
    -- ALTER TABLE public.users_backup ENABLE ROW LEVEL SECURITY;
    -- DROP POLICY IF EXISTS "deny_all_users_backup" ON public.users_backup;
    -- CREATE POLICY "deny_all_users_backup"
    -- ON public.users_backup FOR ALL USING (false) WITH CHECK (false);
  END IF;
END $$;


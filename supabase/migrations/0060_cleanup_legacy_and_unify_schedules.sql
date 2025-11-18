-- 0060_cleanup_legacy_and_unify_schedules.sql
-- Limpieza final: unificar schedules, eliminar referencias a tablas legacy, actualizar funciones

-- ============================================================================
-- 1. UNIFICAR TABLAS DE HORARIOS: schedules -> staff_schedules
-- ============================================================================

-- Migrar datos de schedules a staff_schedules si existen
DO $$
BEGIN
  -- Verificar si existe la tabla schedules y tiene datos
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'schedules'
  ) THEN
    -- Migrar datos: schedules.weekday -> staff_schedules.day_of_week
    -- Solo migrar si no existe ya en staff_schedules (evitar duplicados)
    INSERT INTO public.staff_schedules (
      tenant_id,
      staff_id,
      day_of_week,
      start_time,
      end_time,
      is_active,
      created_at
    )
    SELECT 
      s.tenant_id,
      s.staff_id,
      s.weekday AS day_of_week,
      s.start_time,
      s.end_time,
      true AS is_active, -- Por defecto activo
      s.created_at
    FROM public.schedules s
    WHERE NOT EXISTS (
      SELECT 1 FROM public.staff_schedules ss
      WHERE ss.tenant_id = s.tenant_id
        AND ss.staff_id = s.staff_id
        AND ss.day_of_week = s.weekday
    )
    ON CONFLICT (tenant_id, staff_id, day_of_week) DO NOTHING;

    RAISE NOTICE '✅ Datos migrados de schedules a staff_schedules';
  END IF;
END $$;

-- Eliminar políticas RLS de schedules
DROP POLICY IF EXISTS "tenant_read_schedules" ON public.schedules;
DROP POLICY IF EXISTS "tenant_crud_schedules" ON public.schedules;
DROP POLICY IF EXISTS "public_read_schedules" ON public.schedules;
DROP POLICY IF EXISTS "public_read_schedules_active" ON public.schedules;
DROP POLICY IF EXISTS "tenant_write_schedules" ON public.schedules;
DROP POLICY IF EXISTS "tenant_update_schedules" ON public.schedules;
DROP POLICY IF EXISTS "tenant_delete_schedules" ON public.schedules;

-- Eliminar índices de schedules
DROP INDEX IF EXISTS public.schedules_tenant_id_staff_id_weekday_idx;

-- Eliminar vista que usa schedules (si existe)
DROP VIEW IF EXISTS public.vw_staff_availability;

-- Recrear vista usando staff_schedules
CREATE OR REPLACE VIEW public.vw_staff_availability AS
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
  'Vista de disponibilidad del staff basada en staff_schedules (unificada desde schedules)';

-- Eliminar tabla schedules (ya migrada a staff_schedules)
DROP TABLE IF EXISTS public.schedules CASCADE;

-- ============================================================================
-- 2. ACTUALIZAR FUNCIÓN current_tenant_id: ELIMINAR REFERENCIA A public.users
-- ============================================================================

CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Solo usar memberships (eliminada compatibilidad con public.users)
  SELECT tenant_id INTO v_tenant_id
  FROM public.memberships
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;
  
  RETURN v_tenant_id;
END;
$$;

COMMENT ON FUNCTION app.current_tenant_id IS 
  'Retorna el tenant_id del usuario actual basado únicamente en memberships. Ya no consulta public.users (legacy eliminado).';

-- ============================================================================
-- 3. ELIMINAR REFERENCIAS A public.users EN POLÍTICAS RLS
-- ============================================================================

-- Actualizar política de tenants (eliminar fallback a public.users)
DROP POLICY IF EXISTS "tenant_read_tenants" ON public.tenants;
CREATE POLICY "tenant_read_tenants" ON public.tenants
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = auth.uid()
      AND tenant_id = tenants.id
  )
);

-- Actualizar políticas de customers (eliminar fallback a public.users)
DROP POLICY IF EXISTS "tenant_read_customers" ON public.customers;
CREATE POLICY "tenant_read_customers" ON public.customers
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = auth.uid()
      AND tenant_id = customers.tenant_id
  )
);

-- Actualizar políticas de staff (eliminar fallback a public.users)
DROP POLICY IF EXISTS "tenant_read_staff" ON public.staff;
CREATE POLICY "tenant_read_staff" ON public.staff
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = auth.uid()
      AND tenant_id = staff.tenant_id
  )
);

-- Actualizar políticas de services (eliminar fallback a public.users)
DROP POLICY IF EXISTS "tenant_read_services" ON public.services;
CREATE POLICY "tenant_read_services" ON public.services
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = auth.uid()
      AND tenant_id = services.tenant_id
  )
);

-- Actualizar políticas de bookings (eliminar fallback a public.users)
DROP POLICY IF EXISTS "tenant_read_bookings" ON public.bookings;
CREATE POLICY "tenant_read_bookings" ON public.bookings
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = auth.uid()
      AND tenant_id = bookings.tenant_id
  )
);

-- Actualizar políticas de payment_intents (eliminar fallback a public.users)
-- Solo si la tabla existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payment_intents'
  ) THEN
    DROP POLICY IF EXISTS "tenant_read_payment_intents" ON public.payment_intents;
    CREATE POLICY "tenant_read_payment_intents" ON public.payment_intents
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.memberships
        WHERE user_id = auth.uid()
          AND tenant_id = payment_intents.tenant_id
      )
    );
    RAISE NOTICE '✅ Política de payment_intents actualizada';
  ELSE
    RAISE NOTICE '⚠️ Tabla payment_intents no existe, omitiendo actualización de políticas';
  END IF;
END $$;

-- Actualizar políticas de logs (eliminar fallback a public.users)
-- Solo si la tabla existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'logs'
  ) THEN
    DROP POLICY IF EXISTS "tenant_read_logs" ON public.logs;
    CREATE POLICY "tenant_read_logs" ON public.logs
    FOR SELECT USING (
      tenant_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.memberships
        WHERE user_id = auth.uid()
          AND tenant_id = logs.tenant_id
      )
    );
    RAISE NOTICE '✅ Política de logs actualizada';
  ELSE
    RAISE NOTICE '⚠️ Tabla logs no existe, omitiendo actualización de políticas';
  END IF;
END $$;

-- ============================================================================
-- 4. VERIFICAR Y DOCUMENTAR ESTADO DE TABLAS LEGACY
-- ============================================================================

-- Las tablas legacy (users_backup, org_members_backup) ya fueron renombradas
-- en la migración 0053. No las eliminamos para mantener auditoría, pero
-- están marcadas como LEGACY y no deben usarse.

-- Comentario final
COMMENT ON TABLE public.staff_schedules IS 
  'Tabla unificada de horarios del staff. Reemplaza a public.schedules (eliminada en migración 0060).';

-- ============================================================================
-- 5. VERIFICACIÓN: NO DEBE HABER FKs APUNTANDO A public.users O org_members
-- ============================================================================

DO $$
DECLARE
  v_fk_count integer;
BEGIN
  -- Verificar FKs a public.users (no debería haber ninguna activa)
  -- Usamos constraint_column_usage para obtener la tabla referenciada
  SELECT COUNT(*) INTO v_fk_count
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND ccu.table_schema = 'public'
    AND ccu.table_name = 'users';
  
  IF v_fk_count > 0 THEN
    RAISE WARNING '⚠️ Se encontraron % FKs apuntando a public.users. Revisar manualmente.', v_fk_count;
  ELSE
    RAISE NOTICE '✅ No hay FKs activas apuntando a public.users';
  END IF;
  
  -- Verificar FKs a org_members (no debería haber ninguna activa)
  SELECT COUNT(*) INTO v_fk_count
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND ccu.table_schema = 'public'
    AND ccu.table_name = 'org_members';
  
  IF v_fk_count > 0 THEN
    RAISE WARNING '⚠️ Se encontraron % FKs apuntando a org_members. Revisar manualmente.', v_fk_count;
  ELSE
    RAISE NOTICE '✅ No hay FKs activas apuntando a org_members';
  END IF;
END $$;


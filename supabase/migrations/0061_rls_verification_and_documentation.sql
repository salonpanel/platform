-- 0061_rls_verification_and_documentation.sql
-- Verificación final de RLS y documentación de estado

-- ============================================================================
-- 1. VERIFICAR QUE TODAS LAS TABLAS CRÍTICAS TIENEN RLS ACTIVADO
-- ============================================================================

DO $$
DECLARE
  v_missing_rls text[];
  v_table_name text;
BEGIN
  v_missing_rls := ARRAY[]::text[];
  
  -- Lista de tablas que DEBEN tener RLS
  FOR v_table_name IN 
    SELECT unnest(ARRAY[
      'appointments',
      'bookings',
      'customers',
      'staff',
      'services',
      'staff_blockings',
      'staff_schedules',
      'tenant_settings',
      'chat_messages',
      'memberships',
      'profiles',
      'tenants',
      'org_metrics_daily'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables t
      JOIN pg_class c ON c.relname = t.tablename
      WHERE t.schemaname = 'public'
        AND t.tablename = v_table_name
        AND c.relrowsecurity = true
    ) THEN
      v_missing_rls := array_append(v_missing_rls, v_table_name);
    END IF;
  END LOOP;
  
  IF array_length(v_missing_rls, 1) > 0 THEN
    RAISE WARNING '⚠️ Las siguientes tablas NO tienen RLS activado: %', array_to_string(v_missing_rls, ', ');
  ELSE
    RAISE NOTICE '✅ Todas las tablas críticas tienen RLS activado';
  END IF;
END $$;

-- ============================================================================
-- 2. VERIFICAR POLÍTICAS ESPECÍFICAS
-- ============================================================================

-- Verificar que profiles solo permite UPDATE propio
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_update_self'
      AND cmd = 'UPDATE'
  ) THEN
    RAISE WARNING '⚠️ Falta política profiles_update_self para UPDATE';
  ELSE
    RAISE NOTICE '✅ Política profiles_update_self existe (solo owner puede editar su perfil)';
  END IF;
END $$;

-- Verificar que tenant_settings tiene políticas separadas para UPDATE/DELETE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_settings'
      AND policyname = 'tenant_settings_update_admin_owner'
      AND cmd = 'UPDATE'
  ) THEN
    RAISE WARNING '⚠️ Falta política tenant_settings_update_admin_owner para UPDATE';
  ELSE
    RAISE NOTICE '✅ Política tenant_settings_update_admin_owner existe (solo owner/admin)';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_settings'
      AND policyname = 'tenant_settings_delete_admin_owner'
      AND cmd = 'DELETE'
  ) THEN
    RAISE WARNING '⚠️ Falta política tenant_settings_delete_admin_owner para DELETE';
  ELSE
    RAISE NOTICE '✅ Política tenant_settings_delete_admin_owner existe (solo owner/admin)';
  END IF;
END $$;

-- Verificar que services tiene RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'services'
      AND c.relrowsecurity = true
  ) THEN
    RAISE WARNING '⚠️ services NO tiene RLS activado';
  ELSE
    RAISE NOTICE '✅ services tiene RLS activado';
  END IF;
END $$;

-- Verificar que staff_blockings tiene RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'staff_blockings'
      AND c.relrowsecurity = true
  ) THEN
    RAISE WARNING '⚠️ staff_blockings NO tiene RLS activado';
  ELSE
    RAISE NOTICE '✅ staff_blockings tiene RLS activado';
  END IF;
END $$;

-- ============================================================================
-- 3. DOCUMENTAR stripe_events_processed (SIN RLS - solo interno)
-- ============================================================================

-- stripe_events_processed debe quedarse SIN RLS porque es solo para uso interno
-- (procesamiento de webhooks de Stripe vía service_role)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'stripe_events_processed'
      AND c.relrowsecurity = true
  ) THEN
    RAISE WARNING '⚠️ stripe_events_processed tiene RLS activado, pero debería estar desactivado (solo uso interno)';
  ELSE
    RAISE NOTICE '✅ stripe_events_processed NO tiene RLS (correcto: solo uso interno)';
  END IF;
END $$;

-- ============================================================================
-- 4. DOCUMENTAR TABLAS (usando DO para verificar existencia)
-- ============================================================================

-- Documentar stripe_events_processed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stripe_events_processed'
  ) THEN
    COMMENT ON TABLE public.stripe_events_processed IS 
      'Tabla interna para tracking de eventos de Stripe procesados. NO debe tener RLS (solo accesible vía service_role).';
  END IF;
END $$;

-- Documentar tablas con RLS completo
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'services'
  ) THEN
    COMMENT ON TABLE public.services IS 
      'RLS activado: SELECT para miembros del tenant, INSERT/UPDATE/DELETE solo owner/admin.';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'staff_blockings'
  ) THEN
    COMMENT ON TABLE public.staff_blockings IS 
      'RLS activado: SELECT para miembros del tenant, INSERT/UPDATE para owner/admin/staff, DELETE solo owner/admin.';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    COMMENT ON TABLE public.profiles IS 
      'RLS activado: SELECT/UPDATE solo el propio usuario (user_id = auth.uid()).';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenant_settings'
  ) THEN
    COMMENT ON TABLE public.tenant_settings IS 
      'RLS activado: SELECT para miembros del tenant, INSERT/UPDATE/DELETE solo owner/admin.';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'auth_logs'
  ) THEN
    COMMENT ON TABLE public.auth_logs IS 
      'Tabla de logs de autenticación. RLS pendiente para futuras fases (no crítico ahora).';
  END IF;
END $$;


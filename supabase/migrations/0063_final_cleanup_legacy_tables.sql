-- 0063_final_cleanup_legacy_tables.sql
-- Eliminación final de tablas legacy backup (solo si no hay FKs activas)
-- PRECAUCIÓN: Esta migración elimina permanentemente las tablas backup.
-- Asegúrate de haber migrado todos los datos necesarios antes de ejecutar.

-- ============================================================================
-- 1. VERIFICAR QUE NO HAY FKs ACTIVAS APUNTANDO A TABLAS LEGACY
-- ============================================================================

DO $$
DECLARE
  v_fk_count integer;
  v_warning_count integer := 0;
BEGIN
  -- Verificar FKs a users_backup
  SELECT COUNT(*) INTO v_fk_count
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND ccu.table_schema = 'public'
    AND ccu.table_name = 'users_backup';
  
  IF v_fk_count > 0 THEN
    RAISE WARNING '⚠️ Se encontraron % FKs apuntando a users_backup. NO se eliminará la tabla.', v_fk_count;
    v_warning_count := v_warning_count + 1;
  END IF;
  
  -- Verificar FKs a org_members_backup
  SELECT COUNT(*) INTO v_fk_count
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND ccu.table_schema = 'public'
    AND ccu.table_name = 'org_members_backup';
  
  IF v_fk_count > 0 THEN
    RAISE WARNING '⚠️ Se encontraron % FKs apuntando a org_members_backup. NO se eliminará la tabla.', v_fk_count;
    v_warning_count := v_warning_count + 1;
  END IF;
  
  IF v_warning_count = 0 THEN
    RAISE NOTICE '✅ No hay FKs activas apuntando a tablas backup. Procediendo con eliminación.';
  END IF;
END $$;

-- ============================================================================
-- 2. ELIMINAR TABLAS BACKUP (solo si no hay FKs)
-- ============================================================================

-- Eliminar users_backup (solo si existe y no hay FKs)
DO $$
DECLARE
  v_has_fks boolean := false;
BEGIN
  -- Verificar si hay FKs
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_schema = 'public'
      AND ccu.table_name = 'users_backup'
  ) INTO v_has_fks;
  
  IF NOT v_has_fks AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users_backup'
  ) THEN
    DROP TABLE IF EXISTS public.users_backup CASCADE;
    RAISE NOTICE '✅ Tabla users_backup eliminada';
  ELSIF v_has_fks THEN
    RAISE WARNING '⚠️ users_backup tiene FKs activas. NO eliminada. Revisar manualmente.';
  ELSE
    RAISE NOTICE 'ℹ️ users_backup no existe o ya fue eliminada';
  END IF;
END $$;

-- Eliminar org_members_backup (solo si existe y no hay FKs)
DO $$
DECLARE
  v_has_fks boolean := false;
BEGIN
  -- Verificar si hay FKs
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_schema = 'public'
      AND ccu.table_name = 'org_members_backup'
  ) INTO v_has_fks;
  
  IF NOT v_has_fks AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'org_members_backup'
  ) THEN
    DROP TABLE IF EXISTS public.org_members_backup CASCADE;
    RAISE NOTICE '✅ Tabla org_members_backup eliminada';
  ELSIF v_has_fks THEN
    RAISE WARNING '⚠️ org_members_backup tiene FKs activas. NO eliminada. Revisar manualmente.';
  ELSE
    RAISE NOTICE 'ℹ️ org_members_backup no existe o ya fue eliminada';
  END IF;
END $$;

-- ============================================================================
-- 3. VERIFICACIÓN FINAL
-- ============================================================================

DO $$
DECLARE
  v_remaining_tables text[] := ARRAY[]::text[];
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users_backup'
  ) THEN
    v_remaining_tables := array_append(v_remaining_tables, 'users_backup');
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'org_members_backup'
  ) THEN
    v_remaining_tables := array_append(v_remaining_tables, 'org_members_backup');
  END IF;
  
  IF array_length(v_remaining_tables, 1) > 0 THEN
    RAISE WARNING '⚠️ Las siguientes tablas backup aún existen: %', array_to_string(v_remaining_tables, ', ');
    RAISE NOTICE '💡 Revisa manualmente si hay FKs o datos que necesites antes de eliminarlas.';
  ELSE
    RAISE NOTICE '✅ Todas las tablas legacy backup han sido eliminadas correctamente.';
  END IF;
END $$;

COMMENT ON SCHEMA public IS 
  'Esquema público principal. Tablas legacy (users_backup, org_members_backup) eliminadas en migración 0063. Usar auth.users + public.profiles + public.memberships.';




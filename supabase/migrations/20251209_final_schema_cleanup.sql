-- 20251209_final_schema_cleanup.sql
-- Garantiza limpieza final de staff_only_ids, función legacy y políticas públicas peligrosas

-- 1. Eliminar columna staff_only_ids de public.services si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'services'
      AND column_name = 'staff_only_ids'
  ) THEN
    ALTER TABLE public.services DROP COLUMN staff_only_ids;
  END IF;
END $$;

-- 2. Eliminar función public.sync_staff_only_ids_from_relations() si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'sync_staff_only_ids_from_relations'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    DROP FUNCTION public.sync_staff_only_ids_from_relations();
  END IF;
END $$;

-- 3. Eliminar política peligrosa public_read_staff_active en public.staff si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'staff'
      AND policyname = 'public_read_staff_active'
  ) THEN
    DROP POLICY IF EXISTS public_read_staff_active ON public.staff;
  END IF;
END $$;

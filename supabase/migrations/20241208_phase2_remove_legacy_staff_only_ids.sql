-- FASE 2: Eliminar campo legacy staff_only_ids
-- Elimina completamente el campo legacy services.staff_only_ids

-- Drop the legacy column
ALTER TABLE public.services DROP COLUMN IF EXISTS staff_only_ids;

DROP FUNCTION IF EXISTS public.sync_staff_only_ids_from_relations();

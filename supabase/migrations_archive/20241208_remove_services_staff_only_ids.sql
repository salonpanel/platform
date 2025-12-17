-- Micro-fase 2.1: eliminar campo legacy staff_only_ids en public.services

-- Eliminar índice GIN si existe
DROP INDEX IF EXISTS idx_services_staff_only_ids;

-- Eliminar función legacy de sincronización
DROP FUNCTION IF EXISTS public.sync_staff_only_ids_from_relations;

-- Eliminar triggers relacionados (si existieran)
DROP TRIGGER IF EXISTS trg_sync_staff_only_ids ON public.services;

-- Eliminar el campo legacy
ALTER TABLE public.services
  DROP COLUMN IF EXISTS staff_only_ids;

-- Eliminar comentarios de columna
COMMENT ON COLUMN public.services.staff_only_ids IS NULL;

-- 0047_tenants_slug_normalization.sql
-- Normalizar slug a minúsculas y asegurar unicidad case-insensitive

-- Índice único case-insensitive en slug
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'tenants_slug_lower_uniq'
  ) THEN
    CREATE UNIQUE INDEX tenants_slug_lower_uniq
      ON public.tenants (lower(slug));
  END IF;
END$$;

-- Trigger para normalizar slug a minúsculas y limpiar espacios
CREATE OR REPLACE FUNCTION public.normalize_tenant_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NOT NULL THEN
    NEW.slug := lower(regexp_replace(NEW.slug, '\s+', '-', 'g'));
    NEW.slug := regexp_replace(NEW.slug, '[^a-z0-9-]', '', 'g');
    NEW.slug := regexp_replace(NEW.slug, '-{2,}', '-', 'g');
    NEW.slug := regexp_replace(NEW.slug, '(^-+)|(-+$)', '', 'g');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_tenant_slug ON public.tenants;
CREATE TRIGGER trg_normalize_tenant_slug
BEFORE INSERT OR UPDATE OF slug ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.normalize_tenant_slug();










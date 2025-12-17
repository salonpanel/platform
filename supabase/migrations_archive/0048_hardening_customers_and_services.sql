-- 0048_hardening_customers_and_services.sql
-- Checks e índices en customers/services

-- customers: índice único opcional por email dentro de tenant (case-insensitive, ignora NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'customers_tenant_email_lower_uniq'
  ) THEN
    CREATE UNIQUE INDEX customers_tenant_email_lower_uniq
      ON public.customers (tenant_id, lower(email))
      WHERE email IS NOT NULL AND email <> '';
  END IF;
END$$;

-- customers: índice por teléfono (no único) para búsquedas
CREATE INDEX IF NOT EXISTS customers_tenant_phone_idx
  ON public.customers (tenant_id, phone);

-- customers: CHECKs básicos de formato (no estrictos para evitar falsos positivos)
DO $$
BEGIN
  -- Email simple
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='public' AND t.relname='customers' AND c.conname='customers_email_format_ck'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_email_format_ck
      CHECK (email IS NULL OR email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$');
  END IF;

  -- Teléfono básico (permite +, dígitos, espacios, guiones)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='public' AND t.relname='customers' AND c.conname='customers_phone_format_ck'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_phone_format_ck
      CHECK (phone IS NULL OR phone ~ '^[+0-9 ()-]{6,}$');
  END IF;
END$$;

-- services: asegurar coherencia extra (ya existe price_cents >= 0, duration_min > 0)
-- Añadir índice por tenant y activo para listados
CREATE INDEX IF NOT EXISTS services_tenant_active_idx
  ON public.services (tenant_id, active);










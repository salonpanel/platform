-- 0036_schema_fixes_core.sql
-- Correcciones críticas de esquema y mínimos índices/uniques
-- Seguro para re-ejecución parcial gracias a IF EXISTS/IF NOT EXISTS

-- 1) appointments.slot: convertir a columna generada a partir de starts_at/ends_at
DO $$
BEGIN
  -- Si la columna existe y NO es generada, la reemplazamos
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'appointments'
      AND column_name = 'slot'
  ) THEN
    -- Intentar detectar si ya es generada; si no podemos, forzamos reemplazo
    -- En PG, no se puede convertir una columna existente a "generated stored" directamente.
    -- Estrategia: dropear y recrear.
    EXECUTE 'ALTER TABLE public.appointments DROP COLUMN IF EXISTS slot';
  END IF;
EXCEPTION WHEN others THEN
  -- En caso de bloqueo por dependencias, mejor fallar explícito
  RAISE;
END$$;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS slot tstzrange GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)')) STORED;


-- 2) Unificar estados noshow -> no_show en appointments
-- Quitar CHECK existente (si lo hay) para poder actualizar datos
DO $$
DECLARE
  chk_name text;
BEGIN
  SELECT conname INTO chk_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'appointments'
    AND c.contype = 'c'
    AND conname ILIKE '%status%';

  IF chk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.appointments DROP CONSTRAINT %I', chk_name);
  END IF;
END$$;

-- Update de datos a la nueva nomenclatura
UPDATE public.appointments
SET status = 'no_show'
WHERE status = 'noshow';

-- Nuevo CHECK coherente
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status = ANY (ARRAY['hold','confirmed','cancelled','no_show']));


-- 3) Arreglar skills en staff a text[]
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'staff'
      AND column_name = 'skills'
  ) THEN
    -- Intentar castear cualquier tipo previo a text[]
    BEGIN
      ALTER TABLE public.staff
        ALTER COLUMN skills TYPE text[]
        USING
          CASE
            WHEN skills IS NULL THEN NULL
            WHEN pg_typeof(skills)::text = 'text[]' THEN skills::text[]
            ELSE (ARRAY[skills::text])::text[] -- fallback si era scalar/otro
          END;
    EXCEPTION WHEN others THEN
      -- Si falla el cast, al menos garantizamos que la columna tenga el tipo correcto creando una nueva temporal
      ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS skills_tmp text[];
      UPDATE public.staff SET skills_tmp = NULL WHERE skills_tmp IS NULL;
      ALTER TABLE public.staff DROP COLUMN skills;
      ALTER TABLE public.staff RENAME COLUMN skills_tmp TO skills;
    END;
  ELSE
    -- Si no existía, la creamos
    ALTER TABLE public.staff ADD COLUMN skills text[];
  END IF;
END$$;


-- 4) UNIQUEs funcionales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'org_metrics_daily'
      AND c.conname = 'org_metrics_daily_tenant_date_uniq'
  ) THEN
    ALTER TABLE public.org_metrics_daily
      ADD CONSTRAINT org_metrics_daily_tenant_date_uniq
      UNIQUE (tenant_id, metric_date);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'memberships'
      AND c.conname = 'memberships_tenant_user_uniq'
  ) THEN
    ALTER TABLE public.memberships
      ADD CONSTRAINT memberships_tenant_user_uniq
      UNIQUE (tenant_id, user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'staff_schedules'
      AND c.conname = 'staff_schedules_unique_slot'
  ) THEN
    ALTER TABLE public.staff_schedules
      ADD CONSTRAINT staff_schedules_unique_slot
      UNIQUE (tenant_id, staff_id, day_of_week, start_time, end_time);
  END IF;
END$$;


-- 5) Índices básicos de rendimiento
CREATE INDEX IF NOT EXISTS bookings_tenant_starts_idx
  ON public.bookings (tenant_id, starts_at);

CREATE INDEX IF NOT EXISTS appointments_tenant_starts_idx
  ON public.appointments (tenant_id, starts_at);

CREATE INDEX IF NOT EXISTS customers_tenant_name_email_idx
  ON public.customers (tenant_id, lower(name), lower(email));

CREATE INDEX IF NOT EXISTS staff_tenant_active_idx
  ON public.staff (tenant_id, active);

CREATE INDEX IF NOT EXISTS org_metrics_daily_tenant_date_idx
  ON public.org_metrics_daily (tenant_id, metric_date DESC);


-- Notas de futuro (no se ejecutan):
-- - Valorar eliminación/legacy de public.org_members y public.users en favor de public.memberships + auth.users + public.profiles
-- - Añadir EXCLUDE USING gist para evitar solapes en agenda cuando cerremos tabla canónica (appointments o bookings)
-- - Alinear FKs de staff.user_id -> auth.users(id) si procede (rompe compatibilidad con public.users)



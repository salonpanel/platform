-- 0037_agenda_exclusion_and_fk_fix.sql
-- Anti-solapes en agenda y saneo de FK staff.user_id -> auth.users(id)

-- 1) Asegurar extensión necesaria para EXCLUDE (uuid/int equality en GiST)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2) Constraint de exclusión en appointments para evitar solapes de citas confirmadas
-- Evita que el mismo staff en el mismo tenant tenga rangos de tiempo solapados cuando status es 'confirmed'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'appointments'
      AND c.conname = 'appointments_no_overlap'
  ) THEN
    EXECUTE $SQL$
      ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_no_overlap
      EXCLUDE USING gist (
        tenant_id WITH =,
        staff_id  WITH =,
        slot      WITH &&
      )
      WHERE (status IN ('confirmed'));
    $SQL$;
  END IF;
END$$;

-- 3) Cambiar FK de staff.user_id para apuntar a auth.users(id)
-- Hacemos NOT VALID primero para no romper entornos con datos intermedios, y luego VALIDATE
DO $$
DECLARE
  fk_name text := 'staff_user_id_fkey';
  ref_table text;
BEGIN
  -- Detectar a qué tabla referencia actualmente el FK (si existe)
  SELECT ccu.table_name INTO ref_table
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name = 'staff'
    AND tc.constraint_name = fk_name
    LIMIT 1;

  IF ref_table IS NOT NULL THEN
    -- Eliminamos el FK actual (probablemente a public.users)
    EXECUTE format('ALTER TABLE public.staff DROP CONSTRAINT %I', fk_name);
  END IF;

  -- Creamos nuevo FK hacia auth.users(id) de forma segura
  -- NOT VALID para permitir datos legacy, y luego intentar VALIDATE
  BEGIN
    ALTER TABLE public.staff
      ADD CONSTRAINT staff_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) NOT VALID;
  EXCEPTION WHEN duplicate_object THEN
    -- Ya existía con ese objetivo
    NULL;
  END;

  -- Intentar validar (en entornos con datos inconsistentes, esto puede fallar y se podrá validar más tarde)
  BEGIN
    ALTER TABLE public.staff VALIDATE CONSTRAINT staff_user_id_fkey;
  EXCEPTION WHEN others THEN
    -- Dejar constreñimiento en NOT VALID; se puede hacer backfill y validar después
    NULL;
  END;
END$$;

-- 4) Marcar tablas legacy con comentarios
COMMENT ON TABLE public.org_members IS 'LEGACY: preferir public.memberships (user_id -> auth.users) para pertenencia y roles multi-tenant.';
COMMENT ON TABLE public.users IS 'LEGACY: evitar su uso. Emplear auth.users + public.profiles + public.memberships.';










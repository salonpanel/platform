-- 0052_lockdown_legacy_tables.sql
-- Lockdown de tablas legacy: public.org_members y public.users
-- Objetivo: evitar su uso accidental desde clientes autenticados (RLS deny-all)

-- Marcar comentarios de LEGACY (por si faltaba)
DO $$
BEGIN
  IF to_regclass('public.org_members') IS NOT NULL THEN
    COMMENT ON TABLE public.org_members IS 'LEGACY: usar public.memberships (user_id -> auth.users) para pertenencia multi-tenant. Bloqueado por RLS.';
  END IF;
END $$;
COMMENT ON TABLE public.users IS 'LEGACY: evitar uso. Emplear auth.users + public.profiles + public.memberships. Bloqueado por RLS.';

-- Activar RLS
DO $$
BEGIN
  IF to_regclass('public.org_members') IS NOT NULL THEN
    ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes (si las hubiera) para dejar deny-all
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT policyname, schemaname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('org_members','users')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rec.policyname, rec.schemaname, rec.tablename);
  END LOOP;
END$$;

-- Nota: Con RLS activo y sin políticas, cualquier acceso via anon/authenticated queda denegado.
-- El service_role puede operar si fuera estrictamente necesario para migraciones internas.










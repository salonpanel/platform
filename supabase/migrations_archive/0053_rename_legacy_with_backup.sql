-- 0053_rename_legacy_with_backup.sql
-- Renombrar tablas legacy a *_backup de forma segura (sin DROP)
-- Evita roturas y deja un rastro claro para auditoría/migraciones futuras.

DO $$
BEGIN
  -- org_members -> org_members_backup
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='org_members'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='org_members_backup'
  ) THEN
    ALTER TABLE public.org_members RENAME TO org_members_backup;
    COMMENT ON TABLE public.org_members_backup IS 'LEGACY BACKUP: sustitución por public.memberships. No usar en código.';
  END IF;

  -- users -> users_backup
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='users'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='users_backup'
  ) THEN
    ALTER TABLE public.users RENAME TO users_backup;
    COMMENT ON TABLE public.users_backup IS 'LEGACY BACKUP: evitar uso. Emplear auth.users + public.profiles + public.memberships.';
  END IF;
END$$;










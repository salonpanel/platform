-- 0043_rls_tenants_memberships_profiles.sql
-- RLS para tenants, memberships y profiles

-- Activar RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas para tenants
DO $$
BEGIN
  -- SELECT: usuarios con membership en ese tenant
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tenants' AND policyname='tenants_select_members'
  ) THEN
    CREATE POLICY tenants_select_members
      ON public.tenants
      FOR SELECT
      USING (public.user_has_role_for_tenant(id, NULL));
  END IF;

  -- UPDATE: solo owner/admin
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tenants' AND policyname='tenants_update_admin_owner'
  ) THEN
    CREATE POLICY tenants_update_admin_owner
      ON public.tenants
      FOR UPDATE
      TO authenticated
      USING (public.user_has_role_for_tenant(id, ARRAY['owner','admin']))
      WITH CHECK (public.user_has_role_for_tenant(id, ARRAY['owner','admin']));
  END IF;
END$$;

-- Políticas para memberships
DO $$
BEGIN
  -- SELECT: propios memberships
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='memberships' AND policyname='memberships_select_self'
  ) THEN
    CREATE POLICY memberships_select_self
      ON public.memberships
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;

  -- SELECT: gestión por owner/admin del tenant
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='memberships' AND policyname='memberships_select_admin_owner'
  ) THEN
    CREATE POLICY memberships_select_admin_owner
      ON public.memberships
      FOR SELECT
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']));
  END IF;

  -- INSERT: solo owner/admin del tenant destino
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='memberships' AND policyname='memberships_insert_admin_owner'
  ) THEN
    CREATE POLICY memberships_insert_admin_owner
      ON public.memberships
      FOR INSERT
      TO authenticated
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']));
  END IF;

  -- UPDATE: solo owner/admin del tenant
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='memberships' AND policyname='memberships_update_admin_owner'
  ) THEN
    CREATE POLICY memberships_update_admin_owner
      ON public.memberships
      FOR UPDATE
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']))
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']));
  END IF;

  -- DELETE: solo owner/admin del tenant
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='memberships' AND policyname='memberships_delete_admin_owner'
  ) THEN
    CREATE POLICY memberships_delete_admin_owner
      ON public.memberships
      FOR DELETE
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']));
  END IF;
END$$;

-- Políticas para profiles (self-only)
DO $$
BEGIN
  -- SELECT: self
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select_self'
  ) THEN
    CREATE POLICY profiles_select_self
      ON public.profiles
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;

  -- UPDATE: self
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update_self'
  ) THEN
    CREATE POLICY profiles_update_self
      ON public.profiles
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END$$;










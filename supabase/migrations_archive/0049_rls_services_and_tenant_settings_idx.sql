-- 0049_rls_services_and_tenant_settings_idx.sql
-- RLS para services y mejora de índice en tenant_settings

-- Activar RLS en services
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Políticas para services (similares a customers)
DO $$
BEGIN
  -- SELECT: cualquier miembro del tenant
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='services' AND policyname='services_select_members'
  ) THEN
    CREATE POLICY services_select_members
      ON public.services
      FOR SELECT
      USING (public.user_has_role_for_tenant(tenant_id, NULL));
  END IF;

  -- INSERT: owner/admin
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='services' AND policyname='services_insert_admin_owner'
  ) THEN
    CREATE POLICY services_insert_admin_owner
      ON public.services
      FOR INSERT
      TO authenticated
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']));
  END IF;

  -- UPDATE: owner/admin
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='services' AND policyname='services_update_admin_owner'
  ) THEN
    CREATE POLICY services_update_admin_owner
      ON public.services
      FOR UPDATE
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']))
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']));
  END IF;

  -- DELETE: owner/admin
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='services' AND policyname='services_delete_admin_owner'
  ) THEN
    CREATE POLICY services_delete_admin_owner
      ON public.services
      FOR DELETE
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']));
  END IF;
END$$;

-- Índice para tenant_settings lecturas frecuentes
CREATE INDEX IF NOT EXISTS tenant_settings_tenant_idx
  ON public.tenant_settings (tenant_id);










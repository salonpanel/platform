-- 0039_rls_starter_pack.sql
-- Activación RLS y políticas base por tenant usando memberships (user_id -> auth.users)

-- Helper: función para comprobar rol de usuario en un tenant dado
-- Nota: SECURITY DEFINER no es necesario para simples checks con auth.uid()
CREATE OR REPLACE FUNCTION public.user_has_role_for_tenant(target_tenant uuid, allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = target_tenant
      AND (allowed_roles IS NULL OR m.role = ANY(allowed_roles))
  );
$$;

-- 1) Activar RLS en tablas clave (idempotente)
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_metrics_daily ENABLE ROW LEVEL SECURITY;

-- 2) Políticas por tabla

-- appointments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='appointments' AND policyname='appointments_select_tenant_members'
  ) THEN
    CREATE POLICY appointments_select_tenant_members
      ON public.appointments
      FOR SELECT
      USING (public.user_has_role_for_tenant(tenant_id, NULL));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='appointments' AND policyname='appointments_write_staff_admin_owner'
  ) THEN
    CREATE POLICY appointments_write_staff_admin_owner
      ON public.appointments
      FOR ALL
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin','staff']))
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin','staff']));
  END IF;
END$$;

-- bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='bookings' AND policyname='bookings_select_tenant_members'
  ) THEN
    CREATE POLICY bookings_select_tenant_members
      ON public.bookings
      FOR SELECT
      USING (public.user_has_role_for_tenant(tenant_id, NULL));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='bookings' AND policyname='bookings_write_staff_admin_owner'
  ) THEN
    CREATE POLICY bookings_write_staff_admin_owner
      ON public.bookings
      FOR ALL
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin','staff']))
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin','staff']));
  END IF;
END$$;

-- customers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='customers' AND policyname='customers_select_tenant_members'
  ) THEN
    CREATE POLICY customers_select_tenant_members
      ON public.customers
      FOR SELECT
      USING (public.user_has_role_for_tenant(tenant_id, NULL));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='customers' AND policyname='customers_write_staff_admin_owner'
  ) THEN
    CREATE POLICY customers_write_staff_admin_owner
      ON public.customers
      FOR ALL
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin','staff']))
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin','staff']));
  END IF;
END$$;

-- staff
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='staff' AND policyname='staff_select_tenant_members'
  ) THEN
    CREATE POLICY staff_select_tenant_members
      ON public.staff
      FOR SELECT
      USING (public.user_has_role_for_tenant(tenant_id, NULL));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='staff' AND policyname='staff_write_admin_owner'
  ) THEN
    CREATE POLICY staff_write_admin_owner
      ON public.staff
      FOR ALL
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']))
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']));
  END IF;
END$$;

-- tenant_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tenant_settings' AND policyname='tenant_settings_select_tenant_members'
  ) THEN
    CREATE POLICY tenant_settings_select_tenant_members
      ON public.tenant_settings
      FOR SELECT
      USING (public.user_has_role_for_tenant(tenant_id, NULL));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tenant_settings' AND policyname='tenant_settings_write_admin_owner'
  ) THEN
    CREATE POLICY tenant_settings_write_admin_owner
      ON public.tenant_settings
      FOR ALL
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']))
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']));
  END IF;
END$$;

-- chat_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='chat_messages' AND policyname='chat_messages_select_tenant_members'
  ) THEN
    CREATE POLICY chat_messages_select_tenant_members
      ON public.chat_messages
      FOR SELECT
      USING (public.user_has_role_for_tenant(tenant_id, NULL));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='chat_messages' AND policyname='chat_messages_write_staff_admin_owner'
  ) THEN
    CREATE POLICY chat_messages_write_staff_admin_owner
      ON public.chat_messages
      FOR ALL
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin','staff']))
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin','staff']));
  END IF;
END$$;

-- org_metrics_daily (solo lectura para miembros; escrituras típicamente vía cron/funciones)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='org_metrics_daily' AND policyname='org_metrics_daily_select_tenant_members'
  ) THEN
    CREATE POLICY org_metrics_daily_select_tenant_members
      ON public.org_metrics_daily
      FOR SELECT
      USING (public.user_has_role_for_tenant(tenant_id, NULL));
  END IF;
END$$;








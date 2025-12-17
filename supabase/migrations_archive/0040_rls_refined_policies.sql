-- 0040_rls_refined_policies.sql
-- Refinar RLS: separar SELECT/INSERT/UPDATE/DELETE y restringir DELETE a owner/admin

-- Helper: función ya creada en 0039
-- public.user_has_role_for_tenant(target_tenant uuid, allowed_roles text[])

-- Utilidad: eliminar política si existe
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT policyname, schemaname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('appointments','bookings','customers','staff','tenant_settings','chat_messages')
      AND policyname IN (
        'appointments_write_staff_admin_owner',
        'bookings_write_staff_admin_owner',
        'customers_write_staff_admin_owner',
        'chat_messages_write_staff_admin_owner',
        'staff_write_admin_owner',
        'tenant_settings_write_admin_owner'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rec.policyname, rec.schemaname, rec.tablename);
  END LOOP;
END$$;

-- appointments
DO $$
BEGIN
  -- SELECT (mantener si no existe)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='appointments' AND policyname='appointments_select_tenant_members'
  ) THEN
    CREATE POLICY appointments_select_tenant_members
      ON public.appointments
      FOR SELECT
      USING (public.user_has_role_for_tenant(tenant_id, NULL));
  END IF;

  -- INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='appointments' AND policyname='appointments_insert_staff_admin_owner'
  ) THEN
    CREATE POLICY appointments_insert_staff_admin_owner
      ON public.appointments
      FOR INSERT
      TO authenticated
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin','staff']));
  END IF;

  -- UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='appointments' AND policyname='appointments_update_staff_admin_owner'
  ) THEN
    CREATE POLICY appointments_update_staff_admin_owner
      ON public.appointments
      FOR UPDATE
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin','staff']))
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin','staff']));
  END IF;

  -- DELETE (solo owner/admin)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='appointments' AND policyname='appointments_delete_admin_owner'
  ) THEN
    CREATE POLICY appointments_delete_admin_owner
      ON public.appointments
      FOR DELETE
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']));
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
    WHERE schemaname='public' AND tablename='bookings' AND policyname='bookings_insert_staff_admin_owner'
  ) THEN
    CREATE POLICY bookings_insert_staff_admin_owner
      ON public.bookings
      FOR INSERT
      TO authenticated
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin','staff']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='bookings' AND policyname='bookings_update_staff_admin_owner'
  ) THEN
    CREATE POLICY bookings_update_staff_admin_owner
      ON public.bookings
      FOR UPDATE
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin','staff']))
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin','staff']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='bookings' AND policyname='bookings_delete_admin_owner'
  ) THEN
    CREATE POLICY bookings_delete_admin_owner
      ON public.bookings
      FOR DELETE
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']));
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
    WHERE schemaname='public' AND tablename='customers' AND policyname='customers_insert_staff_admin_owner'
  ) THEN
    CREATE POLICY customers_insert_staff_admin_owner
      ON public.customers
      FOR INSERT
      TO authenticated
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin','staff']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='customers' AND policyname='customers_update_staff_admin_owner'
  ) THEN
    CREATE POLICY customers_update_staff_admin_owner
      ON public.customers
      FOR UPDATE
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin','staff']))
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin','staff']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='customers' AND policyname='customers_delete_admin_owner'
  ) THEN
    CREATE POLICY customers_delete_admin_owner
      ON public.customers
      FOR DELETE
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']));
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
    WHERE schemaname='public' AND tablename='chat_messages' AND policyname='chat_messages_insert_staff_admin_owner'
  ) THEN
    CREATE POLICY chat_messages_insert_staff_admin_owner
      ON public.chat_messages
      FOR INSERT
      TO authenticated
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin','staff']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='chat_messages' AND policyname='chat_messages_update_staff_admin_owner'
  ) THEN
    CREATE POLICY chat_messages_update_staff_admin_owner
      ON public.chat_messages
      FOR UPDATE
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin','staff']))
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin','staff']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='chat_messages' AND policyname='chat_messages_delete_admin_owner'
  ) THEN
    CREATE POLICY chat_messages_delete_admin_owner
      ON public.chat_messages
      FOR DELETE
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']));
  END IF;
END$$;

-- staff (ya estaba restringido a admin/owner para escritura; lo separamos por acción)
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
    WHERE schemaname='public' AND tablename='staff' AND policyname='staff_insert_admin_owner'
  ) THEN
    CREATE POLICY staff_insert_admin_owner
      ON public.staff
      FOR INSERT
      TO authenticated
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='staff' AND policyname='staff_update_admin_owner'
  ) THEN
    CREATE POLICY staff_update_admin_owner
      ON public.staff
      FOR UPDATE
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']))
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='staff' AND policyname='staff_delete_admin_owner'
  ) THEN
    CREATE POLICY staff_delete_admin_owner
      ON public.staff
      FOR DELETE
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']));
  END IF;
END$$;

-- tenant_settings (solo admin/owner para escribir)
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
    WHERE schemaname='public' AND tablename='tenant_settings' AND policyname='tenant_settings_insert_admin_owner'
  ) THEN
    CREATE POLICY tenant_settings_insert_admin_owner
      ON public.tenant_settings
      FOR INSERT
      TO authenticated
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tenant_settings' AND policyname='tenant_settings_update_admin_owner'
  ) THEN
    CREATE POLICY tenant_settings_update_admin_owner
      ON public.tenant_settings
      FOR UPDATE
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']))
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tenant_settings' AND policyname='tenant_settings_delete_admin_owner'
  ) THEN
    CREATE POLICY tenant_settings_delete_admin_owner
      ON public.tenant_settings
      FOR DELETE
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']));
  END IF;
END$$;










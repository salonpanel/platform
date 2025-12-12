-- 0042_rls_staff_blockings_and_schedules.sql
-- RLS y rendimiento para staff_blockings y staff_schedules

-- Activar RLS
ALTER TABLE public.staff_blockings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;

-- Políticas para staff_blockings
DO $$
BEGIN
  -- SELECT: cualquier miembro del tenant
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='staff_blockings' AND policyname='staff_blockings_select_members'
  ) THEN
    CREATE POLICY staff_blockings_select_members
      ON public.staff_blockings
      FOR SELECT
      USING (public.user_has_role_for_tenant(tenant_id, NULL));
  END IF;

  -- INSERT: owner, admin, staff
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='staff_blockings' AND policyname='staff_blockings_insert_staff_admin_owner'
  ) THEN
    CREATE POLICY staff_blockings_insert_staff_admin_owner
      ON public.staff_blockings
      FOR INSERT
      TO authenticated
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin','staff']));
  END IF;

  -- UPDATE: owner, admin, staff
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='staff_blockings' AND policyname='staff_blockings_update_staff_admin_owner'
  ) THEN
    CREATE POLICY staff_blockings_update_staff_admin_owner
      ON public.staff_blockings
      FOR UPDATE
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin','staff']))
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin','staff']));
  END IF;

  -- DELETE: solo owner, admin
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='staff_blockings' AND policyname='staff_blockings_delete_admin_owner'
  ) THEN
    CREATE POLICY staff_blockings_delete_admin_owner
      ON public.staff_blockings
      FOR DELETE
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']));
  END IF;
END$$;

-- Políticas para staff_schedules
DO $$
BEGIN
  -- SELECT: cualquier miembro del tenant
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='staff_schedules' AND policyname='staff_schedules_select_members'
  ) THEN
    CREATE POLICY staff_schedules_select_members
      ON public.staff_schedules
      FOR SELECT
      USING (public.user_has_role_for_tenant(tenant_id, NULL));
  END IF;

  -- INSERT: owner, admin
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='staff_schedules' AND policyname='staff_schedules_insert_admin_owner'
  ) THEN
    CREATE POLICY staff_schedules_insert_admin_owner
      ON public.staff_schedules
      FOR INSERT
      TO authenticated
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']));
  END IF;

  -- UPDATE: owner, admin
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='staff_schedules' AND policyname='staff_schedules_update_admin_owner'
  ) THEN
    CREATE POLICY staff_schedules_update_admin_owner
      ON public.staff_schedules
      FOR UPDATE
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']))
      WITH CHECK (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']));
  END IF;

  -- DELETE: owner, admin
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='staff_schedules' AND policyname='staff_schedules_delete_admin_owner'
  ) THEN
    CREATE POLICY staff_schedules_delete_admin_owner
      ON public.staff_schedules
      FOR DELETE
      TO authenticated
      USING (public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin']));
  END IF;
END$$;

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS staff_blockings_tenant_staff_time_idx
  ON public.staff_blockings (tenant_id, staff_id, start_at, end_at);

CREATE INDEX IF NOT EXISTS staff_schedules_tenant_staff_day_time_idx
  ON public.staff_schedules (tenant_id, staff_id, day_of_week, start_time, end_time);










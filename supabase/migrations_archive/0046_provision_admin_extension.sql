-- 0046_provision_admin_extension.sql
-- Extiende provision_tenant_for_user para permitir a platform-admin provisionar para otro user_id

-- Requiere función RPC existente: check_platform_admin(p_user_id uuid) RETURNS boolean

CREATE OR REPLACE FUNCTION public.provision_tenant_for_user(
  p_user_id uuid,
  p_name text,
  p_slug text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id uuid;
  v_now timestamptz := now();
  v_caller uuid := auth.uid();
  v_is_admin boolean := false;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Solo usuarios autenticados pueden provisionar tenants' USING ERRCODE = '42501';
  END IF;

  -- Permitir si el caller es el propio usuario o si es platform admin
  BEGIN
    SELECT coalesce(check_platform_admin(v_caller), false) INTO v_is_admin;
  EXCEPTION WHEN undefined_function THEN
    -- Si no existe la función, asumir no admin
    v_is_admin := false;
  END;

  IF v_caller <> p_user_id AND NOT v_is_admin THEN
    RAISE EXCEPTION 'No autorizado: se requiere ser platform-admin para provisionar a otro usuario' USING ERRCODE = '42501';
  END IF;

  -- Normalizar slug a minúsculas (el trigger también lo hará si existe)
  p_slug := lower(p_slug);

  INSERT INTO public.tenants (name, slug, created_at)
  VALUES (p_name, p_slug, v_now)
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.tenant_settings (tenant_id) VALUES (v_tenant_id);

  INSERT INTO public.memberships (tenant_id, user_id, role, created_at)
  VALUES (v_tenant_id, p_user_id, 'owner', v_now)
  ON CONFLICT DO NOTHING;

  BEGIN
    INSERT INTO public.org_metrics_daily (tenant_id, metric_date, created_at, updated_at)
    VALUES (v_tenant_id, current_date, v_now, v_now);
  EXCEPTION WHEN others THEN
    NULL;
  END;

  RETURN v_tenant_id;
END;
$$;

COMMENT ON FUNCTION public.provision_tenant_for_user(uuid, text, text)
IS 'Provisiona un tenant; permite a platform-admin crear para terceros, o al propio usuario para sí mismo.';










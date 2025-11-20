-- 0044_provision_tenant_function.sql
-- Función para provisionar un tenant para un usuario

-- Asegurar search_path seguro dentro de la función
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
BEGIN
  -- Solo usuarios autenticados
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Solo usuarios autenticados pueden provisionar tenants' USING ERRCODE = '42501';
  END IF;

  -- Por defecto, exigir que el usuario autenticado sea el mismo que p_user_id
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'No autorizado: el usuario autenticado no coincide con p_user_id' USING ERRCODE = '42501';
  END IF;

  -- Crear tenant
  INSERT INTO public.tenants (name, slug, created_at)
  VALUES (p_name, p_slug, v_now)
  RETURNING id INTO v_tenant_id;

  -- Crear tenant_settings con defaults
  INSERT INTO public.tenant_settings (tenant_id)
  VALUES (v_tenant_id);

  -- Crear membership como owner
  INSERT INTO public.memberships (tenant_id, user_id, role, created_at)
  VALUES (v_tenant_id, p_user_id, 'owner', v_now)
  ON CONFLICT DO NOTHING;

  -- Opcional: sembrar métrica del día
  BEGIN
    INSERT INTO public.org_metrics_daily (tenant_id, metric_date, created_at, updated_at)
    VALUES (v_tenant_id, current_date, v_now, v_now);
  EXCEPTION WHEN others THEN
    -- No crítico; continuar
    NULL;
  END;

  RETURN v_tenant_id;
END;
$$;

COMMENT ON FUNCTION public.provision_tenant_for_user(uuid, text, text)
IS 'Provisiona un tenant para un usuario: crea tenant, tenant_settings y membership (owner).';










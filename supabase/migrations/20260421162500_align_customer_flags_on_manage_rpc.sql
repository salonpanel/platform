-- Align customer flags (is_vip, is_banned, marketing_opt_in) with UI segment
-- customers table in this project does NOT have a `segment` column.
-- Date: 2026-04-21

CREATE OR REPLACE FUNCTION public.manage_create_customer(
  p_tenant_id uuid,
  p_full_name text,
  p_email text DEFAULT NULL::text,
  p_phone text DEFAULT NULL::text,
  p_segment text DEFAULT 'normal'::text,
  p_notes text DEFAULT NULL::text,
  p_internal_notes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id uuid;
  v_existing_id uuid;
  v_segment text;
  v_is_vip boolean;
  v_is_banned boolean;
  v_marketing_opt_in boolean;
BEGIN
  -- Enforce tenant access (staff+ can create)
  IF NOT public.user_has_role_for_tenant(p_tenant_id, ARRAY['owner','admin','staff']) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acceso denegado');
  END IF;

  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'El nombre es obligatorio');
  END IF;

  v_segment := COALESCE(NULLIF(trim(p_segment), ''), 'normal');
  IF v_segment NOT IN ('normal','vip','banned','marketing','no_contact') THEN
    v_segment := 'normal';
  END IF;

  v_is_vip := (v_segment = 'vip');
  v_is_banned := (v_segment = 'banned');
  v_marketing_opt_in := (v_segment = 'marketing');

  IF p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    SELECT id INTO v_existing_id
    FROM public.customers
    WHERE tenant_id = p_tenant_id
      AND lower(email) = lower(trim(p_email))
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Ya existe un cliente con este email',
        'is_duplicate', true,
        'customer_id', v_existing_id
      );
    END IF;
  END IF;

  INSERT INTO public.customers (
    tenant_id,
    full_name,
    first_name,
    email,
    phone,
    is_vip,
    is_banned,
    marketing_opt_in,
    notes,
    internal_notes,
    created_at,
    updated_at
  ) VALUES (
    p_tenant_id,
    trim(p_full_name),
    split_part(trim(p_full_name), ' ', 1),
    CASE WHEN p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN lower(trim(p_email)) ELSE NULL END,
    CASE WHEN p_phone IS NOT NULL AND length(trim(p_phone)) > 0 THEN trim(p_phone) ELSE NULL END,
    v_is_vip,
    v_is_banned,
    v_marketing_opt_in,
    p_notes,
    p_internal_notes,
    now(),
    now()
  )
  RETURNING id INTO v_customer_id;

  RETURN jsonb_build_object('success', true, 'customer_id', v_customer_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.manage_update_customer(
  p_customer_id uuid,
  p_tenant_id uuid,
  p_full_name text,
  p_email text DEFAULT NULL::text,
  p_phone text DEFAULT NULL::text,
  p_segment text DEFAULT 'normal'::text,
  p_notes text DEFAULT NULL::text,
  p_internal_notes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_id uuid;
  v_segment text;
  v_is_vip boolean;
  v_is_banned boolean;
  v_marketing_opt_in boolean;
BEGIN
  -- Enforce tenant access (staff+ can update)
  IF NOT public.user_has_role_for_tenant(p_tenant_id, ARRAY['owner','admin','staff']) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acceso denegado');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.customers
    WHERE id = p_customer_id AND tenant_id = p_tenant_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente no encontrado o acceso denegado');
  END IF;

  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'El nombre es obligatorio');
  END IF;

  v_segment := COALESCE(NULLIF(trim(p_segment), ''), 'normal');
  IF v_segment NOT IN ('normal','vip','banned','marketing','no_contact') THEN
    v_segment := 'normal';
  END IF;

  v_is_vip := (v_segment = 'vip');
  v_is_banned := (v_segment = 'banned');
  v_marketing_opt_in := (v_segment = 'marketing');

  IF p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    SELECT id INTO v_existing_id
    FROM public.customers
    WHERE tenant_id = p_tenant_id
      AND lower(email) = lower(trim(p_email))
      AND id <> p_customer_id
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Otro cliente ya usa este email');
    END IF;
  END IF;

  UPDATE public.customers
  SET
    full_name = trim(p_full_name),
    first_name = split_part(trim(p_full_name), ' ', 1),
    email = CASE WHEN p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN lower(trim(p_email)) ELSE NULL END,
    phone = CASE WHEN p_phone IS NOT NULL AND length(trim(p_phone)) > 0 THEN trim(p_phone) ELSE NULL END,
    is_vip = v_is_vip,
    is_banned = v_is_banned,
    marketing_opt_in = v_marketing_opt_in,
    notes = p_notes,
    internal_notes = p_internal_notes,
    updated_at = now()
  WHERE id = p_customer_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;


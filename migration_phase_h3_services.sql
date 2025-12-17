-- Migration: Phase H.3 - Services Module Fixes
-- Description: RPCs for secure Services CRUD operations from the Panel.
-- Author: Antigravity
-- Date: 2025-12-17

-- 1. manage_list_services
-- Clean list function with robust filtering and sorting
CREATE OR REPLACE FUNCTION manage_list_services(
  p_tenant_id uuid,
  p_search_term text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_status text DEFAULT 'active', -- 'active', 'inactive', 'all'
  p_sort_by text DEFAULT 'name', -- 'name', 'price', 'duration'
  p_sort_direction text DEFAULT 'asc'
)
RETURNS SETOF services
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT s.*
  FROM services s
  WHERE s.tenant_id = p_tenant_id
    -- Search Term
    AND (
      p_search_term IS NULL 
      OR length(trim(p_search_term)) = 0 
      OR s.name ILIKE '%' || trim(p_search_term) || '%'
      OR s.description ILIKE '%' || trim(p_search_term) || '%'
    )
    -- Category
    AND (
      p_category IS NULL 
      OR p_category = 'all'
      OR s.category = p_category
    )
    -- Status
    AND (
      p_status = 'all'
      OR (p_status = 'active' AND s.active = true)
      OR (p_status = 'inactive' AND s.active = false)
    )
  ORDER BY
    CASE WHEN p_sort_by = 'price' AND p_sort_direction = 'asc' THEN s.price_cents END ASC,
    CASE WHEN p_sort_by = 'price' AND p_sort_direction = 'desc' THEN s.price_cents END DESC,
    CASE WHEN p_sort_by = 'duration' AND p_sort_direction = 'asc' THEN s.duration_min END ASC,
    CASE WHEN p_sort_by = 'duration' AND p_sort_direction = 'desc' THEN s.duration_min END DESC,
    -- Default name sort
    CASE WHEN p_sort_by = 'name' OR p_sort_by IS NULL THEN s.name END ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION manage_list_services(uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION manage_list_services(uuid, text, text, text, text, text) TO service_role;


-- 2. manage_create_service
CREATE OR REPLACE FUNCTION manage_create_service(
  p_tenant_id uuid,
  p_name text,
  p_duration_min int,
  p_price_cents int,
  p_category text DEFAULT 'General',
  p_buffer_min int DEFAULT 0,
  p_description text DEFAULT NULL,
  p_active boolean DEFAULT true,
  p_pricing_levels jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_id uuid;
BEGIN
  -- Basic Validation
  IF length(trim(p_name)) = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'El nombre es obligatorio');
  END IF;

  IF p_duration_min < 5 THEN
     RETURN jsonb_build_object('success', false, 'error', 'La duración mínima es de 5 minutos');
  END IF;

  INSERT INTO services (
    tenant_id,
    name,
    duration_min,
    price_cents,
    category,
    buffer_min,
    description,
    active,
    pricing_levels,
    created_at,
    updated_at
  ) VALUES (
    p_tenant_id,
    trim(p_name),
    p_duration_min,
    p_price_cents,
    p_category,
    p_buffer_min,
    p_description,
    p_active,
    p_pricing_levels,
    now(),
    now()
  )
  RETURNING id INTO v_service_id;

  RETURN jsonb_build_object(
    'success', true, 
    'service_id', v_service_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION manage_create_service(uuid, text, int, int, text, int, text, boolean, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION manage_create_service(uuid, text, int, int, text, int, text, boolean, jsonb) TO service_role;


-- 3. manage_update_service
CREATE OR REPLACE FUNCTION manage_update_service(
  p_service_id uuid,
  p_tenant_id uuid,
  p_name text,
  p_duration_min int,
  p_price_cents int,
  p_category text,
  p_buffer_min int,
  p_description text,
  p_active boolean,
  p_pricing_levels jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check ownwership
  IF NOT EXISTS (SELECT 1 FROM services WHERE id = p_service_id AND tenant_id = p_tenant_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Servicio no encontrado o acceso denegado');
  END IF;

  UPDATE services
  SET
    name = trim(p_name),
    duration_min = p_duration_min,
    price_cents = p_price_cents,
    category = p_category,
    buffer_min = p_buffer_min,
    description = p_description,
    active = p_active,
    pricing_levels = p_pricing_levels,
    updated_at = now()
  WHERE id = p_service_id;

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION manage_update_service(uuid, uuid, text, int, int, text, int, text, boolean, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION manage_update_service(uuid, uuid, text, int, int, text, int, text, boolean, jsonb) TO service_role;


-- 4. manage_duplicate_service
CREATE OR REPLACE FUNCTION manage_duplicate_service(
  p_service_id uuid,
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original services%ROWTYPE;
  v_new_id uuid;
BEGIN
  SELECT * INTO v_original
  FROM services
  WHERE id = p_service_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Servicio original no encontrado');
  END IF;

  INSERT INTO services (
    tenant_id,
    name,
    duration_min,
    price_cents,
    category,
    buffer_min,
    description,
    active,
    pricing_levels,
    created_at,
    updated_at
  ) VALUES (
    v_original.tenant_id,
    v_original.name || ' (copia)',
    v_original.duration_min,
    v_original.price_cents,
    v_original.category,
    v_original.buffer_min,
    v_original.description,
    false, -- duplicated start as inactive
    v_original.pricing_levels,
    now(),
    now()
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'service_id', v_new_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION manage_duplicate_service(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION manage_duplicate_service(uuid, uuid) TO service_role;


-- 5. manage_delete_service (Hard Delete)
CREATE OR REPLACE FUNCTION manage_delete_service(
  p_service_id uuid,
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM services WHERE id = p_service_id AND tenant_id = p_tenant_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Servicio no encontrado');
  END IF;

  DELETE FROM services
  WHERE id = p_service_id AND tenant_id = p_tenant_id;

  RETURN jsonb_build_object('success', true);

EXCEPTION 
  WHEN foreign_key_violation THEN
    -- If booked, fallback to Archive recommended in frontend, but here return error
    RETURN jsonb_build_object('success', false, 'error', 'No se puede eliminar porque tiene citas asociadas. Archívalo en su lugar.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION manage_delete_service(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION manage_delete_service(uuid, uuid) TO service_role;

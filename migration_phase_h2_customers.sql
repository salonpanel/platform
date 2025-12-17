-- Migration: Phase H.2 - Customers Module Fixes
-- Description: RPCs for secure Customer CRUD operations from the Panel.
-- Author: Antigravity
-- Date: 2025-12-17

-- 1. manage_create_customer
-- Handles safe creation with duplicate checks
CREATE OR REPLACE FUNCTION manage_create_customer(
  p_tenant_id uuid,
  p_full_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_segment text DEFAULT 'normal',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_existing_id uuid;
BEGIN
  -- Basic Validation
  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'El nombre es obligatorio');
  END IF;

  -- 1. Check for duplicates (by email if provided)
  IF p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    SELECT id INTO v_existing_id
    FROM customers
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

  -- 2. Insert Record
  INSERT INTO customers (
    tenant_id,
    full_name,
    first_name, -- Populate first_name for compatibility
    email,
    phone,
    segment,
    notes,
    created_at,
    updated_at
  ) VALUES (
    p_tenant_id,
    trim(p_full_name),
    split_part(trim(p_full_name), ' ', 1), -- Simple split for compatibility, can be refined
    CASE WHEN length(trim(p_email)) > 0 THEN lower(trim(p_email)) ELSE NULL END,
    CASE WHEN length(trim(p_phone)) > 0 THEN trim(p_phone) ELSE NULL END,
    p_segment,
    p_notes,
    now(),
    now()
  )
  RETURNING id INTO v_customer_id;

  RETURN jsonb_build_object(
    'success', true, 
    'customer_id', v_customer_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION manage_create_customer(uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION manage_create_customer(uuid, text, text, text, text, text) TO service_role;


-- 2. manage_update_customer
CREATE OR REPLACE FUNCTION manage_update_customer(
  p_customer_id uuid,
  p_tenant_id uuid,
  p_full_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_segment text DEFAULT 'normal',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  -- Security Check: Record must belong to tenant
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id AND tenant_id = p_tenant_id) THEN
     RETURN jsonb_build_object('success', false, 'error', 'Cliente no encontrado o acceso denegado');
  END IF;

   -- Basic Validation
  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'El nombre es obligatorio');
  END IF;

  -- 1. Check for duplicates (if email changed)
  IF p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    SELECT id INTO v_existing_id
    FROM customers
    WHERE tenant_id = p_tenant_id
      AND lower(email) = lower(trim(p_email))
      AND id <> p_customer_id -- Exclude self
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Otro cliente ya usa este email');
    END IF;
  END IF;

  -- 2. Update Record
  UPDATE customers
  SET
    full_name = trim(p_full_name),
    first_name = split_part(trim(p_full_name), ' ', 1),
    email = CASE WHEN length(trim(p_email)) > 0 THEN lower(trim(p_email)) ELSE NULL END,
    phone = CASE WHEN length(trim(p_phone)) > 0 THEN trim(p_phone) ELSE NULL END,
    segment = p_segment,
    notes = p_notes,
    updated_at = now()
  WHERE id = p_customer_id;

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION manage_update_customer(uuid, uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION manage_update_customer(uuid, uuid, text, text, text, text, text) TO service_role;


-- 3. manage_delete_customers
CREATE OR REPLACE FUNCTION manage_delete_customers(
  p_customer_ids uuid[],
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count int;
BEGIN
  -- 1. Delete records belonging to tenant
  -- Cascading deletes should handle dependencies if FKs are set correctly, 
  -- but strict mode might prevent it if bookings exist. 
  -- Assuming soft delete or cascade is handled by DB constraints or we want to block if data exists.
  -- For now, we perform direct delete and catch FK constraint errors.
  
  DELETE FROM customers
  WHERE id = ANY(p_customer_ids)
    AND tenant_id = p_tenant_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true, 
    'deleted_count', v_deleted_count
  );

EXCEPTION 
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'No se pueden eliminar clientes con citas o historico asociado.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION manage_delete_customers(uuid[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION manage_delete_customers(uuid[], uuid) TO service_role;

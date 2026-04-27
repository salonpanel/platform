-- ============================================================
-- 1. Add `arrived` to booking_state check constraint
-- ============================================================
-- Flow: pending/confirmed → arrived (client is here, waiting)
--       arrived → in_progress (service started)
--       in_progress → completed

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_booking_state_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_booking_state_check
    CHECK (booking_state IN (
      'pending','confirmed','arrived','in_progress',
      'completed','cancelled','no_show'
    ));

-- ============================================================
-- 2. Fix platform.log_audit FK error for regular tenant users
-- ============================================================
-- Root cause: platform.audit_logs.user_id → platform.platform_users(id)
-- Regular barbershop users exist in auth.users but NOT in platform.platform_users.
-- When their booking changes trigger audit_customer_changes → log_audit(auth.uid()),
-- the FK constraint fails because auth.uid() is not a platform admin.
--
-- Fix: null out user_id in log_audit when the user is not in platform.platform_users.
-- The tenant_id and resource details are still fully recorded.

CREATE OR REPLACE FUNCTION platform.log_audit(
  p_tenant_id      uuid,
  p_user_id        uuid,
  p_action         text,
  p_resource_type  text,
  p_resource_id    uuid       DEFAULT NULL,
  p_old_data       jsonb      DEFAULT NULL,
  p_new_data       jsonb      DEFAULT NULL,
  p_metadata       jsonb      DEFAULT NULL,
  p_impersonated_by uuid      DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = platform, pg_temp
AS $$
DECLARE
  v_log_id uuid;
  v_safe_user_id uuid;
BEGIN
  -- Only reference platform_users if this user is actually a platform admin.
  -- Regular tenant users (barbershop owners/staff) are in auth.users but NOT
  -- in platform.platform_users, so we store NULL to avoid the FK violation.
  SELECT id INTO v_safe_user_id
    FROM platform.platform_users
   WHERE id = p_user_id;
  -- If not found, v_safe_user_id stays NULL (no error).

  INSERT INTO platform.audit_logs (
    tenant_id,
    user_id,
    action,
    resource_type,
    resource_id,
    old_data,
    new_data,
    metadata,
    impersonated_by
  ) VALUES (
    p_tenant_id,
    v_safe_user_id,   -- NULL when user is not a platform admin
    p_action,
    p_resource_type,
    p_resource_id,
    p_old_data,
    p_new_data,
    p_metadata,
    p_impersonated_by
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

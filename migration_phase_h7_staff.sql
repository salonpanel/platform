-- Phase H.7: Staff Module Stabilization
-- Goal: Atomic RPCs for Staff management (Profile + Schedules + Services)

-- 1. Create Staff (Atomic)
CREATE OR REPLACE FUNCTION panel_manage_create_staff_v1(
    p_tenant_id uuid,
    p_name text,
    p_display_name text DEFAULT NULL,
    p_weekly_hours int DEFAULT NULL,
    p_user_id uuid DEFAULT NULL,
    p_role text DEFAULT NULL,
    p_schedules jsonb DEFAULT NULL,
    p_service_ids jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_staff_id uuid;
    v_safe_role text;
BEGIN
    -- 0. Sanitization (The Fix)
    v_safe_role := p_role;
    IF v_safe_role = 'admin' THEN
        v_safe_role := 'manager';
    END IF;

    -- 1. Validate Access
    IF NOT EXISTS (
        SELECT 1 FROM memberships 
        WHERE user_id = auth.uid() 
        AND tenant_id = p_tenant_id
        AND role IN ('owner', 'admin', 'manager') -- strict role check for mutations
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- 2. Insert Staff
    INSERT INTO staff (
        tenant_id,
        name,
        display_name,
        active,
        weekly_hours,
        user_id,
        role,
        provides_services
    ) VALUES (
        p_tenant_id,
        p_name,
        COALESCE(p_display_name, p_name),
        true, -- default active
        COALESCE(p_weekly_hours, 40),
        p_user_id,
        COALESCE(v_safe_role, 'staff')::app_role,
        true -- default provides_services
    )
    RETURNING id INTO v_new_staff_id;

    -- 3. Insert Schedules
    IF p_schedules IS NOT NULL AND jsonb_array_length(p_schedules) > 0 THEN
        INSERT INTO staff_schedules (
            tenant_id,
            staff_id,
            day_of_week,
            start_time,
            end_time,
            is_active
        )
        SELECT 
            p_tenant_id,
            v_new_staff_id,
            (item->>'day_of_week')::int,
            (item->>'start_time')::time,
            (item->>'end_time')::time,
            (item->>'is_active')::boolean
        FROM jsonb_array_elements(p_schedules) item;
    END IF;

    -- 4. Insert Service Relations
    IF p_service_ids IS NOT NULL AND jsonb_array_length(p_service_ids) > 0 THEN
        INSERT INTO staff_services (
            tenant_id,
            staff_id,
            service_id
        )
        SELECT 
            p_tenant_id,
            v_new_staff_id,
            (value::text)::uuid
        FROM jsonb_array_elements_text(p_service_ids);
    END IF;

    -- 5. Return Result
    RETURN jsonb_build_object(
        'status', 'OK',
        'data', jsonb_build_object('id', v_new_staff_id)
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'status', 'ERROR',
        'error', SQLERRM
    );
END;
$$;

-- 2. Update Staff (Atomic)
CREATE OR REPLACE FUNCTION panel_manage_update_staff_v1(
    p_staff_id uuid,
    p_tenant_id uuid,
    p_name text,
    p_display_name text DEFAULT NULL,
    p_weekly_hours int DEFAULT NULL,
    p_schedules jsonb DEFAULT NULL,
    p_service_ids jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
BEGIN
    -- 1. Validate Access
    IF NOT EXISTS (
        SELECT 1 FROM memberships 
        WHERE user_id = auth.uid() 
        AND tenant_id = p_tenant_id
        AND role IN ('owner', 'admin')
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- 2. Update Staff Basic Info
    UPDATE staff
    SET 
        name = p_name,
        display_name = COALESCE(p_display_name, p_name),
        weekly_hours = COALESCE(p_weekly_hours, weekly_hours),
        updated_at = now()
    WHERE id = p_staff_id AND tenant_id = p_tenant_id;

    -- 3. Update Schedules (Replace Strategy)
    DELETE FROM staff_schedules WHERE staff_id = p_staff_id AND tenant_id = p_tenant_id;
    
    IF p_schedules IS NOT NULL AND jsonb_array_length(p_schedules) > 0 THEN
        INSERT INTO staff_schedules (
            tenant_id,
            staff_id,
            day_of_week,
            start_time,
            end_time,
            is_active
        )
        SELECT 
            p_tenant_id,
            p_staff_id,
            (item->>'day_of_week')::int,
            (item->>'start_time')::time,
            (item->>'end_time')::time,
            (item->>'is_active')::boolean
        FROM jsonb_array_elements(p_schedules) item;
    END IF;

    -- 4. Update Service Relations (Replace Strategy)
    DELETE FROM staff_services WHERE staff_id = p_staff_id AND tenant_id = p_tenant_id;

    IF p_service_ids IS NOT NULL AND jsonb_array_length(p_service_ids) > 0 THEN
        INSERT INTO staff_services (
            tenant_id,
            staff_id,
            service_id
        )
        SELECT 
            p_tenant_id,
            p_staff_id,
            (value::text)::uuid
        FROM jsonb_array_elements_text(p_service_ids);
    END IF;

    RETURN jsonb_build_object('status', 'OK');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'status', 'ERROR',
        'error', SQLERRM
    );
END;
$$;

-- 3. Toggle Staff Active Status
CREATE OR REPLACE FUNCTION panel_manage_toggle_staff_active_v1(
    p_staff_id uuid,
    p_tenant_id uuid,
    p_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Validate Access
    IF NOT EXISTS (
        SELECT 1 FROM memberships 
        WHERE user_id = auth.uid() 
        AND tenant_id = p_tenant_id
        AND role IN ('owner', 'admin')
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- 2. Update
    UPDATE staff
    SET active = p_active, updated_at = now()
    WHERE id = p_staff_id AND tenant_id = p_tenant_id;

    RETURN jsonb_build_object('status', 'OK');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'status', 'ERROR',
        'error', SQLERRM
    );
END;
$$;

-- Migration: Fix RPC Errors (Description column & Ambiguous IDs)
-- Date: 2025-12-18
-- Author: Antigravity

-- 1. Add missing 'description' column to services
-- This fixes the "column s.description does not exist" error in manage_list_services
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='description') THEN
        ALTER TABLE services ADD COLUMN description text;
    END IF;
END $$;

-- 2. Fix 'get_staff_with_stats' ambiguous ID error
-- We use explicit aliases (st.id instead of just id) in WHERE EXISTS clauses
CREATE OR REPLACE FUNCTION get_staff_with_stats(
    p_tenant_id uuid, 
    p_include_inactive boolean DEFAULT false
) 
RETURNS TABLE(
    id uuid, 
    tenant_id uuid, 
    name text, 
    display_name text, 
    active boolean, 
    user_id uuid, 
    profile_photo_url text, 
    weekly_hours integer, 
    provides_services boolean, 
    skills text[], 
    created_at timestamp with time zone, 
    bookings_today integer, 
    bookings_this_week integer, 
    bookings_this_month integer, 
    bookings_all_time integer, 
    revenue_today bigint, 
    revenue_this_week bigint, 
    revenue_this_month bigint, 
    revenue_all_time bigint, 
    occupancy_today_percent integer, 
    occupancy_this_week_percent integer, 
    no_shows_this_month integer, 
    cancellations_this_month integer, 
    avg_service_duration_min integer, 
    services_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start TIMESTAMPTZ := date_trunc('day', NOW());
  v_today_end TIMESTAMPTZ := date_trunc('day', NOW()) + INTERVAL '1 day';
  v_week_start TIMESTAMPTZ := date_trunc('week', NOW());
  v_month_start TIMESTAMPTZ := date_trunc('month', NOW());
BEGIN
  RETURN QUERY
  WITH staff_bookings_stats AS (
    SELECT 
      b.staff_id,
      -- Reservas por periodo
      COUNT(*) FILTER (WHERE b.starts_at >= v_today_start AND b.starts_at < v_today_end AND b.status != 'cancelled')::INT as bookings_today,
      COUNT(*) FILTER (WHERE b.starts_at >= v_week_start AND b.status != 'cancelled')::INT as bookings_this_week,
      COUNT(*) FILTER (WHERE b.starts_at >= v_month_start AND b.status != 'cancelled')::INT as bookings_this_month,
      COUNT(*) FILTER (WHERE b.status != 'cancelled')::INT as bookings_all_time,
      
      -- Ingresos por periodo (solo reservas confirmadas/completadas/pagadas)
      COALESCE(SUM(srv.price_cents) FILTER (WHERE b.starts_at >= v_today_start AND b.starts_at < v_today_end AND b.status IN ('confirmed', 'completed', 'paid')), 0)::BIGINT as revenue_today,
      COALESCE(SUM(srv.price_cents) FILTER (WHERE b.starts_at >= v_week_start AND b.status IN ('confirmed', 'completed', 'paid')), 0)::BIGINT as revenue_this_week,
      COALESCE(SUM(srv.price_cents) FILTER (WHERE b.starts_at >= v_month_start AND b.status IN ('confirmed', 'completed', 'paid')), 0)::BIGINT as revenue_this_month,
      COALESCE(SUM(srv.price_cents) FILTER (WHERE b.status IN ('confirmed', 'completed', 'paid')), 0)::BIGINT as revenue_all_time,
      
      -- Métricas de calidad
      COUNT(*) FILTER (WHERE b.starts_at >= v_month_start AND b.status = 'no_show')::INT as no_shows_this_month,
      COUNT(*) FILTER (WHERE b.starts_at >= v_month_start AND b.status = 'cancelled')::INT as cancellations_this_month,
      
      -- Duración promedio de servicios
      ROUND(AVG(srv.duration_min) FILTER (WHERE b.status IN ('confirmed', 'completed', 'paid')))::INT as avg_service_duration_min
    FROM bookings b
    LEFT JOIN services srv ON b.service_id = srv.id
    WHERE b.tenant_id = p_tenant_id
    GROUP BY b.staff_id
  ),
  staff_schedules_stats AS (
    SELECT 
      ss.staff_id,
      -- Horas trabajadas hoy
      COALESCE(SUM(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 3600) FILTER (WHERE ss.day_of_week = EXTRACT(DOW FROM v_today_start)::INT AND ss.is_active), 0) as hours_today,
      -- Horas trabajadas esta semana (promedio diario * 7)
      COALESCE(AVG(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 3600) FILTER (WHERE ss.is_active) * 7, 0) as hours_this_week
    FROM staff_schedules ss
    -- FIX: Explicit aliasing for staff table to avoid ambiguity with column 'id'
    WHERE EXISTS (SELECT 1 FROM staff st WHERE st.id = ss.staff_id AND st.tenant_id = p_tenant_id)
    GROUP BY ss.staff_id
  ),
  staff_services_count AS (
    SELECT
      ssvc.staff_id,
      COUNT(DISTINCT ssvc.service_id)::INT as services_count
    FROM staff_services ssvc
    -- FIX: Explicit aliasing for staff table here too
    WHERE EXISTS (SELECT 1 FROM staff st WHERE st.id = ssvc.staff_id AND st.tenant_id = p_tenant_id)
    GROUP BY ssvc.staff_id
  )
  SELECT 
    s.id,
    s.tenant_id,
    s.name,
    s.display_name,
    s.active,
    s.user_id,
    s.profile_photo_url,
    s.weekly_hours,
    s.provides_services,
    s.skills,
    s.created_at,
    
    -- Stats de reservas
    COALESCE(sbs.bookings_today, 0),
    COALESCE(sbs.bookings_this_week, 0),
    COALESCE(sbs.bookings_this_month, 0),
    COALESCE(sbs.bookings_all_time, 0),
    
    -- Stats de ingresos
    COALESCE(sbs.revenue_today, 0),
    COALESCE(sbs.revenue_this_week, 0),
    COALESCE(sbs.revenue_this_month, 0),
    COALESCE(sbs.revenue_all_time, 0),
    
    -- Ocupación (reservas / slots disponibles * 100)
    CASE 
      WHEN sss.hours_today > 0 THEN LEAST(ROUND((sbs.bookings_today::NUMERIC / (sss.hours_today * 2)) * 100), 100)::INT
      ELSE 0
    END as occupancy_today_percent,
    CASE 
      WHEN sss.hours_this_week > 0 THEN LEAST(ROUND((sbs.bookings_this_week::NUMERIC / (sss.hours_this_week * 2)) * 100), 100)::INT
      ELSE 0
    END as occupancy_this_week_percent,
    
    -- Métricas de calidad
    COALESCE(sbs.no_shows_this_month, 0),
    COALESCE(sbs.cancellations_this_month, 0),
    COALESCE(sbs.avg_service_duration_min, 0),
    
    -- Servicios
    COALESCE(ssc.services_count, 0)
    
  FROM staff s
  LEFT JOIN staff_bookings_stats sbs ON s.id = sbs.staff_id
  LEFT JOIN staff_schedules_stats sss ON s.id = sss.staff_id
  LEFT JOIN staff_services_count ssc ON s.id = ssc.staff_id
  WHERE s.tenant_id = p_tenant_id
    AND (p_include_inactive OR s.active = true);
END;
$$;

-- 3. Explicitly define manage_list_services to ensure version control
-- This definition includes the 'description' ILIKE search which caused the crash
CREATE OR REPLACE FUNCTION manage_list_services(
    p_tenant_id uuid,
    p_search_term text DEFAULT NULL,
    p_category text DEFAULT NULL,
    p_status text DEFAULT 'active',
    p_sort_by text DEFAULT 'name',
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

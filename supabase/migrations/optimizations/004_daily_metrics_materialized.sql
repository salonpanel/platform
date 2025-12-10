-- =====================================================
-- TABLA: daily_metrics (Métricas Materializadas)
-- =====================================================
-- Descripción: Almacena métricas diarias precalculadas para cada tenant
-- Beneficio: Dashboard carga instantáneamente sin recalcular
-- Impacto: Reduce tiempo de carga del dashboard de ~2s a <100ms
-- =====================================================

CREATE TABLE IF NOT EXISTS daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  
  -- Métricas de reservas
  total_bookings INT DEFAULT 0,
  confirmed_bookings INT DEFAULT 0,
  completed_bookings INT DEFAULT 0,
  cancelled_bookings INT DEFAULT 0,
  no_show_bookings INT DEFAULT 0,
  
  -- Métricas de ingresos (en centavos)
  revenue_cents BIGINT DEFAULT 0,
  
  -- Métricas de staff y servicios
  active_services INT DEFAULT 0,
  active_staff INT DEFAULT 0,
  
  -- Métricas de clientes
  new_customers INT DEFAULT 0,
  returning_customers INT DEFAULT 0,
  
  -- Métricas de ocupación
  available_slots INT DEFAULT 0,
  booked_slots INT DEFAULT 0,
  occupancy_percent INT DEFAULT 0,
  
  -- Ticket medio (en centavos)
  avg_ticket_cents BIGINT DEFAULT 0,
  
  -- Metadatos
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint única por tenant y fecha
  UNIQUE(tenant_id, metric_date)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_daily_metrics_tenant_date 
ON daily_metrics(tenant_id, metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_date 
ON daily_metrics(metric_date DESC);

-- Comentario descriptivo
COMMENT ON TABLE daily_metrics IS 
'Tabla materializada con métricas diarias precalculadas por tenant.
Actualizada automáticamente mediante triggers.
Permite carga instantánea del dashboard sin recalcular métricas.';

-- =====================================================
-- FUNCIÓN: update_daily_metrics
-- =====================================================
-- Descripción: Recalcula métricas para un tenant y fecha específica
-- Uso: Llamada por triggers o manualmente para actualizar datos
-- =====================================================

CREATE OR REPLACE FUNCTION update_daily_metrics(
  p_tenant_id UUID,
  p_date DATE
)
RETURNS VOID AS $$
DECLARE
  v_day_start TIMESTAMPTZ;
  v_day_end TIMESTAMPTZ;
  v_timezone TEXT;
BEGIN
  -- Obtener timezone del tenant
  SELECT timezone INTO v_timezone
  FROM tenants WHERE id = p_tenant_id;
  
  v_timezone := COALESCE(v_timezone, 'Europe/Madrid');
  
  -- Calcular inicio y fin del día en la zona horaria del tenant
  v_day_start := (p_date::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE v_timezone;
  v_day_end := v_day_start + INTERVAL '1 day';

  -- Insertar o actualizar métricas
  INSERT INTO daily_metrics (
    tenant_id,
    metric_date,
    total_bookings,
    confirmed_bookings,
    completed_bookings,
    cancelled_bookings,
    no_show_bookings,
    revenue_cents,
    active_services,
    active_staff,
    new_customers,
    returning_customers,
    available_slots,
    booked_slots,
    occupancy_percent,
    avg_ticket_cents,
    updated_at
  )
  SELECT
    p_tenant_id,
    p_date,
    -- Reservas por estado
    COUNT(*) FILTER (WHERE status != 'cancelled'),
    COUNT(*) FILTER (WHERE status IN ('confirmed', 'completed', 'paid')),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'cancelled'),
    COUNT(*) FILTER (WHERE status = 'no_show'),
    -- Ingresos
    COALESCE(SUM(srv.price_cents) FILTER (WHERE b.status IN ('confirmed', 'completed', 'paid')), 0),
    -- Staff y servicios activos (snapshot del día)
    (SELECT COUNT(*) FROM services WHERE tenant_id = p_tenant_id AND active = true),
    (SELECT COUNT(*) FROM staff WHERE tenant_id = p_tenant_id AND active = true),
    -- Clientes nuevos vs recurrentes
    COUNT(DISTINCT c.id) FILTER (WHERE c.created_at >= v_day_start AND c.created_at < v_day_end),
    COUNT(DISTINCT c.id) FILTER (WHERE c.created_at < v_day_start),
    -- Slots disponibles (basado en horarios del staff)
    (
      SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 1800), 0)::INT
      FROM staff_schedules ss
      INNER JOIN staff st ON ss.staff_id = st.id
      WHERE st.tenant_id = p_tenant_id
        AND st.active = true
        AND ss.is_active = true
        AND ss.day_of_week = EXTRACT(DOW FROM p_date)::INT
    ),
    -- Slots reservados
    COUNT(*) FILTER (WHERE b.status IN ('confirmed', 'completed', 'paid')),
    -- Ocupación
    CASE 
      WHEN (
        SELECT SUM(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 1800)
        FROM staff_schedules ss
        INNER JOIN staff st ON ss.staff_id = st.id
        WHERE st.tenant_id = p_tenant_id
          AND st.active = true
          AND ss.is_active = true
          AND ss.day_of_week = EXTRACT(DOW FROM p_date)::INT
      ) > 0 THEN
        LEAST(ROUND((COUNT(*) FILTER (WHERE b.status IN ('confirmed', 'completed', 'paid'))::NUMERIC / 
          (SELECT SUM(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 1800)
           FROM staff_schedules ss
           INNER JOIN staff st ON ss.staff_id = st.id
           WHERE st.tenant_id = p_tenant_id AND st.active = true AND ss.is_active = true 
           AND ss.day_of_week = EXTRACT(DOW FROM p_date)::INT)) * 100), 100)::INT
      ELSE 0
    END,
    -- Ticket medio
    CASE 
      WHEN COUNT(*) FILTER (WHERE b.status IN ('confirmed', 'completed', 'paid')) > 0 THEN
        (SUM(srv.price_cents) FILTER (WHERE b.status IN ('confirmed', 'completed', 'paid')) / 
         COUNT(*) FILTER (WHERE b.status IN ('confirmed', 'completed', 'paid')))::BIGINT
      ELSE 0
    END,
    NOW()
  FROM bookings b
  LEFT JOIN services srv ON b.service_id = srv.id
  LEFT JOIN customers c ON b.customer_id = c.id
  WHERE b.tenant_id = p_tenant_id
    AND b.starts_at >= v_day_start
    AND b.starts_at < v_day_end
  ON CONFLICT (tenant_id, metric_date)
  DO UPDATE SET
    total_bookings = EXCLUDED.total_bookings,
    confirmed_bookings = EXCLUDED.confirmed_bookings,
    completed_bookings = EXCLUDED.completed_bookings,
    cancelled_bookings = EXCLUDED.cancelled_bookings,
    no_show_bookings = EXCLUDED.no_show_bookings,
    revenue_cents = EXCLUDED.revenue_cents,
    active_services = EXCLUDED.active_services,
    active_staff = EXCLUDED.active_staff,
    new_customers = EXCLUDED.new_customers,
    returning_customers = EXCLUDED.returning_customers,
    available_slots = EXCLUDED.available_slots,
    booked_slots = EXCLUDED.booked_slots,
    occupancy_percent = EXCLUDED.occupancy_percent,
    avg_ticket_cents = EXCLUDED.avg_ticket_cents,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_daily_metrics IS 
'Recalcula y actualiza métricas diarias para un tenant y fecha específica.
Ejecutada automáticamente por triggers cuando se crean/modifican reservas.';

-- =====================================================
-- TRIGGER: Actualizar métricas al modificar reservas
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_update_daily_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar métricas para el día de la reserva (NEW)
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM update_daily_metrics(NEW.tenant_id, NEW.starts_at::DATE);
  END IF;
  
  -- Si se movió la reserva a otra fecha, actualizar el día anterior también
  IF TG_OP = 'UPDATE' AND OLD.starts_at::DATE != NEW.starts_at::DATE THEN
    PERFORM update_daily_metrics(OLD.tenant_id, OLD.starts_at::DATE);
  END IF;
  
  -- Si se eliminó, actualizar el día de la reserva eliminada
  IF TG_OP = 'DELETE' THEN
    PERFORM update_daily_metrics(OLD.tenant_id, OLD.starts_at::DATE);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
DROP TRIGGER IF EXISTS trg_bookings_update_metrics ON bookings;
CREATE TRIGGER trg_bookings_update_metrics
AFTER INSERT OR UPDATE OR DELETE ON bookings
FOR EACH ROW
EXECUTE FUNCTION trigger_update_daily_metrics();

COMMENT ON TRIGGER trg_bookings_update_metrics ON bookings IS 
'Actualiza automáticamente daily_metrics cuando se crean/modifican/eliminan reservas.';

-- =====================================================
-- FUNCIÓN: get_metrics_range
-- =====================================================
-- Descripción: Retorna métricas agregadas para un rango de fechas
-- Uso: Dashboard usa esto en lugar de calcular desde bookings
-- =====================================================

CREATE OR REPLACE FUNCTION get_metrics_range(
  p_tenant_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  metric_date DATE,
  total_bookings INT,
  revenue_cents BIGINT,
  occupancy_percent INT,
  avg_ticket_cents BIGINT,
  no_show_bookings INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dm.metric_date,
    dm.total_bookings,
    dm.revenue_cents,
    dm.occupancy_percent,
    dm.avg_ticket_cents,
    dm.no_show_bookings
  FROM daily_metrics dm
  WHERE dm.tenant_id = p_tenant_id
    AND dm.metric_date >= p_start_date
    AND dm.metric_date <= p_end_date
  ORDER BY dm.metric_date DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_metrics_range IS 
'Retorna métricas diarias para un rango de fechas desde la tabla materializada.
Carga instantánea para gráficos históricos del dashboard.';

GRANT EXECUTE ON FUNCTION get_metrics_range TO authenticated;

-- =====================================================
-- FUNCIÓN: Inicializar métricas históricas
-- =====================================================
-- Descripción: Pobla daily_metrics con datos históricos existentes
-- Uso: Ejecutar UNA VEZ después de crear la tabla
-- =====================================================

CREATE OR REPLACE FUNCTION initialize_daily_metrics(
  p_tenant_id UUID DEFAULT NULL,
  p_days_back INT DEFAULT 90
)
RETURNS INT AS $$
DECLARE
  v_tenant_id UUID;
  v_date DATE;
  v_count INT := 0;
BEGIN
  -- Si no se especifica tenant, procesar todos
  FOR v_tenant_id IN 
    SELECT id FROM tenants WHERE (p_tenant_id IS NULL OR id = p_tenant_id)
  LOOP
    -- Procesar últimos N días
    FOR v_date IN 
      SELECT generate_series(
        CURRENT_DATE - (p_days_back || ' days')::INTERVAL,
        CURRENT_DATE,
        '1 day'::INTERVAL
      )::DATE
    LOOP
      PERFORM update_daily_metrics(v_tenant_id, v_date);
      v_count := v_count + 1;
    END LOOP;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION initialize_daily_metrics IS 
'Inicializa daily_metrics con datos históricos.
Ejecutar UNA VEZ después de crear la tabla: SELECT initialize_daily_metrics();';

-- Grant permissions
GRANT EXECUTE ON FUNCTION initialize_daily_metrics TO authenticated;

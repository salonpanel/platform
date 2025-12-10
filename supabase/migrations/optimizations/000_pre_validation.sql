-- =====================================================
-- SCRIPT DE VALIDACIÓN PRE-IMPLEMENTACIÓN
-- =====================================================
-- Ejecutar ANTES de implementar las optimizaciones
-- Verifica que la estructura de la BD está lista
-- =====================================================

-- =====================================================
-- 1. VERIFICAR TABLAS EXISTENTES
-- =====================================================

DO $$
DECLARE
  v_missing_tables TEXT[] := ARRAY[]::TEXT[];
  v_table TEXT;
BEGIN
  -- Verificar tablas requeridas
  FOR v_table IN 
    SELECT unnest(ARRAY['tenants', 'bookings', 'services', 'staff', 'customers', 
                        'staff_schedules', 'staff_blockings', 'team_messages', 
                        'team_conversations', 'memberships'])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = v_table
    ) THEN
      v_missing_tables := array_append(v_missing_tables, v_table);
    END IF;
  END LOOP;
  
  IF array_length(v_missing_tables, 1) > 0 THEN
    RAISE EXCEPTION 'Faltan las siguientes tablas: %', array_to_string(v_missing_tables, ', ');
  ELSE
    RAISE NOTICE '✓ Todas las tablas requeridas existen';
  END IF;
END $$;

-- =====================================================
-- 2. VERIFICAR COLUMNAS CRÍTICAS
-- =====================================================

DO $$
BEGIN
  -- Verificar columnas en bookings
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'status'
  ) THEN
    RAISE EXCEPTION 'Falta columna status en bookings';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'starts_at'
  ) THEN
    RAISE EXCEPTION 'Falta columna starts_at en bookings';
  END IF;
  
  -- Verificar columnas en services
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'services' AND column_name = 'price_cents'
  ) THEN
    RAISE EXCEPTION 'Falta columna price_cents en services';
  END IF;
  
  -- Verificar columnas en staff
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'staff' AND column_name = 'active'
  ) THEN
    RAISE EXCEPTION 'Falta columna active en staff';
  END IF;
  
  RAISE NOTICE '✓ Todas las columnas críticas existen';
END $$;

-- =====================================================
-- 3. VERIFICAR EXTENSIONES NECESARIAS
-- =====================================================

DO $$
BEGIN
  -- Verificar pg_trgm (para búsqueda fuzzy)
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
  ) THEN
    RAISE NOTICE '⚠ ADVERTENCIA: Extensión pg_trgm no instalada. Se instalará automáticamente.';
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  ELSE
    RAISE NOTICE '✓ Extensión pg_trgm instalada';
  END IF;
END $$;

-- =====================================================
-- 4. CONTAR REGISTROS ACTUALES
-- =====================================================

DO $$
DECLARE
  v_tenants_count INT;
  v_bookings_count INT;
  v_services_count INT;
  v_staff_count INT;
  v_messages_count INT;
BEGIN
  SELECT COUNT(*) INTO v_tenants_count FROM tenants;
  SELECT COUNT(*) INTO v_bookings_count FROM bookings;
  SELECT COUNT(*) INTO v_services_count FROM services;
  SELECT COUNT(*) INTO v_staff_count FROM staff;
  SELECT COUNT(*) INTO v_messages_count FROM team_messages;
  
  RAISE NOTICE '📊 ESTADÍSTICAS ACTUALES:';
  RAISE NOTICE '  - Tenants: %', v_tenants_count;
  RAISE NOTICE '  - Bookings: %', v_bookings_count;
  RAISE NOTICE '  - Services: %', v_services_count;
  RAISE NOTICE '  - Staff: %', v_staff_count;
  RAISE NOTICE '  - Messages: %', v_messages_count;
  
  IF v_bookings_count = 0 THEN
    RAISE WARNING '⚠ No hay reservas en el sistema. Las métricas estarán vacías.';
  END IF;
END $$;

-- =====================================================
-- 5. VERIFICAR TAMAÑO DE TABLAS
-- =====================================================

SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('bookings', 'services', 'staff', 'team_messages', 'customers')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- =====================================================
-- 6. VERIFICAR ÍNDICES EXISTENTES
-- =====================================================

SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('bookings', 'services', 'staff', 'team_messages')
ORDER BY tablename, indexname;

-- =====================================================
-- 7. VERIFICAR PERMISOS
-- =====================================================

DO $$
DECLARE
  v_has_execute BOOLEAN;
BEGIN
  -- Verificar si el rol 'authenticated' tiene permisos de ejecución
  SELECT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants 
    WHERE grantee = 'authenticated' 
      AND table_schema = 'public'
  ) INTO v_has_execute;
  
  IF NOT v_has_execute THEN
    RAISE WARNING '⚠ Es posible que falten permisos para el rol authenticated';
  ELSE
    RAISE NOTICE '✓ Permisos básicos verificados';
  END IF;
END $$;

-- =====================================================
-- 8. TEST RÁPIDO DE CONSULTA
-- =====================================================

DO $$
DECLARE
  v_sample_tenant_id UUID;
  v_test_count INT;
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_duration INTERVAL;
BEGIN
  -- Obtener un tenant de ejemplo
  SELECT id INTO v_sample_tenant_id FROM tenants LIMIT 1;
  
  IF v_sample_tenant_id IS NULL THEN
    RAISE WARNING '⚠ No hay tenants en el sistema. No se pueden hacer tests.';
    RETURN;
  END IF;
  
  -- Test de velocidad de consulta actual
  v_start_time := clock_timestamp();
  
  SELECT COUNT(*) INTO v_test_count
  FROM bookings
  WHERE tenant_id = v_sample_tenant_id
    AND starts_at >= NOW() - INTERVAL '7 days';
  
  v_end_time := clock_timestamp();
  v_duration := v_end_time - v_start_time;
  
  RAISE NOTICE '⏱️  PRUEBA DE RENDIMIENTO ACTUAL:';
  RAISE NOTICE '  - Tenant test: %', v_sample_tenant_id;
  RAISE NOTICE '  - Reservas últimos 7 días: %', v_test_count;
  RAISE NOTICE '  - Tiempo de consulta: % ms', EXTRACT(MILLISECONDS FROM v_duration);
  
  IF EXTRACT(MILLISECONDS FROM v_duration) > 100 THEN
    RAISE NOTICE '  ⚠ La consulta es lenta. Las optimizaciones mejorarán esto.';
  ELSE
    RAISE NOTICE '  ✓ La consulta es rápida.';
  END IF;
END $$;

-- =====================================================
-- 9. VERIFICAR ESPACIO EN DISCO
-- =====================================================

SELECT 
  pg_database.datname as database_name,
  pg_size_pretty(pg_database_size(pg_database.datname)) as size
FROM pg_database
WHERE datname = current_database();

-- =====================================================
-- 10. RESUMEN FINAL
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ VALIDACIÓN COMPLETADA';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 PRÓXIMOS PASOS:';
  RAISE NOTICE '1. Revisar los resultados de esta validación';
  RAISE NOTICE '2. Hacer backup de la base de datos';
  RAISE NOTICE '3. Ejecutar scripts de optimización en orden:';
  RAISE NOTICE '   - 005_indexes_composite.sql';
  RAISE NOTICE '   - 001_get_dashboard_kpis.sql';
  RAISE NOTICE '   - 002_get_services_filtered.sql';
  RAISE NOTICE '   - 003_get_staff_with_stats.sql';
  RAISE NOTICE '   - 006_chat_optimization.sql';
  RAISE NOTICE '   - 004_daily_metrics_materialized.sql';
  RAISE NOTICE '4. Ejecutar script de post-validación';
  RAISE NOTICE '';
END $$;

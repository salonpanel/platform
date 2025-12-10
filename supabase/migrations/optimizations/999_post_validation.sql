-- =====================================================
-- SCRIPT DE POST-VALIDACIÓN
-- =====================================================
-- Ejecutar DESPUÉS de implementar las optimizaciones
-- Verifica que todo se instaló correctamente
-- =====================================================

-- =====================================================
-- 1. VERIFICAR FUNCIONES CREADAS
-- =====================================================

DO $$
DECLARE
  v_missing_functions TEXT[] := ARRAY[]::TEXT[];
  v_function TEXT;
  v_functions_to_check TEXT[] := ARRAY[
    'get_dashboard_kpis',
    'get_services_filtered',
    'get_service_categories',
    'get_service_price_range',
    'get_staff_with_stats',
    'get_staff_schedule',
    'get_staff_availability',
    'get_conversation_messages_paginated',
    'mark_conversation_as_read',
    'search_messages',
    'get_conversation_stats',
    'archive_old_messages',
    'update_daily_metrics',
    'get_metrics_range',
    'initialize_daily_metrics'
  ];
BEGIN
  FOR v_function IN SELECT unnest(v_functions_to_check)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = v_function
    ) THEN
      v_missing_functions := array_append(v_missing_functions, v_function);
    END IF;
  END LOOP;
  
  IF array_length(v_missing_functions, 1) > 0 THEN
    RAISE WARNING 'Faltan las siguientes funciones: %', array_to_string(v_missing_functions, ', ');
  ELSE
    RAISE NOTICE 'Todas las funciones de optimizacion estan creadas';
  END IF;
END $$;

-- =====================================================
-- 2. VERIFICAR ÍNDICES CREADOS
-- =====================================================

DO $$
DECLARE
  v_expected_indexes TEXT[] := ARRAY[
    'idx_bookings_tenant_date_status',
    'idx_bookings_staff_date',
    'idx_bookings_customer_tenant',
    'idx_bookings_service_date',
    'idx_bookings_revenue',
    'idx_staff_tenant_active',
    'idx_staff_user',
    'idx_services_tenant_active_category',
    'idx_services_tenant_price',
    'idx_services_stripe',
    'idx_customers_tenant_email',
    'idx_customers_tenant_phone',
    'idx_customers_name_trgm',
    'idx_messages_conversation_created',
    'idx_messages_sender_tenant',
    'idx_conversations_tenant',
    'idx_conversation_members_unread',
    'idx_schedules_staff_active',
    'idx_blockings_staff_dates',
    'idx_blockings_tenant_dates',
    'idx_memberships_user',
    'idx_memberships_tenant_role'
  ];
  v_missing_indexes TEXT[] := ARRAY[]::TEXT[];
  v_index TEXT;
BEGIN
  FOR v_index IN SELECT unnest(v_expected_indexes)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = 'public' AND indexname = v_index
    ) THEN
      v_missing_indexes := array_append(v_missing_indexes, v_index);
    END IF;
  END LOOP;
  
  IF array_length(v_missing_indexes, 1) > 0 THEN
    RAISE WARNING 'Faltan los siguientes indices: %', array_to_string(v_missing_indexes, ', ');
  ELSE
    RAISE NOTICE 'Todos los indices de optimizacion estan creados';
  END IF;
END $$;

-- =====================================================
-- 3. VERIFICAR TABLA DAILY_METRICS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'daily_metrics'
  ) THEN
    RAISE WARNING 'Tabla daily_metrics no existe';
  ELSE
    RAISE NOTICE 'Tabla daily_metrics creada correctamente';
    
    -- Verificar si tiene datos
    DECLARE
      v_record_count INT;
    BEGIN
      SELECT COUNT(*) INTO v_record_count FROM daily_metrics;
      RAISE NOTICE '  - Registros en daily_metrics: %', v_record_count;
      
      IF v_record_count = 0 THEN
        RAISE NOTICE '  Ejecuta: SELECT initialize_daily_metrics();';
      END IF;
    END;
  END IF;
END $$;

-- =====================================================
-- 4. VERIFICAR TRIGGERS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_bookings_update_metrics'
  ) THEN
    RAISE WARNING 'Trigger trg_bookings_update_metrics no existe';
  ELSE
    RAISE NOTICE 'Trigger de actualizacion de metricas esta activo';
  END IF;
END $$;

-- =====================================================
-- 5. TEST DE FUNCIONES
-- =====================================================

DO $$
DECLARE
  v_sample_tenant_id UUID;
  v_result JSON;
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_duration INTERVAL;
BEGIN
  -- Obtener un tenant de ejemplo
  SELECT id INTO v_sample_tenant_id FROM tenants LIMIT 1;
  
  IF v_sample_tenant_id IS NULL THEN
    RAISE WARNING 'No hay tenants para hacer pruebas';
    RETURN;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'PRUEBAS DE RENDIMIENTO:';
  RAISE NOTICE '';
  
  -- Test 1: get_dashboard_kpis
  BEGIN
    v_start_time := clock_timestamp();
    SELECT get_dashboard_kpis(v_sample_tenant_id) INTO v_result;
    v_end_time := clock_timestamp();
    v_duration := v_end_time - v_start_time;
    
    RAISE NOTICE 'get_dashboard_kpis:';
    RAISE NOTICE '  Tiempo: % ms', EXTRACT(MILLISECONDS FROM v_duration);
    RAISE NOTICE '  Resultado: % caracteres JSON', LENGTH(v_result::TEXT);
    
    IF EXTRACT(MILLISECONDS FROM v_duration) > 500 THEN
      RAISE WARNING '  La funcion es mas lenta de lo esperado (>500ms)';
    ELSIF EXTRACT(MILLISECONDS FROM v_duration) > 200 THEN
      RAISE NOTICE '  La funcion es aceptable pero puede mejorarse';
    ELSE
      RAISE NOTICE '  Excelente rendimiento (<200ms)';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '  Error al ejecutar get_dashboard_kpis: %', SQLERRM;
  END;
  
  RAISE NOTICE '';
  
  -- Test 2: get_services_filtered
  BEGIN
    v_start_time := clock_timestamp();
    PERFORM * FROM get_services_filtered(v_sample_tenant_id, 'active', NULL, NULL, NULL, NULL, NULL, NULL, 'name', 'ASC', 20, 0);
    v_end_time := clock_timestamp();
    v_duration := v_end_time - v_start_time;
    
    RAISE NOTICE 'get_services_filtered:';
    RAISE NOTICE '  Tiempo: % ms', EXTRACT(MILLISECONDS FROM v_duration);
    
    IF EXTRACT(MILLISECONDS FROM v_duration) < 150 THEN
      RAISE NOTICE '  Excelente rendimiento (<150ms)';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '  Error al ejecutar get_services_filtered: %', SQLERRM;
  END;
  
  RAISE NOTICE '';
  
  -- Test 3: get_staff_with_stats
  BEGIN
    v_start_time := clock_timestamp();
    PERFORM * FROM get_staff_with_stats(v_sample_tenant_id);
    v_end_time := clock_timestamp();
    v_duration := v_end_time - v_start_time;
    
    RAISE NOTICE 'get_staff_with_stats:';
    RAISE NOTICE '  Tiempo: % ms', EXTRACT(MILLISECONDS FROM v_duration);
    
    IF EXTRACT(MILLISECONDS FROM v_duration) < 100 THEN
      RAISE NOTICE '  Excelente rendimiento (<100ms)';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '  Error al ejecutar get_staff_with_stats: %', SQLERRM;
  END;
  
END $$;

-- =====================================================
-- 6. ANÁLISIS DE ÍNDICES
-- =====================================================

DO $$
DECLARE
  v_index_record RECORD;
  v_count INT := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'ANALISIS DE INDICES (Top 10):';
  RAISE NOTICE '';
  
  FOR v_index_record IN
    SELECT 
      si.schemaname,
      si.relname as tablename,
      si.indexrelname as indexname,
      pg_size_pretty(pg_relation_size(si.indexrelid)) as index_size,
      si.idx_scan as scans,
      si.idx_tup_read as tuples_read
    FROM pg_stat_user_indexes si
    WHERE si.schemaname = 'public'
      AND si.indexrelname LIKE 'idx_%'
    ORDER BY si.idx_scan DESC
    LIMIT 10
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '  %', v_index_record.indexname;
    RAISE NOTICE '     Tabla: %', v_index_record.tablename;
    RAISE NOTICE '     Tamaño: %', v_index_record.index_size;
    RAISE NOTICE '     Scans: %', v_index_record.scans;
  END LOOP;
  
  IF v_count = 0 THEN
    RAISE NOTICE '  No hay índices o aún no se han usado';
  END IF;
END $$;

-- =====================================================
-- 7. COMPARACIÓN DE RENDIMIENTO
-- =====================================================

DO $$
DECLARE
  v_sample_tenant_id UUID;
  v_old_method_time INTERVAL;
  v_new_method_time INTERVAL;
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_improvement NUMERIC;
BEGIN
  SELECT id INTO v_sample_tenant_id FROM tenants LIMIT 1;
  
  IF v_sample_tenant_id IS NULL THEN
    RETURN;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'COMPARACION DE RENDIMIENTO:';
  RAISE NOTICE '';
  
  -- Método antiguo (simular múltiples queries)
  v_start_time := clock_timestamp();
  PERFORM COUNT(*) FROM bookings WHERE tenant_id = v_sample_tenant_id AND starts_at >= NOW() - INTERVAL '7 days';
  PERFORM COUNT(*) FROM services WHERE tenant_id = v_sample_tenant_id AND active = true;
  PERFORM COUNT(*) FROM staff WHERE tenant_id = v_sample_tenant_id AND active = true;
  v_end_time := clock_timestamp();
  v_old_method_time := v_end_time - v_start_time;
  
  -- Método nuevo (función optimizada)
  v_start_time := clock_timestamp();
  PERFORM get_dashboard_kpis(v_sample_tenant_id);
  v_end_time := clock_timestamp();
  v_new_method_time := v_end_time - v_start_time;
  
  v_improvement := ((EXTRACT(MILLISECONDS FROM v_old_method_time) - EXTRACT(MILLISECONDS FROM v_new_method_time)) / EXTRACT(MILLISECONDS FROM v_old_method_time)) * 100;
  
  RAISE NOTICE 'Metodo anterior (queries separadas): % ms', EXTRACT(MILLISECONDS FROM v_old_method_time);
  RAISE NOTICE 'Metodo nuevo (funcion optimizada): % ms', EXTRACT(MILLISECONDS FROM v_new_method_time);
  RAISE NOTICE 'Mejora: % porciento mas rapido', ROUND(v_improvement, 2);
  
END $$;

-- =====================================================
-- 8. ESTADÍSTICAS FINALES
-- =====================================================

DO $$
DECLARE
  v_functions_count INT;
  v_indexes_count INT;
  v_indexes_size TEXT;
  v_metrics_count INT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'ESTADISTICAS POST-OPTIMIZACION:';
  RAISE NOTICE '';
  
  -- Contar funciones
  SELECT COUNT(*) INTO v_functions_count
  FROM pg_proc
  WHERE proname IN (
    'get_dashboard_kpis',
    'get_services_filtered',
    'get_staff_with_stats',
    'get_conversation_messages_paginated',
    'mark_conversation_as_read',
    'search_messages',
    'archive_old_messages'
  );
  
  -- Contar índices
  SELECT COUNT(*) INTO v_indexes_count
  FROM pg_indexes
  WHERE schemaname = 'public' 
    AND indexname LIKE 'idx_%';
  
  -- Tamaño de índices
  SELECT pg_size_pretty(SUM(pg_relation_size(indexrelid))) INTO v_indexes_size
  FROM pg_stat_user_indexes
  WHERE schemaname = 'public'
    AND indexrelname LIKE 'idx_%';
  
  -- Registros en daily_metrics
  SELECT COUNT(*) INTO v_metrics_count FROM daily_metrics;
  
  RAISE NOTICE 'Funciones creadas: %', v_functions_count;
  RAISE NOTICE 'Índices creados: %', v_indexes_count;
  RAISE NOTICE 'Tamaño total de índices: %', v_indexes_size;
  RAISE NOTICE 'Registros en daily_metrics: %', v_metrics_count;
END $$;

-- =====================================================
-- 9. RECOMENDACIONES
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'POST-VALIDACION COMPLETADA';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'RECOMENDACIONES:';
  RAISE NOTICE '';
  RAISE NOTICE '1. Actualizar el código del frontend para usar las nuevas funciones';
  RAISE NOTICE '2. Monitorear el rendimiento durante las próximas 24-48 horas';
  RAISE NOTICE '3. Ejecutar ANALYZE en las tablas principales:';
  RAISE NOTICE '   ANALYZE bookings; ANALYZE services; ANALYZE staff;';
  RAISE NOTICE '4. Si daily_metrics está vacío, ejecutar:';
  RAISE NOTICE '   SELECT initialize_daily_metrics();';
  RAISE NOTICE '5. Configurar monitoreo de uso de índices';
  RAISE NOTICE '';
END $$;

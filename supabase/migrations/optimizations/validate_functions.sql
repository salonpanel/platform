-- =====================================================
-- VALIDACIÓN DE FUNCIONES RPC OPTIMIZADAS
-- =====================================================
-- Este script verifica que todas las funciones RPC fueron creadas correctamente
-- Ejecutar después del deployment para validar

-- Verificar que las funciones existen
DO $$
DECLARE
  v_missing_functions TEXT[] := ARRAY[]::TEXT[];
  v_function_name TEXT;
BEGIN
  -- Lista de funciones que deben existir
  FOR v_function_name IN 
    SELECT unnest(ARRAY[
      'get_dashboard_kpis',
      'get_services_filtered',
      'get_staff_with_stats',
      'get_staff_schedule',
      'get_staff_availability',
      'get_conversation_messages_paginated',
      'get_recent_conversations',
      'mark_conversation_as_read',
      'initialize_daily_metrics',
      'update_daily_metrics_for_date'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = v_function_name
    ) THEN
      v_missing_functions := array_append(v_missing_functions, v_function_name);
    END IF;
  END LOOP;

  -- Reportar funciones faltantes
  IF array_length(v_missing_functions, 1) > 0 THEN
    RAISE NOTICE 'FUNCIONES FALTANTES: %', array_to_string(v_missing_functions, ', ');
  ELSE
    RAISE NOTICE 'TODAS LAS FUNCIONES RPC EXISTEN';
  END IF;
END $$;

-- Verificar que la tabla daily_metrics existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'daily_metrics'
  ) THEN
    RAISE NOTICE 'TABLA FALTANTE: daily_metrics';
  ELSE
    RAISE NOTICE 'TABLA daily_metrics EXISTE';
  END IF;
END $$;

-- Verificar índices compuestos críticos
DO $$
DECLARE
  v_missing_indexes TEXT[] := ARRAY[]::TEXT[];
  v_index_name TEXT;
BEGIN
  -- Lista de índices críticos
  FOR v_index_name IN 
    SELECT unnest(ARRAY[
      'idx_bookings_tenant_date_status',
      'idx_bookings_tenant_staff_date',
      'idx_services_tenant_active_category',
      'idx_staff_tenant_active',
      'idx_team_messages_conversation_created',
      'idx_daily_metrics_tenant_date'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname = v_index_name
    ) THEN
      v_missing_indexes := array_append(v_missing_indexes, v_index_name);
    END IF;
  END LOOP;

  -- Reportar índices faltantes
  IF array_length(v_missing_indexes, 1) > 0 THEN
    RAISE NOTICE 'INDICES FALTANTES: %', array_to_string(v_missing_indexes, ', ');
  ELSE
    RAISE NOTICE 'TODOS LOS INDICES CRITICOS EXISTEN';
  END IF;
END $$;

-- Test básico de get_dashboard_kpis
DO $$
DECLARE
  v_result JSONB;
  v_test_tenant_id UUID;
BEGIN
  -- Intentar obtener un tenant de prueba
  SELECT id INTO v_test_tenant_id FROM tenants LIMIT 1;
  
  IF v_test_tenant_id IS NOT NULL THEN
    -- Ejecutar función
    SELECT to_jsonb(r.*) INTO v_result 
    FROM get_dashboard_kpis(v_test_tenant_id) r
    LIMIT 1;
    
    IF v_result IS NOT NULL THEN
      RAISE NOTICE 'TEST get_dashboard_kpis: OK (retorna datos)';
    ELSE
      RAISE NOTICE 'TEST get_dashboard_kpis: ADVERTENCIA (sin datos pero no falla)';
    END IF;
  ELSE
    RAISE NOTICE 'TEST get_dashboard_kpis: OMITIDO (no hay tenants)';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'TEST get_dashboard_kpis: ERROR - %', SQLERRM;
END $$;

-- Test básico de get_services_filtered
DO $$
DECLARE
  v_result JSONB;
  v_test_tenant_id UUID;
BEGIN
  SELECT id INTO v_test_tenant_id FROM tenants LIMIT 1;
  
  IF v_test_tenant_id IS NOT NULL THEN
    SELECT to_jsonb(r.*) INTO v_result 
    FROM get_services_filtered(
      p_tenant_id := v_test_tenant_id,
      p_status := 'all',
      p_limit := 10
    ) r
    LIMIT 1;
    
    IF v_result IS NOT NULL THEN
      RAISE NOTICE 'TEST get_services_filtered: OK';
    ELSE
      RAISE NOTICE 'TEST get_services_filtered: ADVERTENCIA (sin datos)';
    END IF;
  ELSE
    RAISE NOTICE 'TEST get_services_filtered: OMITIDO (no hay tenants)';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'TEST get_services_filtered: ERROR - %', SQLERRM;
END $$;

-- Test básico de get_staff_with_stats
DO $$
DECLARE
  v_result JSONB;
  v_test_tenant_id UUID;
BEGIN
  SELECT id INTO v_test_tenant_id FROM tenants LIMIT 1;
  
  IF v_test_tenant_id IS NOT NULL THEN
    SELECT to_jsonb(r.*) INTO v_result 
    FROM get_staff_with_stats(
      p_tenant_id := v_test_tenant_id,
      p_include_inactive := false
    ) r
    LIMIT 1;
    
    IF v_result IS NOT NULL THEN
      RAISE NOTICE 'TEST get_staff_with_stats: OK';
    ELSE
      RAISE NOTICE 'TEST get_staff_with_stats: ADVERTENCIA (sin datos)';
    END IF;
  ELSE
    RAISE NOTICE 'TEST get_staff_with_stats: OMITIDO (no hay tenants)';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'TEST get_staff_with_stats: ERROR - %', SQLERRM;
END $$;

-- Test básico de get_conversation_messages_paginated
DO $$
DECLARE
  v_result JSONB;
  v_test_conversation_id UUID;
BEGIN
  SELECT id INTO v_test_conversation_id FROM team_conversations LIMIT 1;
  
  IF v_test_conversation_id IS NOT NULL THEN
    SELECT to_jsonb(r.*) INTO v_result 
    FROM get_conversation_messages_paginated(
      p_conversation_id := v_test_conversation_id,
      p_limit := 10
    ) r
    LIMIT 1;
    
    IF v_result IS NOT NULL THEN
      RAISE NOTICE 'TEST get_conversation_messages_paginated: OK';
    ELSE
      RAISE NOTICE 'TEST get_conversation_messages_paginated: ADVERTENCIA (sin datos)';
    END IF;
  ELSE
    RAISE NOTICE 'TEST get_conversation_messages_paginated: OMITIDO (no hay conversaciones)';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'TEST get_conversation_messages_paginated: ERROR - %', SQLERRM;
END $$;

-- Resumen final
DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'VALIDACION DE FUNCIONES RPC COMPLETADA';
  RAISE NOTICE 'Revisa los mensajes anteriores para detalles';
  RAISE NOTICE '================================================';
END $$;

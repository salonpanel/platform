-- ============================================================================
-- SEED DEMO: BookFast - Reservas (Bookings)
-- ============================================================================
-- Este script crea reservas históricas y futuras para el tenant BookFast
-- IMPORTANTE: Ejecutar DESPUÉS de seed_bookfast_demo.sql
--
-- Estrategia:
-- - Reservas históricas (últimos 6 meses): estados completados
-- - Reservas recientes (última semana): mix de estados
-- - Reservas futuras (próximas 2 semanas): confirmed
--
-- Se evitan solapamientos respetando:
-- - Horarios de staff_schedules
-- - Duraciones de servicios
-- - EXCLUDE constraint en bookings
-- ============================================================================

BEGIN;

-- ============================================================================
-- FUNCIÓN HELPER: Generar reservas respetando constraints
-- ============================================================================
-- Esta función genera reservas de forma segura verificando disponibilidad

CREATE OR REPLACE FUNCTION generate_bookfast_bookings()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID := 'bf000000-0000-0000-0000-000000000001';
  v_start_date DATE;
  v_current_date DATE;
  v_staff_ids UUID[];
  v_service_ids UUID[];
  v_customer_ids UUID[];
  v_booking_date DATE;
  v_booking_time TIME;
  v_staff_id UUID;
  v_service_id UUID;
  v_customer_id UUID;
  v_duration INT;
  v_starts_at TIMESTAMPTZ;
  v_ends_at TIMESTAMPTZ;
  v_status TEXT;
  v_day_of_week INT;
  v_count INT := 0;
  v_random_customer INT;
  v_random_service INT;
  v_random_staff INT;
BEGIN
  -- Obtener arrays de IDs
  SELECT array_agg(id) INTO v_staff_ids 
  FROM public.staff 
  WHERE tenant_id = v_tenant_id AND active = true;
  
  SELECT array_agg(id) INTO v_service_ids 
  FROM public.services 
  WHERE tenant_id = v_tenant_id AND active = true;
  
  SELECT array_agg(id) INTO v_customer_ids 
  FROM public.customers 
  WHERE tenant_id = v_tenant_id;
  
  -- Fecha de inicio: hace 6 meses
  v_start_date := CURRENT_DATE - INTERVAL '6 months';
  v_current_date := v_start_date;
  
  -- Generar reservas día por día
  WHILE v_current_date <= CURRENT_DATE + INTERVAL '14 days' LOOP
    v_day_of_week := EXTRACT(DOW FROM v_current_date)::INT;
    
    -- Convertir domingo (0) a formato PostgreSQL (6)
    IF v_day_of_week = 0 THEN
      v_day_of_week := 6;
    ELSE
      v_day_of_week := v_day_of_week - 1;
    END IF;
    
    -- Para cada staff que trabaja este día
    FOR v_staff_id IN 
      SELECT DISTINCT staff_id 
      FROM public.staff_schedules 
      WHERE tenant_id = v_tenant_id 
        AND day_of_week = v_day_of_week 
        AND is_active = true
    LOOP
      -- Obtener horario del staff para este día
      FOR v_booking_time IN 
        SELECT start_time + (interval '30 minutes' * gs) as slot_time
        FROM public.staff_schedules ss,
             generate_series(0, EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 1800 - 1) gs
        WHERE ss.tenant_id = v_tenant_id
          AND ss.staff_id = v_staff_id
          AND ss.day_of_week = v_day_of_week
          AND ss.is_active = true
        LIMIT 1
      LOOP
        -- Probabilidad de reserva: 60% en días pasados, 40% en futuros
        IF (v_current_date < CURRENT_DATE AND random() < 0.6) 
           OR (v_current_date >= CURRENT_DATE AND random() < 0.4) THEN
          
          -- Seleccionar servicio aleatorio que este staff puede hacer
          SELECT s.id, s.duration_min INTO v_service_id, v_duration
          FROM public.services s
          JOIN public.staff_provides_services sps ON sps.service_id = s.id
          WHERE sps.staff_id = v_staff_id
            AND s.tenant_id = v_tenant_id
            AND s.active = true
          ORDER BY random()
          LIMIT 1;
          
          -- Seleccionar cliente aleatorio
          v_random_customer := (random() * (array_length(v_customer_ids, 1) - 1))::INT + 1;
          v_customer_id := v_customer_ids[v_random_customer];
          
          -- Calcular timestamps
          v_starts_at := (v_current_date || ' ' || v_booking_time)::TIMESTAMPTZ;
          v_ends_at := v_starts_at + (v_duration || ' minutes')::INTERVAL;
          
          -- Determinar estado según fecha
          IF v_current_date < CURRENT_DATE - INTERVAL '1 day' THEN
            -- Reservas pasadas: mayoría completadas, algunas cancelled/no_show
            v_status := CASE 
              WHEN random() < 0.85 THEN 'completed'
              WHEN random() < 0.93 THEN 'confirmed'
              WHEN random() < 0.97 THEN 'cancelled'
              ELSE 'no_show'
            END;
          ELSIF v_current_date < CURRENT_DATE THEN
            -- Ayer y hoy: mayoría confirmed
            v_status := CASE 
              WHEN random() < 0.9 THEN 'confirmed'
              ELSE 'completed'
            END;
          ELSE
            -- Futuras: todas confirmed
            v_status := 'confirmed';
          END IF;
          
          -- Intentar insertar (puede fallar por EXCLUDE constraint, es OK)
          BEGIN
            INSERT INTO public.bookings (
              tenant_id,
              customer_id,
              staff_id,
              service_id,
              starts_at,
              ends_at,
              status,
              duration_min,
              is_highlighted,
              internal_notes,
              created_at
            ) VALUES (
              v_tenant_id,
              v_customer_id,
              v_staff_id,
              v_service_id,
              v_starts_at,
              v_ends_at,
              v_status,
              v_duration,
              random() < 0.05, -- 5% destacadas
              CASE WHEN random() < 0.2 THEN 'Cliente recurrente' ELSE NULL END,
              v_starts_at - INTERVAL '2 days' -- Reservada 2 días antes
            );
            
            v_count := v_count + 1;
            
          EXCEPTION 
            WHEN exclusion_violation THEN
              -- Solapamiento detectado, continuar con siguiente slot
              NULL;
            WHEN OTHERS THEN
              -- Otro error, registrar y continuar
              RAISE NOTICE 'Error insertando booking: %', SQLERRM;
          END;
          
        END IF;
      END LOOP;
    END LOOP;
    
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;
  
  RAISE NOTICE 'Reservas creadas: %', v_count;
END;
$$;

-- ============================================================================
-- EJECUTAR GENERACIÓN DE RESERVAS
-- ============================================================================

SELECT generate_bookfast_bookings();

-- ============================================================================
-- ACTUALIZAR ESTADÍSTICAS DE CLIENTES
-- ============================================================================
-- Actualizar visits_count, total_spent_cents, last_booking_at para cada cliente

UPDATE public.customers c SET
  visits_count = (
    SELECT COUNT(*) 
    FROM public.bookings b 
    WHERE b.customer_id = c.id 
      AND b.status IN ('completed', 'confirmed')
  ),
  last_booking_at = (
    SELECT MAX(b.starts_at) 
    FROM public.bookings b 
    WHERE b.customer_id = c.id
  ),
  total_spent_cents = (
    SELECT COALESCE(SUM(s.price_cents), 0)
    FROM public.bookings b
    JOIN public.services s ON b.service_id = s.id
    WHERE b.customer_id = c.id 
      AND b.status = 'completed'
  ),
  no_show_count = (
    SELECT COUNT(*)
    FROM public.bookings b
    WHERE b.customer_id = c.id
      AND b.status = 'no_show'
  ),
  last_no_show_at = (
    SELECT MAX(b.starts_at)
    FROM public.bookings b
    WHERE b.customer_id = c.id
      AND b.status = 'no_show'
  )
WHERE c.tenant_id = 'bf000000-0000-0000-0000-000000000001';

-- Marcar como VIP a clientes con más de 10 visitas o gasto > 200€
UPDATE public.customers
SET is_vip = true
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'
  AND (visits_count >= 10 OR total_spent_cents >= 20000);

-- ============================================================================
-- CREAR ALGUNAS RESERVAS FUTURAS MANUALMENTE (PARA DEMOS)
-- ============================================================================
-- Estas son reservas específicas para mostrar en demos de agenda

-- Reserva destacada para mañana
DO $$
DECLARE
  v_tomorrow TIMESTAMP := (CURRENT_DATE + INTERVAL '1 day' + TIME '10:00');
BEGIN
  INSERT INTO public.bookings (
    tenant_id,
    customer_id,
    staff_id,
    service_id,
    starts_at,
    ends_at,
    status,
    duration_min,
    is_highlighted,
    internal_notes,
    client_message
  ) VALUES (
    'bf000000-0000-0000-0000-000000000001',
    'bf000003-cust-0000-0000-000000000001', -- Alberto García (VIP)
    'bf000002-staf-0000-0000-000000000001', -- Carlos
    'bf000001-serv-0000-0000-000000000007', -- Pack Premium
    v_tomorrow,
    v_tomorrow + INTERVAL '75 minutes',
    'confirmed',
    75,
    true,
    'Cliente VIP - Máxima prioridad',
    'Gracias por tu confianza, Alberto. ¡Te esperamos mañana!'
  )
  ON CONFLICT DO NOTHING;
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE NOTICE 'Reserva demo ya existe o hay solapamiento';
END;
$$;

-- Reserva para pasado mañana
DO $$
DECLARE
  v_day_after TIMESTAMP := (CURRENT_DATE + INTERVAL '2 days' + TIME '15:00');
BEGIN
  INSERT INTO public.bookings (
    tenant_id,
    customer_id,
    staff_id,
    service_id,
    starts_at,
    ends_at,
    status,
    duration_min,
    is_highlighted
  ) VALUES (
    'bf000000-0000-0000-0000-000000000001',
    'bf000003-cust-0000-0000-000000000002', -- Roberto Sánchez (VIP)
    'bf000002-staf-0000-0000-000000000002', -- Miguel
    'bf000001-serv-0000-0000-000000000006', -- Corte + Barba
    v_day_after,
    v_day_after + INTERVAL '50 minutes',
    'confirmed',
    50,
    true
  )
  ON CONFLICT DO NOTHING;
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE NOTICE 'Reserva demo ya existe o hay solapamiento';
END;
$$;

-- ============================================================================
-- LIMPIAR FUNCIÓN HELPER
-- ============================================================================
DROP FUNCTION IF EXISTS generate_bookfast_bookings();

COMMIT;

-- ============================================================================
-- VALIDACIONES POST-INSERCIÓN
-- ============================================================================
-- Ejecutar estas queries para verificar que todo está correcto:

-- 1. Total de reservas creadas
-- SELECT COUNT(*) as total_bookings 
-- FROM public.bookings 
-- WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';

-- 2. Distribución por estado
-- SELECT status, COUNT(*) as count
-- FROM public.bookings 
-- WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'
-- GROUP BY status
-- ORDER BY count DESC;

-- 3. Reservas por barbero
-- SELECT s.display_name, COUNT(b.id) as total_bookings
-- FROM public.staff s
-- LEFT JOIN public.bookings b ON b.staff_id = s.id
-- WHERE s.tenant_id = 'bf000000-0000-0000-0000-000000000001'
-- GROUP BY s.id, s.display_name
-- ORDER BY total_bookings DESC;

-- 4. Distribución temporal
-- SELECT 
--   DATE_TRUNC('month', starts_at) as month,
--   COUNT(*) as bookings
-- FROM public.bookings
-- WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'
-- GROUP BY month
-- ORDER BY month;

-- 5. Clientes VIP generados
-- SELECT name, visits_count, total_spent_cents / 100.0 as total_spent_eur, is_vip
-- FROM public.customers
-- WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'
--   AND is_vip = true
-- ORDER BY visits_count DESC;

-- 6. Próximas reservas (agenda activa)
-- SELECT 
--   b.starts_at,
--   s.display_name as barbero,
--   c.name as cliente,
--   sv.name as servicio,
--   b.status,
--   b.is_highlighted
-- FROM public.bookings b
-- JOIN public.staff s ON s.id = b.staff_id
-- JOIN public.customers c ON c.id = b.customer_id
-- JOIN public.services sv ON sv.id = b.service_id
-- WHERE b.tenant_id = 'bf000000-0000-0000-0000-000000000001'
--   AND b.starts_at >= CURRENT_TIMESTAMP
-- ORDER BY b.starts_at
-- LIMIT 20;

-- ============================================================================
-- VERIFICAR INTEGRIDAD
-- ============================================================================

-- Verificar que no hay solapamientos (no debería retornar filas)
-- SELECT b1.id, b1.starts_at, b1.ends_at, b2.id, b2.starts_at, b2.ends_at
-- FROM public.bookings b1
-- JOIN public.bookings b2 ON b1.staff_id = b2.staff_id AND b1.id != b2.id
-- WHERE b1.tenant_id = 'bf000000-0000-0000-0000-000000000001'
--   AND b1.slot && b2.slot;

-- Si la query anterior retorna filas, hay un problema con EXCLUDE constraint

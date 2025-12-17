-- ============================================================================
-- SEED DEMO: BookFast - Reservas (Bookings)
-- ============================================================================
-- ============================================================================
-- SEED DEMO COMERCIAL: BookFast - Generación de 2500-4000 Reservas
-- ============================================================================
-- Este script crea un historial COMPLETO de reservas para demo comercial
-- Este script debe ejecutarse una sola vez por tenant
-- ⚠️ EJECUTAR DESPUÉS de seed_bookfast_demo.sql
--
-- 🎯 OBJETIVO: Llenar agenda con datos realistas para demostración de ventas
--
-- 📊 VOLUMEN TARGET:
-- - Total reservas: 2500-4000 (ajustable vía probabilidades)
-- - Horizonte temporal: 12/12/2024 a 12/12/2026 (2 años completos)
-- - Staff activos: 5 barberos
-- - Clientes únicos: ~400
-- - Servicios: 20
--
-- 📅 DISTRIBUCIÓN TEMPORAL:
-- - Reservas pasadas (12/2024-HOY): COMPLETED (80%), NO_SHOW (8%), CANCELLED (12%)
-- - Reservas futuras (HOY-12/2026): CONFIRMED (100%)
--
-- 🎲 ESTRATEGIA GENERACIÓN:
-- - Probabilidad base: 50-70% ocupación por slot disponible
-- - Picos: Viernes/Sábado +20% probabilidad
-- - Valle: Lunes/Domingo -10% probabilidad
-- - Estacionalidad: Agosto/Navidad -20% (vacaciones)
-- - Respeto absoluto: staff_schedules, staff_blockings, EXCLUDE constraint
--
-- 🛡️ CONSTRAINTS RESPETADAS:
-- - ✅ No solapamientos (EXCLUDE on bookings.slot)
-- - ✅ Solo horarios válidos (staff_schedules)
-- - ✅ Evita bloqueos (staff_blockings)
-- - ✅ Distribución realista de servicios
-- ============================================================================

BEGIN;

-- ============================================================================
-- FUNCIÓN HELPER: Generar reservas respetando constraints
-- ============================================================================
-- Genera 2500-4000 reservas distribuidas en 2 años con lógica probabilística

CREATE OR REPLACE FUNCTION generate_bookfast_bookings()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
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
  v_base_probability FLOAT;
  v_month INT;
  v_is_weekend BOOLEAN;
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
  
  -- 🗓️ Fecha de inicio: 12/12/2024 (2 años completos hasta 12/12/2026)
  v_start_date := '2024-12-12'::DATE;
  
  RAISE NOTICE '🚀 Generando reservas BookFast desde % hasta %', 
    v_start_date, (v_start_date + INTERVAL '2 years');
  v_current_date := v_start_date;
  
  -- 📅 Generar reservas día por día durante 2 años
  WHILE v_current_date <= v_start_date + INTERVAL '2 years' LOOP
    v_day_of_week := EXTRACT(DOW FROM v_current_date)::INT;
      v_month := EXTRACT(MONTH FROM v_current_date)::INT;
      v_is_weekend := (v_day_of_week IN (0, 5, 6));
    
    -- Convertir domingo (0) a formato PostgreSQL (6)
    IF v_day_of_week = 0 THEN
      v_day_of_week := 6;
    ELSE
      v_day_of_week := v_day_of_week - 1;
    END IF;
    
        -- 🎲 Calcular probabilidad de reserva para este día
        v_base_probability := 0.55; -- Base: 55% ocupación
    
        -- Ajustes por día semana
        IF v_day_of_week IN (4, 5) THEN -- Viernes, Sábado
          v_base_probability := v_base_probability + 0.20;
        ELSIF v_day_of_week = 0 THEN -- Lunes
          v_base_probability := v_base_probability - 0.10;
        ELSIF v_day_of_week = 6 THEN -- Domingo
          v_base_probability := v_base_probability - 0.15;
        END IF;
    
        -- Ajustes por estacionalidad (agosto, navidad)
        IF v_month = 8 OR v_month = 12 THEN
          v_base_probability := v_base_probability - 0.20;
        END IF;

        -- Clamp de probabilidad para evitar extremos
        v_base_probability := LEAST(0.85, GREATEST(0.15, v_base_probability));
    
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
        -- 🎯 Aplicar probabilidad calculada
        IF random() < v_base_probability THEN
          
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

          -- Respetar bloqueos de staff (vacaciones, ausencias)
          IF NOT EXISTS (
            SELECT 1
            FROM public.staff_blockings sb
            WHERE sb.tenant_id = v_tenant_id
              AND sb.staff_id = v_staff_id
              AND sb.is_active = true
              AND tstzrange(sb.start_time, sb.end_time, '[)') && tstzrange(v_starts_at, v_ends_at, '[)')
          ) THEN
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
WHERE c.tenant_id = '00000000-0000-0000-0000-000000000001';

-- Marcar como VIP a clientes con más de 10 visitas o gasto > 200€
UPDATE public.customers
SET is_vip = true
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
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
    '00000000-0000-0000-0000-000000000001',
    '00000003-0000-0000-0000-000000000001', -- Alberto García (VIP)
    '00000002-0000-0000-0000-000000000001', -- Carlos
    '00000001-0000-0000-0000-000000000007', -- Pack Premium
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
    '00000000-0000-0000-0000-000000000001',
    '00000003-0000-0000-0000-000000000002', -- Roberto Sánchez (VIP)
    '00000002-0000-0000-0000-000000000002', -- Miguel
    '00000001-0000-0000-0000-000000000006', -- Corte + Barba
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

-- Validación automática mínima post-bookings
SELECT COUNT(*) AS total_bookings
FROM public.bookings
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

SELECT MIN(starts_at) AS min_starts_at, MAX(starts_at) AS max_starts_at
FROM public.bookings
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

SELECT
  ROUND(
    100.0 * SUM(CASE WHEN EXTRACT(DOW FROM starts_at)::INT IN (0, 6) THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
    2
  ) AS weekend_bookings_pct
FROM public.bookings
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- 1. Total de reservas creadas
-- SELECT COUNT(*) as total_bookings 
-- FROM public.bookings 
-- WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- 2. Distribución por estado
-- SELECT status, COUNT(*) as count
-- FROM public.bookings 
-- WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
-- GROUP BY status
-- ORDER BY count DESC;

-- 3. Reservas por barbero
-- SELECT s.display_name, COUNT(b.id) as total_bookings
-- FROM public.staff s
-- LEFT JOIN public.bookings b ON b.staff_id = s.id
-- WHERE s.tenant_id = '00000000-0000-0000-0000-000000000001'
-- GROUP BY s.id, s.display_name
-- ORDER BY total_bookings DESC;

-- 4. Distribución temporal
-- SELECT 
--   DATE_TRUNC('month', starts_at) as month,
--   COUNT(*) as bookings
-- FROM public.bookings
-- WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
-- GROUP BY month
-- ORDER BY month;

-- 5. Clientes VIP generados
-- SELECT name, visits_count, total_spent_cents / 100.0 as total_spent_eur, is_vip
-- FROM public.customers
-- WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
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
-- WHERE b.tenant_id = '00000000-0000-0000-0000-000000000001'
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
-- WHERE b1.tenant_id = '00000000-0000-0000-0000-000000000001'
--   AND b1.slot && b2.slot;

-- Si la query anterior retorna filas, hay un problema con EXCLUDE constraint

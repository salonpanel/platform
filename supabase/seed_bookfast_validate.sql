-- ============================================================================
-- VALIDACIONES COMPLETAS: Tenant BookFast
-- ============================================================================
-- Este script ejecuta todas las validaciones necesarias para verificar
-- que el seed de BookFast se ejecutó correctamente.
--
-- INSTRUCCIONES:
-- 1. Ejecutar DESPUÉS de haber corrido los 3 scripts de seed
-- 2. Revisar los resultados de cada sección
-- 3. Si alguna validación falla, ver la sección de troubleshooting
-- ============================================================================

-- ============================================================================
-- CONFIGURACIÓN
-- ============================================================================
\set tenant_id 'bf000000-0000-0000-0000-000000000001'

-- ============================================================================
-- SECCIÓN 1: VALIDACIONES BÁSICAS DE ESTRUCTURA
-- ============================================================================

\echo '\n========================================='
\echo '✅ SECCIÓN 1: ESTRUCTURA BÁSICA'
\echo '=========================================\n'

-- 1.1 Verificar Tenant
\echo '📋 1.1 Verificar Tenant BookFast...'
SELECT 
  id,
  name,
  slug,
  timezone,
  contact_email,
  created_at
FROM public.tenants 
WHERE id = 'bf000000-0000-0000-0000-000000000001';

-- Resultado esperado: 1 fila con name = 'BookFast Barbería'

-- 1.2 Verificar Tenant Settings
\echo '\n📋 1.2 Verificar Configuración del Tenant...'
SELECT 
  no_show_protection_enabled,
  no_show_protection_mode,
  no_show_protection_percentage,
  no_show_cancellation_hours,
  business_open_time,
  business_close_time
FROM public.tenant_settings 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';

-- Resultado esperado: 1 fila con configuración definida

-- ============================================================================
-- SECCIÓN 2: VALIDACIONES DE USUARIOS Y PERMISOS
-- ============================================================================

\echo '\n========================================='
\echo '✅ SECCIÓN 2: USUARIOS Y PERMISOS'
\echo '=========================================\n'

-- 2.1 Verificar Memberships
\echo '👥 2.1 Verificar Memberships (Owners)...'
SELECT 
  m.role,
  u.email,
  u.raw_user_meta_data->>'full_name' as full_name,
  m.created_at
FROM public.memberships m
JOIN auth.users u ON u.id = m.user_id
WHERE m.tenant_id = 'bf000000-0000-0000-0000-000000000001'
ORDER BY m.created_at;

-- Resultado esperado: 2 filas con role = 'owner'

-- 2.2 Verificar Permisos
\echo '\n👥 2.2 Verificar Permisos de Usuarios...'
SELECT 
  up.user_id,
  u.email,
  up.permissions,
  up.created_at
FROM public.user_permissions up
JOIN auth.users u ON u.id = up.user_id
WHERE up.tenant_id = 'bf000000-0000-0000-0000-000000000001';

-- Resultado esperado: 2 filas con permisos completos (todos en true)

-- 2.3 Verificar app.current_tenant_id()
\echo '\n👥 2.3 Verificar Contexto Multi-Tenant...'
SELECT app.current_tenant_id() as current_tenant;

-- Resultado esperado: 'bf000000-0000-0000-0000-000000000001' 
-- (solo si ejecutas como uno de los owners)

-- ============================================================================
-- SECCIÓN 3: VALIDACIONES DE SERVICIOS
-- ============================================================================

\echo '\n========================================='
\echo '✅ SECCIÓN 3: SERVICIOS'
\echo '=========================================\n'

-- 3.1 Contar servicios
\echo '💈 3.1 Total de Servicios...'
SELECT COUNT(*) as total_servicios 
FROM public.services 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';

-- Resultado esperado: 8

-- 3.2 Listar servicios por categoría
\echo '\n💈 3.2 Servicios por Categoría...'
SELECT 
  category,
  COUNT(*) as count,
  ARRAY_AGG(name ORDER BY name) as servicios
FROM public.services
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'
  AND active = true
GROUP BY category
ORDER BY category;

-- Resultado esperado:
-- Barba: 2
-- Combo: 2
-- Corte: 3
-- Otros: 1

-- 3.3 Verificar precios y duraciones
\echo '\n💈 3.3 Resumen de Precios y Duraciones...'
SELECT 
  name,
  duration_min,
  price_cents / 100.0 as price_eur,
  category
FROM public.services
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'
ORDER BY price_cents DESC;

-- ============================================================================
-- SECCIÓN 4: VALIDACIONES DE STAFF
-- ============================================================================

\echo '\n========================================='
\echo '✅ SECCIÓN 4: STAFF (BARBEROS)'
\echo '=========================================\n'

-- 4.1 Contar barberos
\echo '👨‍🦲 4.1 Total de Barberos...'
SELECT COUNT(*) as total_barberos 
FROM public.staff 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'
  AND active = true;

-- Resultado esperado: 4

-- 4.2 Listar barberos con horarios
\echo '\n👨‍🦲 4.2 Barberos y Días de Trabajo...'
SELECT 
  s.display_name,
  s.role,
  COUNT(ss.id) as dias_trabajo,
  ARRAY_AGG(
    CASE ss.day_of_week
      WHEN 0 THEN 'Lun'
      WHEN 1 THEN 'Mar'
      WHEN 2 THEN 'Mié'
      WHEN 3 THEN 'Jue'
      WHEN 4 THEN 'Vie'
      WHEN 5 THEN 'Sáb'
      WHEN 6 THEN 'Dom'
    END ORDER BY ss.day_of_week
  ) as dias
FROM public.staff s
JOIN public.staff_schedules ss ON ss.staff_id = s.id
WHERE s.tenant_id = 'bf000000-0000-0000-0000-000000000001'
GROUP BY s.id, s.display_name, s.role
ORDER BY s.display_name;

-- Resultado esperado:
-- Carlos: 6 días
-- David: 5 días
-- Javi: 5 días
-- Miguel: 5 días

-- 4.3 Servicios por barbero
\echo '\n👨‍🦲 4.3 Servicios Habilitados por Barbero...'
SELECT 
  st.display_name,
  COUNT(sps.service_id) as total_servicios,
  STRING_AGG(s.name, ', ' ORDER BY s.name) as servicios
FROM public.staff st
LEFT JOIN public.staff_provides_services sps ON sps.staff_id = st.id
LEFT JOIN public.services s ON s.id = sps.service_id
WHERE st.tenant_id = 'bf000000-0000-0000-0000-000000000001'
GROUP BY st.id, st.display_name
ORDER BY total_servicios DESC;

-- Resultado esperado:
-- Carlos: 7 servicios
-- Miguel: 5 servicios
-- Javi: 5 servicios
-- David: 4 servicios

-- ============================================================================
-- SECCIÓN 5: VALIDACIONES DE CLIENTES
-- ============================================================================

\echo '\n========================================='
\echo '✅ SECCIÓN 5: CLIENTES'
\echo '=========================================\n'

-- 5.1 Contar clientes
\echo '🧑 5.1 Total de Clientes...'
SELECT COUNT(*) as total_clientes 
FROM public.customers 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';

-- Resultado esperado: 30

-- 5.2 Clientes VIP
\echo '\n🧑 5.2 Clientes VIP...'
SELECT 
  name,
  visits_count,
  ROUND(total_spent_cents / 100.0, 2) as total_spent_eur,
  tags,
  is_vip
FROM public.customers
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'
  AND is_vip = true
ORDER BY visits_count DESC;

-- Resultado esperado: 3-8 clientes VIP

-- 5.3 Distribución de clientes por tags
\echo '\n🧑 5.3 Distribución por Tags...'
SELECT 
  UNNEST(tags) as tag,
  COUNT(*) as count
FROM public.customers
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'
GROUP BY tag
ORDER BY count DESC;

-- 5.4 Clientes con email vs sin email
\echo '\n🧑 5.4 Clientes con/sin Email...'
SELECT 
  CASE 
    WHEN email IS NOT NULL THEN 'Con Email'
    ELSE 'Sin Email'
  END as tipo,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM public.customers
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'
GROUP BY tipo;

-- ============================================================================
-- SECCIÓN 6: VALIDACIONES DE RESERVAS
-- ============================================================================

\echo '\n========================================='
\echo '✅ SECCIÓN 6: RESERVAS (BOOKINGS)'
\echo '=========================================\n'

-- 6.1 Total de reservas
\echo '📅 6.1 Total de Reservas...'
SELECT COUNT(*) as total_reservas 
FROM public.bookings 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';

-- Resultado esperado: 500-800

-- 6.2 Distribución por estado
\echo '\n📅 6.2 Distribución por Estado...'
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM public.bookings 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'
GROUP BY status
ORDER BY count DESC;

-- Resultado esperado:
-- completed: ~60-70%
-- confirmed: ~20-25%
-- cancelled: ~5-10%
-- no_show: ~2-5%

-- 6.3 Reservas por barbero
\echo '\n📅 6.3 Reservas por Barbero...'
SELECT 
  s.display_name,
  COUNT(b.id) as total_bookings,
  COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END) as confirmed,
  COUNT(CASE WHEN b.status = 'cancelled' THEN 1 END) as cancelled,
  COUNT(CASE WHEN b.status = 'no_show' THEN 1 END) as no_show
FROM public.staff s
LEFT JOIN public.bookings b ON b.staff_id = s.id
WHERE s.tenant_id = 'bf000000-0000-0000-0000-000000000001'
GROUP BY s.id, s.display_name
ORDER BY total_bookings DESC;

-- 6.4 Distribución temporal
\echo '\n📅 6.4 Distribución Temporal (por mes)...'
SELECT 
  TO_CHAR(DATE_TRUNC('month', starts_at), 'YYYY-MM') as month,
  COUNT(*) as bookings,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed
FROM public.bookings
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'
GROUP BY month
ORDER BY month;

-- Resultado esperado: ~80-150 reservas por mes

-- 6.5 Próximas reservas
\echo '\n📅 6.5 Próximas 10 Reservas...'
SELECT 
  TO_CHAR(b.starts_at, 'DD/MM/YYYY HH24:MI') as fecha_hora,
  s.display_name as barbero,
  c.name as cliente,
  sv.name as servicio,
  b.status,
  CASE WHEN b.is_highlighted THEN '⭐' ELSE '' END as destacada
FROM public.bookings b
JOIN public.staff s ON s.id = b.staff_id
JOIN public.customers c ON c.id = b.customer_id
JOIN public.services sv ON sv.id = b.service_id
WHERE b.tenant_id = 'bf000000-0000-0000-0000-000000000001'
  AND b.starts_at >= CURRENT_TIMESTAMP
ORDER BY b.starts_at
LIMIT 10;

-- ============================================================================
-- SECCIÓN 7: VALIDACIONES DE INTEGRIDAD
-- ============================================================================

\echo '\n========================================='
\echo '✅ SECCIÓN 7: INTEGRIDAD DE DATOS'
\echo '=========================================\n'

-- 7.1 Verificar NO solapamientos
\echo '🔍 7.1 Verificar No Solapamientos...'
SELECT 
  COUNT(*) as solapamientos_detectados,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ OK - Sin solapamientos'
    ELSE '❌ ERROR - Hay solapamientos!'
  END as resultado
FROM (
  SELECT b1.id, b2.id
  FROM public.bookings b1
  JOIN public.bookings b2 ON b1.staff_id = b2.staff_id AND b1.id < b2.id
  WHERE b1.tenant_id = 'bf000000-0000-0000-0000-000000000001'
    AND b1.slot && b2.slot
) overlaps;

-- Resultado esperado: 0 solapamientos

-- 7.2 Verificar reservas fuera de horario de staff
\echo '\n🔍 7.2 Verificar Reservas Dentro de Horarios...'
SELECT 
  COUNT(*) as reservas_fuera_horario,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ OK - Todas dentro de horario'
    ELSE '⚠️  WARNING - Algunas fuera de horario'
  END as resultado
FROM public.bookings b
LEFT JOIN public.staff_schedules ss ON 
  ss.staff_id = b.staff_id 
  AND ss.day_of_week = (EXTRACT(DOW FROM b.starts_at)::INT + 6) % 7
  AND b.starts_at::TIME >= ss.start_time
  AND b.ends_at::TIME <= ss.end_time
WHERE b.tenant_id = 'bf000000-0000-0000-0000-000000000001'
  AND ss.id IS NULL;

-- Resultado esperado: 0-5% (algunas pueden estar en días no laborables, es OK)

-- 7.3 Verificar foreign keys válidas
\echo '\n🔍 7.3 Verificar Integridad de Foreign Keys...'
SELECT 
  'Bookings sin staff' as check_type,
  COUNT(*) as count
FROM public.bookings b
LEFT JOIN public.staff s ON s.id = b.staff_id
WHERE b.tenant_id = 'bf000000-0000-0000-0000-000000000001'
  AND s.id IS NULL

UNION ALL

SELECT 
  'Bookings sin customer' as check_type,
  COUNT(*) as count
FROM public.bookings b
LEFT JOIN public.customers c ON c.id = b.customer_id
WHERE b.tenant_id = 'bf000000-0000-0000-0000-000000000001'
  AND c.id IS NULL

UNION ALL

SELECT 
  'Bookings sin service' as check_type,
  COUNT(*) as count
FROM public.bookings b
LEFT JOIN public.services sv ON sv.id = b.service_id
WHERE b.tenant_id = 'bf000000-0000-0000-0000-000000000001'
  AND sv.id IS NULL;

-- Resultado esperado: 0 en todos los casos

-- ============================================================================
-- SECCIÓN 8: MÉTRICAS Y ESTADÍSTICAS
-- ============================================================================

\echo '\n========================================='
\echo '✅ SECCIÓN 8: MÉTRICAS Y ESTADÍSTICAS'
\echo '=========================================\n'

-- 8.1 Ingresos totales
\echo '💰 8.1 Ingresos Totales...'
SELECT 
  COUNT(*) as reservas_completadas,
  ROUND(SUM(s.price_cents) / 100.0, 2) as ingresos_totales_eur,
  ROUND(AVG(s.price_cents) / 100.0, 2) as ticket_medio_eur,
  ROUND(MIN(s.price_cents) / 100.0, 2) as min_eur,
  ROUND(MAX(s.price_cents) / 100.0, 2) as max_eur
FROM public.bookings b
JOIN public.services s ON s.id = b.service_id
WHERE b.tenant_id = 'bf000000-0000-0000-0000-000000000001'
  AND b.status = 'completed';

-- Resultado esperado: 
-- Ingresos: 15.000€ - 25.000€
-- Ticket medio: 20€ - 30€

-- 8.2 Servicios más vendidos
\echo '\n💰 8.2 Servicios Más Vendidos...'
SELECT 
  s.name,
  COUNT(b.id) as veces_vendido,
  ROUND(SUM(s.price_cents) / 100.0, 2) as ingresos_eur,
  ROUND(AVG(s.price_cents) / 100.0, 2) as precio_medio_eur
FROM public.services s
LEFT JOIN public.bookings b ON b.service_id = s.id AND b.status = 'completed'
WHERE s.tenant_id = 'bf000000-0000-0000-0000-000000000001'
GROUP BY s.id, s.name
ORDER BY veces_vendido DESC
LIMIT 5;

-- 8.3 Clientes top (mayor gasto)
\echo '\n💰 8.3 Top 5 Clientes por Gasto...'
SELECT 
  c.name,
  c.visits_count,
  ROUND(c.total_spent_cents / 100.0, 2) as total_gastado_eur,
  c.is_vip
FROM public.customers c
WHERE c.tenant_id = 'bf000000-0000-0000-0000-000000000001'
ORDER BY c.total_spent_cents DESC
LIMIT 5;

-- 8.4 Tasa de no-show
\echo '\n💰 8.4 Tasa de No-Show...'
SELECT 
  COUNT(*) FILTER (WHERE status = 'no_show') as no_shows,
  COUNT(*) FILTER (WHERE status != 'cancelled') as total_reservas,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'no_show') * 100.0 / 
    NULLIF(COUNT(*) FILTER (WHERE status != 'cancelled'), 0),
    2
  ) as tasa_no_show_percent
FROM public.bookings
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';

-- Resultado esperado: 2-5%

-- 8.5 Tasa de cancelación
\echo '\n💰 8.5 Tasa de Cancelación...'
SELECT 
  COUNT(*) FILTER (WHERE status = 'cancelled') as canceladas,
  COUNT(*) as total_reservas,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'cancelled') * 100.0 / 
    NULLIF(COUNT(*), 0),
    2
  ) as tasa_cancelacion_percent
FROM public.bookings
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';

-- Resultado esperado: 5-10%

-- ============================================================================
-- SECCIÓN 9: RESUMEN FINAL
-- ============================================================================

\echo '\n========================================='
\echo '📊 RESUMEN FINAL'
\echo '=========================================\n'

SELECT 
  '✅ Tenant' as componente,
  1 as esperado,
  COUNT(*) as real,
  CASE WHEN COUNT(*) = 1 THEN '✅' ELSE '❌' END as status
FROM public.tenants 
WHERE id = 'bf000000-0000-0000-0000-000000000001'

UNION ALL

SELECT 
  '✅ Owners (Memberships)' as componente,
  2 as esperado,
  COUNT(*) as real,
  CASE WHEN COUNT(*) >= 1 THEN '✅' ELSE '❌' END as status
FROM public.memberships 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001' AND role = 'owner'

UNION ALL

SELECT 
  '✅ Servicios' as componente,
  8 as esperado,
  COUNT(*) as real,
  CASE WHEN COUNT(*) = 8 THEN '✅' ELSE '❌' END as status
FROM public.services 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'

UNION ALL

SELECT 
  '✅ Staff' as componente,
  4 as esperado,
  COUNT(*) as real,
  CASE WHEN COUNT(*) = 4 THEN '✅' ELSE '❌' END as status
FROM public.staff 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'

UNION ALL

SELECT 
  '✅ Clientes' as componente,
  30 as esperado,
  COUNT(*) as real,
  CASE WHEN COUNT(*) = 30 THEN '✅' ELSE '❌' END as status
FROM public.customers 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'

UNION ALL

SELECT 
  '✅ Reservas' as componente,
  500 as esperado,
  COUNT(*) as real,
  CASE WHEN COUNT(*) >= 400 THEN '✅' ELSE '⚠️' END as status
FROM public.bookings 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';

\echo '\n========================================='
\echo '✨ VALIDACIÓN COMPLETA FINALIZADA'
\echo '=========================================\n'
\echo 'Si todos los checks muestran ✅, el seed se ejecutó correctamente.'
\echo 'Si alguno muestra ❌, revisar la sección de troubleshooting en el README.'
\echo '\n'

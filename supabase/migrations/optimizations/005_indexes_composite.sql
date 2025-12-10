-- =====================================================
-- ÍNDICES COMPUESTOS PARA OPTIMIZACIÓN
-- =====================================================
-- Descripción: Índices estratégicos para acelerar queries comunes
-- Beneficio: Mejora velocidad de búsquedas en 10-100x
-- Impacto: Reduce tiempo de respuesta de queries pesadas
-- =====================================================

-- =====================================================
-- ÍNDICES PARA BOOKINGS
-- =====================================================

-- Búsqueda principal: tenant + fecha + estado
-- Usado en: Dashboard, Agenda, Reportes
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_date_status 
ON bookings(tenant_id, starts_at DESC, status) 
WHERE status != 'cancelled';

COMMENT ON INDEX idx_bookings_tenant_date_status IS 
'Índice principal para búsquedas de reservas por tenant, fecha y estado.
Excluye reservas canceladas para optimizar queries comunes.';

-- Búsqueda por staff + fecha
-- Usado en: Agenda (vista por empleado), Staff stats
CREATE INDEX IF NOT EXISTS idx_bookings_staff_date 
ON bookings(staff_id, starts_at DESC) 
WHERE staff_id IS NOT NULL AND status != 'cancelled';

COMMENT ON INDEX idx_bookings_staff_date IS 
'Índice para búsquedas de reservas por staff member y fecha.
Optimiza vista de agenda por empleado.';

-- Búsqueda por cliente + tenant
-- Usado en: Historial del cliente, Página de detalle de cliente
CREATE INDEX IF NOT EXISTS idx_bookings_customer_tenant 
ON bookings(customer_id, tenant_id, starts_at DESC) 
WHERE customer_id IS NOT NULL;

COMMENT ON INDEX idx_bookings_customer_tenant IS 
'Índice para historial de reservas de un cliente.
Optimiza página de detalle del cliente.';

-- Búsqueda de reservas recientes por servicio
-- Usado en: Análisis de servicios, Estadísticas de popularidad
CREATE INDEX IF NOT EXISTS idx_bookings_service_date 
ON bookings(service_id, starts_at DESC) 
WHERE service_id IS NOT NULL AND status IN ('confirmed', 'completed', 'paid');

COMMENT ON INDEX idx_bookings_service_date IS 
'Índice para análisis de servicios más populares.
Solo incluye reservas completadas/confirmadas.';

-- Índice para cálculo de ingresos
-- Usado en: Dashboard, Reportes financieros
CREATE INDEX IF NOT EXISTS idx_bookings_revenue 
ON bookings(tenant_id, starts_at DESC) 
INCLUDE (service_id, status)
WHERE status IN ('confirmed', 'completed', 'paid');

COMMENT ON INDEX idx_bookings_revenue IS 
'Índice covering para cálculos de ingresos.
Incluye service_id y status para evitar accesos adicionales a la tabla.';

-- =====================================================
-- ÍNDICES PARA STAFF
-- =====================================================

-- Búsqueda principal: tenant + estado activo
-- Usado en: Listado de staff, Agenda, Selectores
CREATE INDEX IF NOT EXISTS idx_staff_tenant_active 
ON staff(tenant_id, active, name) 
WHERE active = true;

COMMENT ON INDEX idx_staff_tenant_active IS 
'Índice para listados de staff activo ordenado por nombre.
Usado en dropdowns y vistas de selección.';

-- Búsqueda por usuario vinculado
-- Usado en: Login, Permisos, Profile
CREATE INDEX IF NOT EXISTS idx_staff_user 
ON staff(user_id, tenant_id) 
WHERE user_id IS NOT NULL;

COMMENT ON INDEX idx_staff_user IS 
'Índice para encontrar staff asociado a un usuario.
Optimiza autenticación y gestión de permisos.';

-- =====================================================
-- ÍNDICES PARA SERVICES
-- =====================================================

-- Búsqueda principal: tenant + estado + categoría
-- Usado en: Listado de servicios, Filtros
CREATE INDEX IF NOT EXISTS idx_services_tenant_active_category 
ON services(tenant_id, active, category, name);

COMMENT ON INDEX idx_services_tenant_active_category IS 
'Índice para búsquedas de servicios con filtros comunes.
Soporta ordenamiento por nombre.';

-- Búsqueda por precio (para rangos)
-- Usado en: Filtros de precio, Análisis de precios
CREATE INDEX IF NOT EXISTS idx_services_tenant_price 
ON services(tenant_id, price_cents) 
WHERE active = true;

COMMENT ON INDEX idx_services_tenant_price IS 
'Índice para búsquedas y filtros por rango de precio.
Solo incluye servicios activos.';

-- Búsqueda por sincronización con Stripe
-- Usado en: Integración de pagos, Sincronización
CREATE INDEX IF NOT EXISTS idx_services_stripe 
ON services(tenant_id, stripe_product_id) 
WHERE stripe_product_id IS NOT NULL;

COMMENT ON INDEX idx_services_stripe IS 
'Índice para servicios sincronizados con Stripe.
Optimiza verificación de estado de sincronización.';

-- =====================================================
-- ÍNDICES PARA CUSTOMERS
-- =====================================================

-- Búsqueda por tenant + email
-- Usado en: Verificación de duplicados, Login de clientes
CREATE INDEX IF NOT EXISTS idx_customers_tenant_email 
ON customers(tenant_id, email) 
WHERE email IS NOT NULL;

COMMENT ON INDEX idx_customers_tenant_email IS 
'Índice para búsqueda de clientes por email.
Optimiza detección de duplicados.';

-- Búsqueda por tenant + teléfono
-- Usado en: Verificación de duplicados, Búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_customers_tenant_phone 
ON customers(tenant_id, phone) 
WHERE phone IS NOT NULL;

COMMENT ON INDEX idx_customers_tenant_phone IS 
'Índice para búsqueda de clientes por teléfono.
Útil para identificación rápida en llamadas.';

-- Búsqueda de texto (nombre)
-- Usado en: Autocompletado, Búsqueda de clientes
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm 
ON customers USING gin(name gin_trgm_ops);

COMMENT ON INDEX idx_customers_name_trgm IS 
'Índice trigram para búsqueda fuzzy de clientes por nombre.
Requiere extensión pg_trgm.';

-- Habilitar extensión para búsqueda fuzzy (si no existe)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================
-- ÍNDICES PARA TEAM CHAT
-- =====================================================

-- Búsqueda de mensajes por conversación + fecha
-- Usado en: Carga de historial de chat
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON team_messages(conversation_id, created_at DESC);

COMMENT ON INDEX idx_messages_conversation_created IS 
'Índice para carga de mensajes de una conversación ordenados por fecha.
Optimiza paginación de mensajes.';

-- Búsqueda de mensajes por remitente
-- Usado en: Búsqueda de mensajes enviados por usuario
CREATE INDEX IF NOT EXISTS idx_messages_sender_tenant 
ON team_messages(sender_id, tenant_id, created_at DESC);

COMMENT ON INDEX idx_messages_sender_tenant IS 
'Índice para mensajes enviados por un usuario.
Optimiza búsqueda de historial de mensajes por remitente.';

-- Búsqueda de conversaciones por tenant
-- Usado en: Listado de conversaciones
CREATE INDEX IF NOT EXISTS idx_conversations_tenant 
ON team_conversations(tenant_id, updated_at DESC);

COMMENT ON INDEX idx_conversations_tenant IS 
'Índice para listado de conversaciones ordenadas por actividad.
Optimiza carga de sidebar del chat.';

-- Búsqueda de mensajes no leídos (en team_conversation_members)
-- Usado en: Contador de notificaciones
CREATE INDEX IF NOT EXISTS idx_conversation_members_unread 
ON team_conversation_members(user_id, conversation_id) 
WHERE last_read_at IS NULL;

COMMENT ON INDEX idx_conversation_members_unread IS 
'Índice para conversaciones no leídas por usuario.
Optimiza contador de notificaciones del chat.';

-- =====================================================
-- ÍNDICES PARA STAFF_SCHEDULES
-- =====================================================

-- Búsqueda de horarios activos por staff
-- Usado en: Cálculo de disponibilidad, Ocupación
CREATE INDEX IF NOT EXISTS idx_schedules_staff_active 
ON staff_schedules(staff_id, day_of_week, is_active) 
WHERE is_active = true;

COMMENT ON INDEX idx_schedules_staff_active IS 
'Índice para horarios activos de un staff member.
Optimiza cálculos de disponibilidad y ocupación.';

-- =====================================================
-- ÍNDICES PARA STAFF_BLOCKINGS
-- =====================================================

-- Búsqueda de bloqueos por staff + rango de fechas
-- Usado en: Agenda, Cálculo de disponibilidad
CREATE INDEX IF NOT EXISTS idx_blockings_staff_dates 
ON staff_blockings(staff_id, start_at, end_at);

COMMENT ON INDEX idx_blockings_staff_dates IS 
'Índice para bloqueos de un staff member en un rango de fechas.
Optimiza vista de calendario y disponibilidad.';

-- Búsqueda de bloqueos por tenant + fechas
-- Usado en: Vista general de bloqueos
CREATE INDEX IF NOT EXISTS idx_blockings_tenant_dates 
ON staff_blockings(tenant_id, start_at DESC);

COMMENT ON INDEX idx_blockings_tenant_dates IS 
'Índice para todos los bloqueos de un tenant.
Útil para vista administrativa de bloqueos.';

-- =====================================================
-- ÍNDICES PARA MEMBERSHIPS (Permisos)
-- =====================================================

-- Búsqueda de membresías por usuario
-- Usado en: Autenticación, Verificación de permisos
CREATE INDEX IF NOT EXISTS idx_memberships_user 
ON memberships(user_id, tenant_id);

COMMENT ON INDEX idx_memberships_user IS 
'Índice para membresías de un usuario.
Optimiza autenticación multi-tenant.';

-- Búsqueda de miembros por tenant
-- Usado en: Listado de equipo, Gestión de permisos
CREATE INDEX IF NOT EXISTS idx_memberships_tenant_role 
ON memberships(tenant_id, role);

COMMENT ON INDEX idx_memberships_tenant_role IS 
'Índice para miembros de un tenant agrupados por rol.
Optimiza gestión de equipo.';

-- =====================================================
-- ANÁLISIS Y MANTENIMIENTO
-- =====================================================

-- Actualizar estadísticas de las tablas para que el planner use los índices correctamente
ANALYZE bookings;
ANALYZE staff;
ANALYZE services;
ANALYZE customers;
ANALYZE team_messages;
ANALYZE team_conversations;
ANALYZE staff_schedules;
ANALYZE staff_blockings;
ANALYZE memberships;

-- =====================================================
-- SCRIPT DE VERIFICACIÓN DE ÍNDICES
-- =====================================================

-- Query para verificar que los índices se están usando
-- Ejecutar después de tener datos en producción:
/*
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY idx_scan DESC;
*/

-- Query para identificar índices no utilizados (después de 1 semana en producción):
/*
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
*/

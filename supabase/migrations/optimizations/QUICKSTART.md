# 🚀 GUÍA RÁPIDA DE IMPLEMENTACIÓN

## ⚡ Implementación Rápida (5 minutos)

### Opción A: Script Automatizado (Recomendado)

```powershell
# 1. Configurar variables de entorno
$env:SUPABASE_URL = "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"

# 2. Ejecutar script de despliegue
cd supabase/migrations/optimizations
.\deploy_optimizations.ps1
```

### Opción B: Manual

```powershell
# 1. Pre-validación
psql $env:SUPABASE_URL -f 000_pre_validation.sql

# 2. Ejecutar migraciones en orden
psql $env:SUPABASE_URL -f 005_indexes_composite.sql
psql $env:SUPABASE_URL -f 001_get_dashboard_kpis.sql
psql $env:SUPABASE_URL -f 002_get_services_filtered.sql
psql $env:SUPABASE_URL -f 003_get_staff_with_stats.sql
psql $env:SUPABASE_URL -f 006_chat_optimization.sql
psql $env:SUPABASE_URL -f 004_daily_metrics_materialized.sql

# 3. Post-validación
psql $env:SUPABASE_URL -f 999_post_validation.sql

# 4. Inicializar métricas
psql $env:SUPABASE_URL -c "SELECT initialize_daily_metrics(NULL, 90);"
```

---

## 📋 Checklist Pre-Despliegue

- [ ] Hacer backup completo de la base de datos
- [ ] Notificar al equipo sobre el mantenimiento
- [ ] Verificar que tienes acceso de administrador a la BD
- [ ] Revisar que no hay procesos críticos ejecutándose
- [ ] Tener plan de rollback listo

---

## 🔧 Configuración de Variables

### Local Development

```powershell
# .env o variables de entorno
$env:SUPABASE_URL = "postgresql://postgres:postgres@localhost:54322/postgres"
$env:SUPABASE_SERVICE_KEY = "tu-service-key"
```

### Producción (Supabase)

```powershell
# Obtener connection string desde Supabase Dashboard:
# Project Settings > Database > Connection string > URI
$env:SUPABASE_URL = "postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
```

---

## 🧪 Verificación Rápida

```sql
-- 1. Verificar funciones creadas
SELECT proname 
FROM pg_proc 
WHERE proname LIKE 'get_%' 
ORDER BY proname;

-- 2. Verificar índices
SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%'
ORDER BY indexname;

-- 3. Test de rendimiento
SELECT get_dashboard_kpis('tenant-uuid-aquí');
```

---

## 📊 Uso de las Nuevas Funciones

### Dashboard KPIs

```typescript
// ANTES (11 queries)
const [bookings, services, staff, ...] = await Promise.all([...]);

// DESPUÉS (1 query)
const { data } = await supabase.rpc('get_dashboard_kpis', {
  tenant_id: tenantId
});

console.log(data.bookingsToday);
console.log(data.revenueToday);
console.log(data.occupancyTodayPercent);
```

### Servicios Filtrados

```typescript
// ANTES
const { data: allServices } = await supabase
  .from('services')
  .select('*')
  .eq('tenant_id', tenantId);

const filtered = allServices.filter(/* ... */);

// DESPUÉS
const { data: services } = await supabase.rpc('get_services_filtered', {
  p_tenant_id: tenantId,
  p_status: 'active',
  p_category: 'cortes',
  p_min_price: 1000,
  p_max_price: 5000,
  p_sort_by: 'price',
  p_limit: 20,
  p_offset: 0
});
```

### Staff con Estadísticas

```typescript
// ANTES
const { data: staff } = await supabase
  .from('staff')
  .select('*, bookings(count)')
  .eq('tenant_id', tenantId);

// DESPUÉS
const { data: staff } = await supabase.rpc('get_staff_with_stats', {
  p_tenant_id: tenantId
});

// Ya incluye: bookings_today, revenue_today, occupancy_percent, etc.
```

### Chat Paginado

```typescript
// ANTES
const { data: messages } = await supabase
  .from('team_messages')
  .select('*')
  .eq('conversation_id', conversationId);

// DESPUÉS
const { data: messages } = await supabase.rpc('get_conversation_messages_paginated', {
  p_conversation_id: conversationId,
  p_limit: 50
});

// Cargar más (scroll hacia arriba)
const { data: olderMessages } = await supabase.rpc('get_conversation_messages_paginated', {
  p_conversation_id: conversationId,
  p_limit: 50,
  p_before_timestamp: messages[0].created_at
});
```

---

## 🔄 Actualización del Frontend

### Archivos a Modificar

1. **`src/lib/dashboard-data.ts`**
   - Reemplazar función `fetchDashboardDataset`
   - Usar `supabase.rpc('get_dashboard_kpis')`

2. **`app/panel/servicios/page.tsx`**
   - Actualizar hook `useServicesPageData`
   - Usar `supabase.rpc('get_services_filtered')`

3. **`app/panel/staff/page.tsx`**
   - Actualizar hook `useStaffPageData`
   - Usar `supabase.rpc('get_staff_with_stats')`

4. **`app/panel/chat/TeamChatOptimized.tsx`**
   - Implementar paginación infinita
   - Usar `supabase.rpc('get_conversation_messages_paginated')`

---

## 🚨 Troubleshooting

### Error: "function does not exist"

```sql
-- Verificar que la función existe
SELECT proname FROM pg_proc WHERE proname = 'get_dashboard_kpis';

-- Re-ejecutar el script de creación
psql $env:SUPABASE_URL -f 001_get_dashboard_kpis.sql
```

### Error: "permission denied"

```sql
-- Otorgar permisos
GRANT EXECUTE ON FUNCTION get_dashboard_kpis(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_services_filtered TO authenticated;
```

### Índices no se están usando

```sql
-- Actualizar estadísticas
ANALYZE bookings;
ANALYZE services;
ANALYZE staff;

-- Verificar uso de índices
SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';
```

### Dashboard muy lento

```sql
-- Verificar si daily_metrics tiene datos
SELECT COUNT(*) FROM daily_metrics;

-- Si está vacío, inicializar
SELECT initialize_daily_metrics();
```

---

## 📈 Monitoreo Post-Despliegue

### Queries de Monitoreo

```sql
-- 1. Uso de funciones
SELECT 
  funcname,
  calls,
  total_time,
  mean_time
FROM pg_stat_user_functions
WHERE schemaname = 'public'
ORDER BY calls DESC;

-- 2. Uso de índices
SELECT 
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY idx_scan DESC;

-- 3. Tamaño de daily_metrics
SELECT 
  COUNT(*) as records,
  pg_size_pretty(pg_total_relation_size('daily_metrics')) as size
FROM daily_metrics;

-- 4. Queries más lentas
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%get_dashboard_kpis%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## 🔙 Rollback

Si algo sale mal:

```sql
-- 1. Eliminar funciones
DROP FUNCTION IF EXISTS get_dashboard_kpis(UUID);
DROP FUNCTION IF EXISTS get_services_filtered;
DROP FUNCTION IF EXISTS get_staff_with_stats;

-- 2. Eliminar índices
DROP INDEX IF EXISTS idx_bookings_tenant_date_status;
DROP INDEX IF EXISTS idx_services_tenant_active_category;
-- ... resto de índices

-- 3. Eliminar tabla materializada
DROP TABLE IF EXISTS daily_metrics;

-- 4. Restaurar backup
psql $env:SUPABASE_URL < backup_pre_optimization.sql
```

---

## 📞 Soporte

### Documentos de Referencia

- `README_PLAN_OPTIMIZACION.md` - Plan completo
- `000_pre_validation.sql` - Script de validación
- `999_post_validation.sql` - Script de verificación

### Comandos Útiles

```powershell
# Ver log de despliegue
Get-Content backups/deploy_log_*.txt | Select-Object -Last 50

# Ejecutar solo validación
.\deploy_optimizations.ps1 -DryRun

# Saltar backup (no recomendado)
.\deploy_optimizations.ps1 -SkipBackup

# Saltar validación
.\deploy_optimizations.ps1 -SkipValidation
```

---

## ✅ Checklist Post-Despliegue

- [ ] Todas las funciones se crearon correctamente
- [ ] Todos los índices están activos
- [ ] Tabla daily_metrics tiene datos
- [ ] Tests de rendimiento son satisfactorios
- [ ] Frontend actualizado y desplegado
- [ ] Monitoreo configurado
- [ ] Equipo notificado de los cambios
- [ ] Documentación actualizada

---

## 🎯 KPIs de Éxito

| Métrica | Antes | Después | Objetivo |
|---------|-------|---------|----------|
| Dashboard load time | ~2s | ? | <200ms |
| Services page | ~1s | ? | <150ms |
| Staff page | ~1s | ? | <100ms |
| Chat load | ~500ms | ? | <100ms |
| DB queries (dashboard) | 11 | 1 | 1 |

**Registra tus resultados aquí después del despliegue** ⬆️

---

**Última actualización:** 10 de diciembre de 2025  
**Versión:** 1.0

# P1 - Operativa, Escalabilidad y Gobierno - COMPLETADO

## ✅ Estado: LISTO PARA PRODUCCIÓN

Se han completado las tareas P1.1 y P1.2 para conseguir operativa y escalabilidad.

---

## Resumen Ejecutivo

### P1.1: RLS End-to-End + Test Harness ✅

**Completado**: Políticas RLS completas por rol y tenant_id

- **Funciones Helper**:
  - ✅ `app.current_tenant_id()`: Retorna tenant_id del usuario (usa memberships)
  - ✅ `app.user_has_access_to_tenant()`: Verifica acceso a tenant
  - ✅ `app.user_has_role()`: Verifica roles en tenant
  - ✅ Compatibilidad hacia atrás con `users` si existe

- **Políticas RLS**:
  - ✅ Todas las tablas tienen políticas RLS por rol
  - ✅ Lectura pública para disponibilidad (services, staff, schedules activos)
  - ✅ Escritura restringida por rol (owner/admin/manager/staff)
  - ✅ Usa `exists` con subconsultas directas a `memberships` (más eficiente)

- **Tests**:
  - ✅ Tests de integración por rol (owner, admin, manager, staff)
  - ✅ Tests de aislamiento multi-tenant
  - ✅ Tests de lectura pública
  - ✅ Tests de usuarios con múltiples tenants

**Criterios de Aceptación Cumplidos**:
- ✅ Ningún test cruza tenant
- ✅ Roles con permisos adecuados
- ✅ Lectura pública funciona para endpoints de disponibilidad

### P1.2: Timezone por Organización ✅

**Completado**: Timezone por tenant con uso en generación y render de slots

- **Migración**:
  - ✅ Columna `timezone` en `tenants` con constraint de validación
  - ✅ Default: `Europe/Madrid`
  - ✅ Función `app.get_tenant_timezone()`: Retorna timezone del tenant
  - ✅ Función `public.is_slot_in_past()`: Verifica si un slot está en el pasado
  - ✅ Función `public.to_tenant_timezone()`: Convierte timestamp a timezone del tenant
  - ✅ Función `get_available_slots()` mejorada: Usa timezone del tenant para calcular slots

- **Endpoint**:
  - ✅ `/api/availability` retorna timezone del tenant
  - ✅ Obtiene timezone al resolver tenant_id

- **Frontend**:
  - ✅ `BookingWidget` usa timezone del tenant para formatear horas
  - ✅ `Intl.DateTimeFormat` con timezone del tenant
  - ✅ Formato 24 horas consistente

**Criterios de Aceptación Cumplidos**:
- ✅ Cambiar timezone de la org cambia render y elegibilidad de slots
- ✅ Slots mostrados en timezone del tenant
- ✅ Slots pasados no se muestran

---

## Archivos Creados/Modificados

### Migraciones
- `supabase/migrations/0025_p1_rls_complete.sql` (nuevo)
- `supabase/migrations/0026_p1_timezone_complete.sql` (nuevo)

### Endpoints
- `app/api/availability/route.ts` (modificado)

### Componentes
- `app/components/BookingWidget.tsx` (modificado)
- `app/r/[orgId]/ReserveClient.tsx` (modificado)

### Tests
- `tests/rls-integration.test.ts` (nuevo)
- `tests/rls-complete.test.ts` (mejorado)

### Documentación
- `docs/P1_RLS_COMPLETE.md` (nuevo)
- `docs/P1_TIMEZONE_COMPLETE.md` (nuevo)
- `README_P1_COMPLETED.md` (nuevo)

---

## Próximos Pasos (P1)

### P1.3: Sincronización Stripe desde Panel
- Crear endpoint `/api/payments/services/sync`
- Crear UI en `/panel/config/payments`
- Bloquear checkout si falta `price_id`

### P1.4: Bootstrap de Tenant
- Crear wizard `/admin/new-tenant`
- Seeds guiados
- Auditoría

### P1.5: Salud, Métricas y Backups
- Dashboard interno con KPIs por org
- Health endpoints mejorados
- Política de backups

---

## Criterios de Aceptación P1

### P1.1: RLS End-to-End
- ✅ Ningún test cruza tenant
- ✅ Roles con permisos adecuados
- ✅ Lectura pública funciona para endpoints de disponibilidad

### P1.2: Timezone por Organización
- ✅ Cambiar timezone de la org cambia render y elegibilidad de slots
- ✅ Slots mostrados en timezone del tenant
- ✅ Slots pasados no se muestran

---

## Configuración

### Variables de Entorno

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Rate Limit
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# TTL
HOLD_TTL_MIN=10

# Cron
INTERNAL_CRON_KEY=your-secret-key
```

---

## Documentación

- **RLS**: `docs/P1_RLS_COMPLETE.md`
- **Timezone**: `docs/P1_TIMEZONE_COMPLETE.md`
- **Tests**: `tests/rls-integration.test.ts`
- **Health Endpoints**: `app/api/health/*/route.ts`
- **Métricas**: `supabase/migrations/0023_org_metrics_enhanced.sql`

---

## Estado Final

✅ **P1.1**: RLS end-to-end + test harness completo - COMPLETADO
✅ **P1.2**: Timezone por organización - COMPLETADO
⏳ **P1.3**: Sincronización Stripe desde panel - PENDIENTE
⏳ **P1.4**: Bootstrap de tenant - PENDIENTE
⏳ **P1.5**: Salud, métricas y backups - PENDIENTE

**Listo para pasar a P1.3 (Sincronización Stripe desde panel).**


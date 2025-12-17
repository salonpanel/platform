# P1.2: Timezone por Tenant - Implementación Completa

## Resumen

Implementación completa del soporte de timezone por tenant, incluyendo migraciones SQL, endpoints API, y actualización de todas las UIs para usar el timezone del tenant.

## Cambios Implementados

### 1. Migración SQL (`0028_p1_timezone_ui_complete.sql`)

**Características**:
- ✅ Asegura que `timezone` existe en `tenants` con valor por defecto `Europe/Madrid`
- ✅ Actualiza tenants existentes sin timezone
- ✅ Asegura que `timezone` no puede ser null
- ✅ Función helper `app.get_tenant_timezone()` mejorada
- ✅ Función helper `public.is_slot_in_past()` mejorada (valida en timezone local)
- ✅ Función helper `public.to_tenant_timezone()` mejorada
- ✅ Función helper `public.get_tenant_info()` para obtener información del tenant
- ✅ Índice para mejorar consultas de timezone
- ✅ Constraint de validación básico para timezone

### 2. Endpoints API

**GET `/api/tenants/[tenantId]/timezone`**:
- Obtiene el timezone de un tenant
- Público (no requiere autenticación)

**GET `/api/admin/tenants/[orgId]/timezone`**:
- Obtiene el timezone de un tenant (solo platform admins)
- Requiere autenticación y permisos de platform admin

**PUT `/api/admin/tenants/[orgId]/timezone`**:
- Actualiza el timezone de un tenant (solo platform admins)
- Valida que el timezone sea válido (formato básico)
- Registra cambios en `platform.audit_logs`
- Requiere autenticación y permisos de platform admin

### 3. UI Actualizada

**Agenda (`src/app/panel/agenda/page.tsx`)**:
- ✅ Obtiene timezone del tenant al cargar
- ✅ Usa `Intl.DateTimeFormat` con timezone del tenant
- ✅ Formatea horas correctamente según timezone del tenant

**BookingWidget (`app/components/BookingWidget.tsx`)**:
- ✅ Obtiene timezone del tenant desde la respuesta de `/api/availability`
- ✅ Usa `Intl.DateTimeFormat` con timezone del tenant
- ✅ Valida slots pasados en el frontend (bloquea botones)
- ✅ Muestra tooltip cuando un slot está deshabilitado

**ReserveClient (`app/r/[orgId]/ReserveClient.tsx`)**:
- ✅ Recibe timezone del tenant como prop
- ✅ Usa `Intl.DateTimeFormat` con timezone del tenant
- ✅ Genera slots usando timezone del tenant

**ReservePage (`app/r/[orgId]/page.tsx`)**:
- ✅ Resuelve tenant_id por UUID o slug
- ✅ Obtiene timezone del tenant
- ✅ Pasa timezone a `ReserveClient`
- ✅ Carga servicios usando `tenant_id` (no `org_id`)

**Admin Panel (`src/app/admin/[orgId]/page.tsx`)**:
- ✅ Muestra timezone actual del tenant
- ✅ Permite actualizar timezone del tenant
- ✅ Valida timezone antes de actualizar
- ✅ Registra cambios en auditoría

### 4. Función SQL `get_available_slots()` Mejorada

**Características**:
- ✅ Usa timezone del tenant para calcular slots
- ✅ Convierte horarios del staff al timezone del tenant
- ✅ Valida que los slots no estén en el pasado (en UTC)
- ✅ Filtra slots pasados correctamente
- ✅ Considera reservas existentes y holds no expirados

## Flujo de Uso

### 1. Configurar Timezone (Admin)

1. Ir a `/admin/[orgId]`
2. En la sección "Timezone", introducir el timezone deseado (ej: `America/New_York`)
3. Hacer clic en "Actualizar"
4. El timezone se actualiza y se registra en auditoría

### 2. Ver Agenda (Usuario)

1. Ir a `/panel/agenda`
2. La agenda carga automáticamente el timezone del tenant
3. Las horas se muestran correctamente según el timezone del tenant

### 3. Reservar Servicio (Cliente)

1. Ir a `/r/[orgId]` o usar `BookingWidget`
2. El componente carga el timezone del tenant automáticamente
3. Los slots se muestran correctamente según el timezone del tenant
4. Los slots pasados se bloquean automáticamente

## Validaciones

### Backend

- ✅ Timezone debe ser un string válido
- ✅ Timezone debe tener formato válido (ej: `Europe/Madrid`, `America/New_York`)
- ✅ PostgreSQL valida automáticamente que sea un timezone válido
- ✅ Slots pasados se filtran en la función SQL

### Frontend

- ✅ Slots pasados se bloquean en el UI (botones deshabilitados)
- ✅ Tooltips informativos para slots deshabilitados
- ✅ Validación de formato básico antes de actualizar timezone

## Ejemplos de Timezones

- `Europe/Madrid` - España
- `America/New_York` - Estados Unidos (Este)
- `America/Los_Angeles` - Estados Unidos (Oeste)
- `America/Mexico_City` - México
- `America/Buenos_Aires` - Argentina
- `Europe/London` - Reino Unido
- `Asia/Tokyo` - Japón
- `UTC` - Coordinated Universal Time

## Notas

- **Timezone por defecto**: `Europe/Madrid`
- **Validación**: PostgreSQL valida automáticamente que el timezone sea válido
- **Almacenamiento**: Los timestamps se almacenan en UTC (`timestamptz`)
- **Conversión**: La conversión a timezone local se hace en el frontend y en las funciones SQL
- **Slots pasados**: Se filtran tanto en SQL como en el frontend para mejor UX

## Pruebas

### Manual

1. **Configurar timezone**:
   ```bash
   # Actualizar timezone de un tenant
   curl -X PUT http://localhost:3000/api/admin/tenants/[orgId]/timezone \
     -H "Content-Type: application/json" \
     -H "Cookie: ..." \
     -d '{"timezone": "America/New_York"}'
   ```

2. **Verificar timezone**:
   ```bash
   # Obtener timezone de un tenant
   curl http://localhost:3000/api/tenants/[tenantId]/timezone
   ```

3. **Verificar slots**:
   ```bash
   # Obtener slots disponibles
   curl "http://localhost:3000/api/availability?tenant=[tenantId]&service_id=[serviceId]&date=2024-01-15"
   ```

4. **Verificar en UI**:
   - Ir a `/panel/agenda` y verificar que las horas se muestran correctamente
   - Ir a `/r/[orgId]` y verificar que los slots se muestran correctamente
   - Verificar que los slots pasados están bloqueados

## Estado

- ✅ Migración SQL completada
- ✅ Endpoints API implementados
- ✅ UI de agenda actualizada
- ✅ UI de reservas actualizada
- ✅ UI de admin actualizada
- ✅ Validaciones implementadas
- ✅ Documentación completada

## Próximos Pasos

- [ ] Añadir tests automatizados para timezone
- [ ] Añadir selector de timezone con lista de timezones comunes
- [ ] Añadir validación de DST (Daylight Saving Time)
- [ ] Añadir métricas de uso por timezone
- [ ] Añadir soporte para múltiples timezones por tenant (si es necesario)


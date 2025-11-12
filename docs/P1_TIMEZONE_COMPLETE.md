# P1.2 - Timezone por Organización

## Estado: ✅ COMPLETADO

Se ha completado la implementación de timezone por organización con uso en generación y render de slots.

---

## Cambios Aplicados

### 1. Migración `0026_p1_timezone_complete.sql`

#### Mejoras a Timezone

1. **Constraint de timezone**:
   - ✅ Validación de timezone válido (formato `Continent/City` o `UTC`)
   - ✅ Actualización de tenants existentes sin timezone

2. **Funciones Helper**:
   - ✅ `app.get_tenant_timezone(p_tenant_id)`: Retorna timezone del tenant
   - ✅ `public.is_slot_in_past(p_tenant_id, p_timestamp)`: Verifica si un slot está en el pasado
   - ✅ `public.to_tenant_timezone(p_tenant_id, p_timestamp)`: Convierte timestamp a timezone del tenant

3. **Función `get_available_slots` mejorada**:
   - ✅ Usa timezone del tenant para calcular slots
   - ✅ Valida que los slots no estén en el pasado
   - ✅ Convierte horarios del staff a UTC para almacenamiento
   - ✅ Genera slots considerando timezone del tenant

#### Índices

- ✅ Índice en `tenants.timezone` para mejorar consultas

---

### 2. Endpoint `/api/availability`

#### Mejoras

1. **Retorna timezone del tenant**:
   - ✅ Obtiene timezone del tenant al resolver tenant_id
   - ✅ Retorna timezone en la respuesta para el frontend
   - ✅ Default: `Europe/Madrid` si no existe

---

### 3. Componente `BookingWidget`

#### Mejoras

1. **Uso de timezone del tenant**:
   - ✅ Estado `tenantTimezone` para almacenar timezone del tenant
   - ✅ Actualiza timezone desde la respuesta del endpoint
   - ✅ Formateador `Intl.DateTimeFormat` con timezone del tenant
   - ✅ Formatea horas de slots usando timezone del tenant

2. **Formateo de horas**:
   - ✅ Usa `Intl.DateTimeFormat` con timezone del tenant
   - ✅ Formato 24 horas (`HH:mm`)
   - ✅ Locale español (`es-ES`)

---

## Funcionalidades

### 1. Timezone por Tenant

- ✅ Cada tenant tiene su propio timezone
- ✅ Default: `Europe/Madrid`
- ✅ Validación de timezone válido (formato `Continent/City`)

### 2. Generación de Slots

- ✅ Slots generados considerando timezone del tenant
- ✅ Horarios del staff convertidos a UTC para almacenamiento
- ✅ Slots validados para no estar en el pasado
- ✅ Filtrado de slots pasados según timezone del tenant

### 3. Render de Slots

- ✅ Slots mostrados en timezone del tenant
- ✅ Formateo de horas usando `Intl.DateTimeFormat`
- ✅ Formato 24 horas consistente

---

## Uso

### Configurar Timezone

```sql
-- Actualizar timezone de un tenant
UPDATE public.tenants 
SET timezone = 'America/New_York' 
WHERE id = 'tenant-id';

-- Verificar timezone
SELECT id, name, timezone FROM public.tenants WHERE id = 'tenant-id';
```

### Obtener Timezone del Tenant

```sql
-- Usar función helper
SELECT app.get_tenant_timezone('tenant-id');

-- Verificar si un slot está en el pasado
SELECT public.is_slot_in_past('tenant-id', '2024-01-15T10:00:00Z'::timestamptz);

-- Convertir timestamp a timezone del tenant
SELECT public.to_tenant_timezone('tenant-id', '2024-01-15T10:00:00Z'::timestamptz);
```

### Frontend

```tsx
// El componente BookingWidget usa automáticamente el timezone del tenant
<BookingWidget
  tenantId="tenant-id"
  services={services}
  onBookingComplete={(bookingId) => {
    console.log('Reserva completada:', bookingId);
  }}
/>
```

---

## Criterios de Aceptación

- ✅ Cambiar timezone de la org cambia render de slots
- ✅ Slots mostrados en timezone del tenant
- ✅ Slots pasados no se muestran
- ✅ Generación de slots considera timezone del tenant
- ✅ Validación de timezone válido

---

## Archivos Creados/Modificados

### Migraciones
- `supabase/migrations/0026_p1_timezone_complete.sql` (nuevo)

### Endpoints
- `app/api/availability/route.ts` (modificado)

### Componentes
- `app/components/BookingWidget.tsx` (modificado)

### Documentación
- `docs/P1_TIMEZONE_COMPLETE.md` (nuevo)

---

## Próximos Pasos

1. **P1.3**: Sincronización Stripe desde panel
   - Crear endpoint `/api/payments/services/sync`
   - Crear UI en `/panel/config/payments`
   - Bloquear checkout si falta `price_id`

2. **P1.4**: Bootstrap de tenant
   - Crear wizard `/admin/new-tenant`
   - Seeds guiados
   - Auditoría

---

## Documentación

- **Especificaciones**: `docs/P0_SPECIFICATIONS.md`
- **Implementación**: `docs/P1_TIMEZONE_COMPLETE.md`
- **Tests**: Verificar que los slots se muestran correctamente en diferentes timezones

---

## Estado Final

✅ **P1.2**: Timezone por organización - COMPLETADO

**Listo para pasar a P1.3 (Sincronización Stripe desde panel).**


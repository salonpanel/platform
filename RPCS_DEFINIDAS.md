# 🔵 RPCs DEFINIDAS EN SUPABASE

**Última actualización:** 10 Dec 2025  
**Estado:** ✅ OPERACIONALES

---

## 📋 RESUMEN

| RPC | Parámetros | Retorna | Propósito |
|-----|-----------|---------|----------|
| `check_booking_conflicts` | tenant_id, staff_id, start_at, end_at, service_id | TABLE | Detecta conflictos con bookings/blockings |
| `create_booking_with_validation` | p_booking (JSONB) | TABLE | Crea booking con validación atómica |
| `create_staff_blocking_with_validation` | p_block (JSONB) | TABLE | Crea bloqueo con validación atómica |
| `get_filtered_bookings` | tenant_id, start_date, end_date, staff_id?, status? | SETOF JSONB | Obtiene bookings filtrados |
| `get_agenda_stats` | tenant_id, start_date, end_date | JSONB | Estadísticas agregadas de agenda |

---

## 1️⃣ check_booking_conflicts

**Detecta si hay conflictos de horario**

### Sintaxis
```sql
SELECT * FROM public.check_booking_conflicts(
  p_tenant_id UUID,
  p_staff_id UUID,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_service_id UUID
)
```

### Parámetros
- `p_tenant_id`: ID del tenant
- `p_staff_id`: ID del staff
- `p_start_at`: Hora inicio (ISO 8601)
- `p_end_at`: Hora fin (ISO 8601)
- `p_service_id`: NULL o UUID del servicio (para cálculos futuros)

### Retorna
```
conflict_type  | source_id | starts_at | ends_at | details
booking        | ...uuid...| ...       | ...     | Cliente X
blocking       | ...uuid...| ...       | ...     | Blocked
```

### Ejemplo
```sql
SELECT * FROM public.check_booking_conflicts(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,  -- tenant_id
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,  -- staff_id
  '2025-12-15 10:00:00+00'::timestamptz,
  '2025-12-15 11:00:00+00'::timestamptz,
  NULL  -- service_id
);
```

---

## 2️⃣ create_booking_with_validation

**Crea booking con validación atómica (una sola transacción)**

### Sintaxis
```sql
SELECT booking, error_message FROM public.create_booking_with_validation(
  jsonb_build_object(
    'tenant_id', 'uuid-string',
    'staff_id', 'uuid-string',
    'customer_id', 'uuid-string',
    'service_id', 'uuid-string',
    'starts_at', '2025-12-15T10:00:00+00:00',
    'ends_at', '2025-12-15T11:00:00+00:00',
    'status', 'confirmed'
  )
)
```

### Parámetros (en JSONB)
- `tenant_id` (TEXT/UUID)
- `staff_id` (TEXT/UUID)
- `customer_id` (TEXT/UUID)
- `service_id` (TEXT/UUID)
- `starts_at` (TEXT/ISO 8601)
- `ends_at` (TEXT/ISO 8601)
- `status` (TEXT: 'confirmed', 'pending', etc.)

### Retorna
```
booking (JSONB)       | error_message
{...booking data...}  | NULL
NULL                  | "Conflicto detectado: el horario..."
```

### Ejemplo - JavaScript/Supabase
```javascript
const { data, error } = await supabase.rpc(
  'create_booking_with_validation',
  {
    p_booking: {
      tenant_id: tenantId,
      staff_id: staffId,
      customer_id: customerId,
      service_id: serviceId,
      starts_at: new Date(2025, 11, 15, 10, 0).toISOString(),
      ends_at: new Date(2025, 11, 15, 11, 0).toISOString(),
      status: 'confirmed'
    }
  }
);

if (data?.[0]?.error_message) {
  console.error('Conflicto:', data[0].error_message);
} else if (data?.[0]?.booking) {
  console.log('Booking creado:', data[0].booking);
}
```

---

## 3️⃣ create_staff_blocking_with_validation

**Crea bloqueo de disponibilidad con validación**

### Sintaxis
```sql
SELECT blocking, error_message FROM public.create_staff_blocking_with_validation(
  jsonb_build_object(
    'tenant_id', 'uuid-string',
    'staff_id', 'uuid-string',
    'start_at', '2025-12-15T10:00:00+00:00',
    'end_at', '2025-12-15T11:00:00+00:00'
  )
)
```

### Parámetros (en JSONB)
- `tenant_id` (TEXT/UUID)
- `staff_id` (TEXT/UUID)
- `start_at` (TEXT/ISO 8601)
- `end_at` (TEXT/ISO 8601)

### Retorna
```
blocking (JSONB)          | error_message
{...blocking data...}     | NULL
NULL                      | "Conflicto detectado: existe..."
```

### Ejemplo - JavaScript
```javascript
const { data, error } = await supabase.rpc(
  'create_staff_blocking_with_validation',
  {
    p_block: {
      tenant_id: tenantId,
      staff_id: staffId,
      start_at: new Date(2025, 11, 15, 14, 0).toISOString(),
      end_at: new Date(2025, 11, 15, 15, 0).toISOString()
    }
  }
);
```

---

## 4️⃣ get_filtered_bookings

**Obtiene bookings filtrados por rango de fechas y opcionales filtros**

### Sintaxis
```sql
SELECT row_to_json(row)::jsonb 
FROM public.get_filtered_bookings(
  p_tenant_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_staff_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
```

### Parámetros
- `p_tenant_id`: ID del tenant (requerido)
- `p_start_date`: Inicio del rango (requerido)
- `p_end_date`: Fin del rango (requerido)
- `p_staff_id`: Filtrar por staff (opcional, NULL = todos)
- `p_status`: Filtrar por estado (opcional, NULL = todos)

### Retorna (por cada fila)
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "staff_id": "uuid",
  "customer_id": "uuid",
  "service_id": "uuid",
  "starts_at": "2025-12-15T10:00:00+00:00",
  "ends_at": "2025-12-15T11:00:00+00:00",
  "status": "confirmed",
  ...
}
```

### Ejemplo - JavaScript
```javascript
const { data: bookings, error } = await supabase.rpc(
  'get_filtered_bookings',
  {
    p_tenant_id: tenantId,
    p_start_date: new Date(2025, 11, 1).toISOString(),
    p_end_date: new Date(2025, 11, 31).toISOString(),
    p_staff_id: staffId || null,
    p_status: 'confirmed'
  }
);

console.log('Bookings:', bookings);
```

---

## 5️⃣ get_agenda_stats

**Obtiene estadísticas agregadas de la agenda**

### Sintaxis
```sql
SELECT public.get_agenda_stats(
  p_tenant_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
```

### Parámetros
- `p_tenant_id`: ID del tenant (requerido)
- `p_start_date`: Inicio del período (requerido)
- `p_end_date`: Fin del período (requerido)

### Retorna (JSONB)
```json
{
  "total_bookings": 15,
  "total_minutes": 720,
  "total_revenue": 150000,
  "by_staff": [
    {
      "staff_id": "uuid",
      "staff_name": "Juan",
      "bookings": 5,
      "minutes": 240,
      "revenue": 50000
    }
  ]
}
```

### Ejemplo - JavaScript
```javascript
const { data: stats, error } = await supabase.rpc(
  'get_agenda_stats',
  {
    p_tenant_id: tenantId,
    p_start_date: new Date(2025, 11, 1).toISOString(),
    p_end_date: new Date(2025, 11, 31).toISOString()
  }
);

console.log('Stats:', stats);
console.log('Total bookings:', stats?.[0]?.total_bookings);
console.log('Revenue:', stats?.[0]?.total_revenue);
```

---

## 🎯 CASO DE USO: CREAR BOOKING COMPLETO

### 1. Revisar conflictos (opcional, para UI preview)
```javascript
const { data: conflicts } = await supabase.rpc(
  'check_booking_conflicts',
  {
    p_tenant_id: tenantId,
    p_staff_id: staffId,
    p_start_at: startsAt,
    p_end_at: endsAt,
    p_service_id: null
  }
);

if (conflicts?.length > 0) {
  showError('⚠️ Hay conflictos');
  return;
}
```

### 2. Crear booking (validado atomicamente)
```javascript
const { data, error } = await supabase.rpc(
  'create_booking_with_validation',
  {
    p_booking: {
      tenant_id: tenantId,
      staff_id: staffId,
      customer_id: customerId,
      service_id: serviceId,
      starts_at: startsAt,
      ends_at: endsAt,
      status: 'confirmed'
    }
  }
);

if (data?.[0]?.error_message) {
  showError(data[0].error_message);
} else {
  showSuccess('Booking creado!');
  refreshAgenda();
}
```

### 3. Obtener stats actualizadas
```javascript
const { data: stats } = await supabase.rpc(
  'get_agenda_stats',
  {
    p_tenant_id: tenantId,
    p_start_date: startOfMonth,
    p_end_date: endOfMonth
  }
);

console.log(`Total ingresos: $${stats?.[0]?.total_revenue / 100}`);
```

---

## ⚠️ NOTAS IMPORTANTES

### Tipos de datos
- **UUID en JSONB:** Convertir a STRING
- **Timestamps:** Usar ISO 8601 (`.toISOString()` en JS)
- **Parámetros NULL:** Pasar explícitamente `NULL` en SQL, `null` en JS

### Transacciones
- `create_booking_with_validation` es **ATÓMICA**: conflicto → NO se inserta
- `check_booking_conflicts` es **SOLO LECTURA**: seguro de usar para preview

### Performance
- `get_filtered_bookings`: ~50-100ms (con índices)
- `get_agenda_stats`: ~100-200ms (con índices)
- `check_booking_conflicts`: ~10-30ms (con índices)

### Security
- Todas usan `SECURITY DEFINER` → se ejecutan con permisos del owner
- RLS en `bookings` y `staff_blockings` filtra automáticamente por tenant
- Validar `tenant_id` en frontend antes de enviar

---

## 📝 CHECKLIST DE MIGRACION

- ✅ RPC 1: check_booking_conflicts - Creada y operacional
- ✅ RPC 2: create_booking_with_validation - Creada y operacional
- ✅ RPC 3: create_staff_blocking_with_validation - Creada y operacional
- ✅ RPC 4: get_filtered_bookings - Creada y operacional
- ✅ RPC 5: get_agenda_stats - Creada y operacional

**Siguiente paso:** Ejecutar FASE 1, 2, 3, 4 de validación en AGENDA_VALIDATION_STEP_BY_STEP.md

---

**Responsable:** Josep Calafat  
**Proyecto:** SalonPanel - Agenda Optimization  
**Versionado:** v1.0

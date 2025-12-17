# 🎯 Seed Demo: BookFast Barbería

## 📋 Descripción

Este conjunto de scripts crea un **tenant de demo completamente funcional** para BookFast, una barbería ficticia con datos realistas que respetan todas las constraints y reglas de negocio del sistema.

## 📦 Contenido del Seed

### ✅ Datos Creados

| Categoría | Cantidad | Descripción |
|-----------|----------|-------------|
| **Tenant** | 1 | BookFast Barbería (Madrid) |
| **Usuarios Owners** | 2 | Tú + tu socio (con permisos completos) |
| **Staff (Barberos)** | 4 | Con horarios semanales realistas |
| **Servicios** | 8 | Cortes, barba, combos, tintes |
| **Clientes** | 30 | Nombres realistas, tags, VIPs |
| **Reservas** | ~500-800 | Últimos 6 meses + próximas 2 semanas |

### 🎨 Características Destacadas

- ✅ **Sin shortcuts**: Todo respeta RLS, constraints y horarios reales
- ✅ **Datos coherentes**: No hay solapamientos ni violaciones de integridad
- ✅ **Métricas realistas**: Historial de 6 meses para alimentar dashboard
- ✅ **Distribución natural**: Mix de estados (completed, confirmed, cancelled, no_show)
- ✅ **Clientes VIP**: Generados automáticamente por criterios de recurrencia/gasto

---

## 🚀 Instrucciones de Ejecución

### Paso 1: Preparación

1. **Abrir Supabase Cloud**
   - Ir a tu proyecto en Supabase
   - Abrir **SQL Editor**

2. **Verificar estado de la base de datos**
   ```sql
   -- Verificar que no existe ya el tenant BookFast
   SELECT * FROM public.tenants WHERE slug = 'bookfast';
   ```

   Si ya existe, puedes:
   - **Opción A**: Eliminarlo primero (ver sección "Limpieza")
   - **Opción B**: Cambiar el slug en los scripts

---

### Paso 2: Crear Estructura Base

**Archivo**: `seed_bookfast_demo.sql`

1. Copiar todo el contenido del archivo
2. Pegar en SQL Editor de Supabase
3. Ejecutar (Run)

**✅ Resultado esperado**:
- Tenant BookFast creado
- Tenant settings configurados
- 8 servicios creados
- 4 barberos creados
- Horarios semanales configurados
- Relación staff-servicios establecida
- 30 clientes creados

**⚠️ IMPORTANTE**: Este script incluye un comentario en el PASO 2 sobre memberships. **NO ejecutes ese paso aún**.

---

### Paso 3: Asignar Usuarios Owners

**Archivo**: `seed_bookfast_assign_users.sql`

1. **Primero, obtener tus user IDs**:
   ```sql
   SELECT 
     id,
     email,
     created_at,
     raw_user_meta_data->>'full_name' as full_name
   FROM auth.users
   ORDER BY created_at DESC
   LIMIT 20;
   ```

2. **Copiar los UUIDs** de tu usuario y el de tu socio

3. **Descomentar y editar** el bloque `DO $$` en el archivo:
   ```sql
   v_user_id_1 UUID := 'TU_UUID_AQUI';
   v_user_id_2 UUID := 'UUID_DE_TU_SOCIO_AQUI';
   ```

4. **Ejecutar** el bloque editado

**✅ Resultado esperado**:
- 2 memberships creadas con rol 'owner'
- Permisos completos asignados
- Profiles actualizados con default_org_id

---

### Paso 4: Generar Reservas

**Archivo**: `seed_bookfast_bookings.sql`

1. Copiar todo el contenido
2. Pegar en SQL Editor
3. Ejecutar (Run)

**⏱️ Tiempo de ejecución**: 30-60 segundos

**✅ Resultado esperado**:
- ~500-800 reservas creadas
- Distribución temporal: últimos 6 meses + próximas 2 semanas
- Estados variados (completed, confirmed, cancelled, no_show)
- Estadísticas de clientes actualizadas (visits_count, total_spent_cents)
- Clientes VIP marcados automáticamente

---

## ✅ Validaciones Post-Ejecución

### 1. Verificar Tenant

```sql
SELECT * FROM public.tenants WHERE id = 'bf000000-0000-0000-0000-000000000001';
```

**Esperado**: 1 fila con nombre "BookFast Barbería"

---

### 2. Verificar Memberships

```sql
SELECT 
  m.role,
  u.email,
  t.name as tenant_name
FROM public.memberships m
JOIN auth.users u ON u.id = m.user_id
JOIN public.tenants t ON t.id = m.tenant_id
WHERE m.tenant_id = 'bf000000-0000-0000-0000-000000000001';
```

**Esperado**: 2 filas, ambas con role 'owner'

---

### 3. Verificar Servicios

```sql
SELECT COUNT(*) as total_servicios 
FROM public.services 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';
```

**Esperado**: 8 servicios

---

### 4. Verificar Staff y Horarios

```sql
SELECT 
  s.display_name,
  COUNT(ss.id) as dias_trabajo
FROM public.staff s
JOIN public.staff_schedules ss ON ss.staff_id = s.id
WHERE s.tenant_id = 'bf000000-0000-0000-0000-000000000001'
GROUP BY s.id, s.display_name
ORDER BY s.display_name;
```

**Esperado**: 
- Carlos: 6 días
- Miguel: 5 días
- Javi: 5 días
- David: 5 días

---

### 5. Verificar Clientes

```sql
SELECT COUNT(*) as total_clientes 
FROM public.customers 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';
```

**Esperado**: 30 clientes

---

### 6. Verificar Reservas

```sql
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM public.bookings 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'
GROUP BY status
ORDER BY count DESC;
```

**Esperado**: Distribución similar a:
- completed: ~60-70%
- confirmed: ~20-25%
- cancelled: ~5-10%
- no_show: ~2-5%

---

### 7. Verificar Distribución Temporal

```sql
SELECT 
  DATE_TRUNC('month', starts_at) as month,
  COUNT(*) as bookings
FROM public.bookings
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'
GROUP BY month
ORDER BY month;
```

**Esperado**: Aproximadamente 80-150 reservas por mes

---

### 8. Verificar Clientes VIP

```sql
SELECT 
  name,
  visits_count,
  ROUND(total_spent_cents / 100.0, 2) as total_spent_eur,
  is_vip
FROM public.customers
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001'
  AND is_vip = true
ORDER BY visits_count DESC;
```

**Esperado**: 3-8 clientes VIP con >10 visitas o >200€ gastados

---

### 9. Verificar Próximas Reservas (Agenda)

```sql
SELECT 
  TO_CHAR(b.starts_at, 'DD/MM/YYYY HH24:MI') as fecha_hora,
  s.display_name as barbero,
  c.name as cliente,
  sv.name as servicio,
  b.status,
  b.is_highlighted
FROM public.bookings b
JOIN public.staff s ON s.id = b.staff_id
JOIN public.customers c ON c.id = b.customer_id
JOIN public.services sv ON sv.id = b.service_id
WHERE b.tenant_id = 'bf000000-0000-0000-0000-000000000001'
  AND b.starts_at >= CURRENT_TIMESTAMP
ORDER BY b.starts_at
LIMIT 20;
```

**Esperado**: 20-50 reservas futuras con distribución natural

---

### 10. Verificar Integridad (No Solapamientos)

```sql
-- Esta query NO debe retornar filas
SELECT 
  b1.id as booking1,
  b2.id as booking2,
  s.display_name as barbero,
  b1.starts_at,
  b1.ends_at,
  b2.starts_at,
  b2.ends_at
FROM public.bookings b1
JOIN public.bookings b2 ON b1.staff_id = b2.staff_id AND b1.id != b2.id
JOIN public.staff s ON s.id = b1.staff_id
WHERE b1.tenant_id = 'bf000000-0000-0000-0000-000000000001'
  AND b1.slot && b2.slot;
```

**Esperado**: 0 filas (sin solapamientos)

---

## 🧪 Testing Funcional

### Acceder al Panel

1. Hacer login con tu usuario en la aplicación
2. Navegar a `/panel`
3. Verificar que aparece el tenant "BookFast Barbería"

### Verificar Dashboard

```
/panel/dashboard
```

**Deberías ver**:
- KPIs poblados con datos reales
- Gráficos de últimos 7/30 días con datos
- Ocupación calculada
- Tickets medios
- Ingresos acumulados

### Verificar Agenda

```
/panel/agenda
```

**Deberías ver**:
- Reservas de los 4 barberos
- Distribución por días
- Estados visuales (completed, confirmed, highlighted)
- Sin solapamientos

### Verificar Clientes

```
/panel/clientes
```

**Deberías ver**:
- 30 clientes listados
- Tags aplicados
- VIPs marcados
- Estadísticas de visitas

---

## 🧹 Limpieza (Opcional)

Si necesitas eliminar todo y volver a empezar:

```sql
BEGIN;

-- Eliminar reservas
DELETE FROM public.bookings 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';

-- Eliminar clientes
DELETE FROM public.customers 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';

-- Eliminar horarios
DELETE FROM public.staff_schedules 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';

-- Eliminar asignaciones staff-servicios
DELETE FROM public.staff_provides_services 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';

-- Eliminar staff
DELETE FROM public.staff 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';

-- Eliminar servicios
DELETE FROM public.services 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';

-- Eliminar memberships
DELETE FROM public.memberships 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';

-- Eliminar permisos
DELETE FROM public.user_permissions 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';

-- Eliminar tenant settings
DELETE FROM public.tenant_settings 
WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';

-- Eliminar tenant
DELETE FROM public.tenants 
WHERE id = 'bf000000-0000-0000-0000-000000000001';

COMMIT;
```

---

## 🎯 Uso del Tenant Demo

### Para Testing Interno

- Validar flujos de reserva
- Probar agenda en diferentes escenarios
- Verificar cálculo de métricas
- Testing de búsquedas y filtros

### Para Demos Comerciales

- Mostrar dashboard poblado
- Demostrar gestión de agenda
- Exhibir perfiles de clientes VIP
- Presentar reportes con datos reales

### Para Desarrollo

- Dataset estable para pruebas de features
- Datos para validar migraciones
- Benchmark de performance
- Testing de integraciones

---

## 🔧 Personalización

### Cambiar Datos del Tenant

Editar en `seed_bookfast_demo.sql`:

```sql
INSERT INTO public.tenants (
  -- ...
  name = 'TU_NOMBRE_AQUI',
  slug = 'tu-slug',
  contact_email = 'tu@email.com',
  -- ...
)
```

### Añadir Más Servicios

```sql
INSERT INTO public.services (id, tenant_id, name, duration_min, price_cents, ...)
VALUES ('nuevo-uuid', 'bf000000...', 'Nuevo Servicio', 45, 2000, ...);
```

### Añadir Más Barberos

```sql
INSERT INTO public.staff (id, tenant_id, name, display_name, ...)
VALUES ('nuevo-uuid', 'bf000000...', 'Nombre Completo', 'Apodo', ...);

-- No olvides añadir horarios
INSERT INTO public.staff_schedules (...)
```

---

## ⚠️ Troubleshooting

### Error: "exclusion_violation"

**Causa**: Intento de crear reserva que solapa con otra

**Solución**: Normal durante generación masiva. El script maneja esto con `EXCEPTION`. Si persiste después de ejecución completa, verificar constraint EXCLUDE en `bookings`.

---

### Error: "foreign key violation"

**Causa**: Orden incorrecto de ejecución de scripts

**Solución**: Ejecutar en orden:
1. `seed_bookfast_demo.sql`
2. `seed_bookfast_assign_users.sql`
3. `seed_bookfast_bookings.sql`

---

### No aparecen datos en el panel

**Posibles causas**:

1. **Usuario no tiene membership**:
   ```sql
   SELECT * FROM public.memberships WHERE user_id = auth.uid();
   ```

2. **app.current_tenant_id() retorna NULL**:
   ```sql
   SELECT app.current_tenant_id();
   ```

3. **RLS bloqueando acceso**: Verificar políticas RLS activas

---

### Reservas no se generan

**Verificar**:

1. Staff tiene horarios configurados
2. Servicios están activos
3. Función `generate_bookfast_bookings()` se ejecutó sin errores

---

## 📊 Estadísticas Esperadas

Después de una ejecución exitosa completa:

| Métrica | Valor Esperado |
|---------|----------------|
| **Total Reservas** | 500-800 |
| **Reservas Completed** | 400-550 |
| **Reservas Confirmed** | 80-150 |
| **Clientes VIP** | 3-8 |
| **Ingresos Totales (histórico)** | 15.000€ - 25.000€ |
| **Ocupación Media** | 55-70% |
| **Ticket Medio** | 20€ - 30€ |

---

## 📝 Notas Finales

- ✅ Todos los datos son **ficticios** y seguros para demo
- ✅ No hay conflicto con datos reales de producción
- ✅ El tenant tiene ID fijo: `bf000000-0000-0000-0000-000000000001`
- ✅ Puedes ejecutar múltiples veces usando `ON CONFLICT`
- ✅ Los scripts son **idempotentes** en su mayoría

---

## 🙋 Soporte

Si encuentras problemas:

1. Verificar logs de ejecución en SQL Editor
2. Ejecutar validaciones una por una
3. Revisar constraints y triggers en baseline
4. Consultar documentación de tablas en `baseline_with_app.sql`

---

**¡Disfruta tu tenant de demo BookFast! 💈✨**

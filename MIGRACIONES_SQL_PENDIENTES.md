# 📋 Migraciones SQL Pendientes - PIA Platform

**Fecha revisión**: 2024-12-XX

---

## ✅ RESUMEN EJECUTIVO

Hay **5 migraciones críticas** que deberías ejecutar para que todo funcione correctamente:

1. **0029_add_customer_fields.sql** ⚠️ OPCIONAL (ya puede estar ejecutada)
2. **0030_simplify_cron_metrics.sql** ⚠️ OPCIONAL (solo mejora métricas)
3. **0031_add_tenant_branding.sql** ⚠️ OPCIONAL (solo añade branding)
4. **0032_add_tenant_settings.sql** ⚠️ OPCIONAL (solo añade settings)
5. **0033_add_booking_notes_and_staff_blockings.sql** 🔴 **CRÍTICA - OBLIGATORIA**

---

## 🔴 MIGRACIÓN CRÍTICA: 0033

### ¿Por qué es crítica?
- Añade campos a `bookings` que usa el modal de nueva cita:
  - `internal_notes` (notas internas)
  - `client_message` (mensaje al cliente)
  - `is_highlighted` (cita destacada)
- Crea la tabla `staff_blockings` para bloqueos/ausencias
- Configura RLS (Row Level Security) necesario para seguridad

### ¿Qué pasa si NO la ejecutas?
- ❌ El modal de nueva cita dará error al guardar (campos no existen)
- ❌ No podrás crear bloqueos/ausencias (tabla no existe)
- ❌ La funcionalidad de agenda PRO no funcionará completamente

---

## 📝 INSTRUCCIONES DE EJECUCIÓN

### Opción 1: Ejecutar solo la migración crítica (RECOMENDADO)

**En Supabase SQL Editor, ejecuta el contenido de**:
```
supabase/migrations/0033_add_booking_notes_and_staff_blockings.sql
```

**Pasos**:
1. Abre Supabase Dashboard → SQL Editor
2. Copia y pega el contenido completo del archivo `0033_add_booking_notes_and_staff_blockings.sql`
3. Ejecuta (RUN o F5)

---

### Opción 2: Ejecutar todas las migraciones pendientes (SI QUIERES COMPLETAR TODO)

Ejecuta en orden (importante el orden):

#### 1. `0029_add_customer_fields.sql`
**Verifica primero si ya está ejecutada**:
```sql
-- Verifica si los campos ya existen
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'customers' 
  AND column_name IN ('birth_date', 'notes');
```
- Si devuelve 2 filas → Ya está ejecutada ✅
- Si devuelve 0 filas → Ejecuta la migración

#### 2. `0030_simplify_cron_metrics.sql`
**Solo si usas métricas de cron**. Ejecuta si necesitas simplificar métricas.

#### 3. `0031_add_tenant_branding.sql`
**Verifica primero**:
```sql
-- Verifica si los campos ya existen
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'tenants' 
  AND column_name IN ('logo_url', 'primary_color', 'contact_email');
```
- Si devuelve filas → Ya está ejecutada ✅
- Si no → Ejecuta la migración

#### 4. `0032_add_tenant_settings.sql`
**Verifica primero**:
```sql
-- Verifica si la tabla ya existe
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'tenant_settings'
);
```
- Si devuelve `true` → Ya está ejecutada ✅
- Si devuelve `false` → Ejecuta la migración

#### 5. `0033_add_booking_notes_and_staff_blockings.sql` 🔴 **OBLIGATORIA**
**Verifica primero**:
```sql
-- Verifica si los campos en bookings ya existen
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'bookings' 
  AND column_name IN ('internal_notes', 'client_message', 'is_highlighted');

-- Verifica si la tabla staff_blockings existe
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'staff_blockings'
);
```
- Si los campos en bookings NO existen → Ejecuta la migración
- Si la tabla staff_blockings NO existe → Ejecuta la migración

---

## 🔍 VERIFICACIÓN POST-EJECUCIÓN

Después de ejecutar `0033`, verifica que todo esté correcto:

```sql
-- 1. Verificar campos en bookings
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'bookings' 
  AND column_name IN ('internal_notes', 'client_message', 'is_highlighted');

-- Debe devolver 3 filas:
-- internal_notes | text
-- client_message | text
-- is_highlighted | boolean

-- 2. Verificar tabla staff_blockings
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'staff_blockings'
ORDER BY ordinal_position;

-- Debe devolver algo como:
-- id | uuid
-- tenant_id | uuid
-- staff_id | uuid
-- start_at | timestamp with time zone
-- end_at | timestamp with time zone
-- type | text
-- reason | text
-- notes | text
-- created_at | timestamp with time zone
-- created_by | uuid

-- 3. Verificar RLS en staff_blockings
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'staff_blockings';

-- Debe devolver 2 políticas:
-- staff_blockings_read
-- staff_blockings_write

-- 4. Verificar índices
SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename = 'staff_blockings';

-- Debe devolver 2 índices:
-- idx_staff_blockings_tenant_staff_date
-- idx_staff_blockings_date_range
```

---

## ⚠️ NOTAS IMPORTANTES

### Seguridad de las migraciones
- ✅ Todas usan `IF NOT EXISTS` / `IF EXISTS` → Seguras de ejecutar múltiples veces
- ✅ No borran datos existentes
- ✅ Solo añaden campos/tablas nuevas

### Orden de ejecución
- Las migraciones 0029-0032 son independientes entre sí
- La migración 0033 **puede ejecutarse en cualquier momento** (usa `IF NOT EXISTS`)
- **IMPORTANTE**: Si ejecutas 0033 antes que las otras, no hay problema

### Si algo falla
- Revisa los mensajes de error en el SQL Editor
- Verifica que tienes permisos suficientes (deberías tenerlos si eres el admin del proyecto)
- Si hay conflictos, verifica primero qué campos/tablas ya existen con las queries de verificación

---

## 🚀 RECOMENDACIÓN FINAL

**Ejecuta primero solo `0033_add_booking_notes_and_staff_blockings.sql`** porque:
1. Es la única **crítica** para que funcione la agenda PRO
2. Las otras son mejoras opcionales que puedes ejecutar después
3. Usa `IF NOT EXISTS` → Segura de ejecutar

**Después, si quieres, ejecuta las otras 4 migraciones en orden (0029 → 0030 → 0031 → 0032).**

---

## 📁 Ubicación de archivos

Todas las migraciones están en:
```
supabase/migrations/
```

Archivos relevantes:
- `0029_add_customer_fields.sql`
- `0030_simplify_cron_metrics.sql`
- `0031_add_tenant_branding.sql`
- `0032_add_tenant_settings.sql`
- `0033_add_booking_notes_and_staff_blockings.sql` 🔴

---

**¡Listo! Ejecuta la migración 0033 y todo debería funcionar. 🎉**









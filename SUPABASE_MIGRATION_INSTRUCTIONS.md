# Instrucciones para Aplicar Migraciones en Supabase

## Migración Pendiente: `0028_p1_timezone_ui_complete.sql`

Esta migración añade soporte completo de timezone por tenant, incluyendo:
- Columna `timezone` en tabla `tenants`
- Funciones helper para timezone
- Validación de timezone
- Índices para mejorar rendimiento

## Opciones para Aplicar la Migración

### Opción 1: Usando Supabase CLI (Recomendado)

```bash
# 1. Verificar que estás conectado a tu proyecto
supabase link --project-ref <PROJECT_REF>

# 2. Aplicar migraciones pendientes
supabase db push

# 3. Verificar que la migración se aplicó correctamente
supabase db diff
```

### Opción 2: Desde Supabase Dashboard

1. **Ir a Supabase Dashboard**
   - Abre https://app.supabase.com
   - Selecciona tu proyecto

2. **Ir a SQL Editor**
   - Haz clic en "SQL Editor" en el menú lateral
   - Haz clic en "New query"

3. **Copiar y Ejecutar la Migración**
   - Abre el archivo `supabase/migrations/0028_p1_timezone_ui_complete.sql`
   - Copia todo el contenido
   - Pega en el SQL Editor
   - Haz clic en "Run" o presiona `Ctrl+Enter`

4. **Verificar que no hay errores**
   - Si hay errores, léelos cuidadosamente
   - Algunos errores pueden ser esperados (como "column already exists" si la migración ya se aplicó parcialmente)

### Opción 3: Ejecutar SQL Directamente (Paso a Paso)

Si prefieres ejecutar la migración paso a paso, puedes ejecutar cada sección por separado:

```sql
-- 1. Añadir columna timezone a tenants
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Madrid';

-- 2. Actualizar tenants existentes sin timezone
UPDATE public.tenants 
SET timezone = 'Europe/Madrid' 
WHERE timezone IS NULL OR timezone = '';

-- 3. Asegurar que timezone no puede ser null
ALTER TABLE public.tenants 
  ALTER COLUMN timezone SET DEFAULT 'Europe/Madrid',
  ALTER COLUMN timezone SET NOT NULL;

-- 4. Crear función helper para obtener timezone del tenant
CREATE OR REPLACE FUNCTION app.get_tenant_timezone(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_timezone TEXT;
BEGIN
  SELECT timezone INTO v_timezone
  FROM public.tenants
  WHERE id = p_tenant_id;
  
  RETURN COALESCE(v_timezone, 'Europe/Madrid');
END;
$$;

-- 5. Crear función helper para validar si un slot está en el pasado
CREATE OR REPLACE FUNCTION public.is_slot_in_past(
  p_tenant_id UUID,
  p_timestamp TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_tenant_tz TEXT;
  v_now_local TIMESTAMPTZ;
  v_timestamp_local TIMESTAMPTZ;
BEGIN
  -- Obtener timezone del tenant
  SELECT COALESCE(timezone, 'Europe/Madrid') INTO v_tenant_tz
  FROM public.tenants
  WHERE id = p_tenant_id;
  
  -- Calcular "ahora" en timezone del tenant
  v_now_local := NOW() AT TIME ZONE 'UTC' AT TIME ZONE v_tenant_tz;
  
  -- Convertir timestamp a timezone del tenant
  v_timestamp_local := p_timestamp AT TIME ZONE 'UTC' AT TIME ZONE v_tenant_tz;
  
  -- Verificar si está en el pasado (comparar en timezone local)
  RETURN v_timestamp_local < v_now_local;
END;
$$;

-- 6. Crear función helper para convertir timestamp a timezone del tenant
CREATE OR REPLACE FUNCTION public.to_tenant_timezone(
  p_tenant_id UUID,
  p_timestamp TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_tenant_tz TEXT;
BEGIN
  -- Obtener timezone del tenant
  SELECT COALESCE(timezone, 'Europe/Madrid') INTO v_tenant_tz
  FROM public.tenants
  WHERE id = p_tenant_id;
  
  -- Convertir a timezone del tenant
  RETURN (p_timestamp AT TIME ZONE 'UTC') AT TIME ZONE v_tenant_tz;
END;
$$;

-- 7. Crear función helper para obtener información del tenant
CREATE OR REPLACE FUNCTION public.get_tenant_info(p_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name TEXT,
  timezone TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.slug,
    t.name,
    COALESCE(t.timezone, 'Europe/Madrid') AS timezone,
    t.created_at
  FROM public.tenants t
  WHERE t.id = p_tenant_id;
END;
$$;

-- 8. Crear índice para mejorar consultas de timezone
CREATE INDEX IF NOT EXISTS idx_tenants_timezone 
  ON public.tenants(timezone) 
  WHERE timezone IS NOT NULL;

-- 9. Añadir comentarios
COMMENT ON COLUMN public.tenants.timezone IS 
  'Timezone del tenant (ej: Europe/Madrid, America/New_York). Usado para calcular slots y mostrar horarios. Debe ser un timezone válido de PostgreSQL. No puede ser null.';
```

## Verificar que la Migración se Aplicó Correctamente

### 1. Verificar que la columna timezone existe

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tenants'
  AND column_name = 'timezone';
```

**Resultado esperado**: Debe retornar una fila con `column_name = 'timezone'`, `data_type = 'text'`, `is_nullable = 'NO'`, `column_default = 'Europe/Madrid'`

### 2. Verificar que las funciones helper existen

```sql
SELECT routine_name, routine_schema
FROM information_schema.routines
WHERE routine_schema IN ('app', 'public')
  AND routine_name IN ('get_tenant_timezone', 'is_slot_in_past', 'to_tenant_timezone', 'get_tenant_info');
```

**Resultado esperado**: Debe retornar 4 filas, una por cada función

### 3. Verificar que el índice existe

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'tenants'
  AND indexname = 'idx_tenants_timezone';
```

**Resultado esperado**: Debe retornar una fila con el índice

### 4. Probar las funciones helper

```sql
-- Probar get_tenant_timezone
SELECT app.get_tenant_timezone('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
-- Debe retornar 'Europe/Madrid' o el timezone configurado

-- Probar is_slot_in_past
SELECT public.is_slot_in_past(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '2024-01-01T10:00:00Z'
);
-- Debe retornar true o false

-- Probar to_tenant_timezone
SELECT public.to_tenant_timezone(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '2024-12-31T10:00:00Z'
);
-- Debe retornar un timestamp en timezone del tenant
```

### 5. Verificar que los tenants tienen timezone

```sql
SELECT id, name, timezone
FROM public.tenants
LIMIT 10;
```

**Resultado esperado**: Todas las filas deben tener un valor en `timezone` (no null)

## Troubleshooting

### Error: "column timezone already exists"

**Solución**: Esto significa que la columna ya existe. Puedes saltarte esa parte de la migración o verificar que el resto de la migración se aplica correctamente.

### Error: "function app.get_tenant_timezone already exists"

**Solución**: Esto significa que la función ya existe. Puedes usar `CREATE OR REPLACE FUNCTION` en lugar de `CREATE FUNCTION`, o verificar que la función existente es correcta.

### Error: "timezone does not exist"

**Solución**: Verifica que el timezone es válido en PostgreSQL. Ejecuta:

```sql
SELECT * FROM pg_timezone_names WHERE name = 'Europe/Madrid';
```

Si no retorna resultados, el timezone no es válido. Usa un timezone válido de la lista:

```sql
SELECT name FROM pg_timezone_names ORDER BY name;
```

### Error: "permission denied"

**Solución**: Asegúrate de que tienes permisos para crear funciones y modificar tablas. Si estás usando Supabase Dashboard, deberías tener permisos por defecto.

## Próximos Pasos

Después de aplicar la migración:

1. **Verificar que la UI funciona correctamente**
   - Ir a `/panel/agenda` y verificar que las horas se muestran correctamente
   - Ir a `/r/[orgId]` y verificar que los slots se muestran correctamente
   - Ir a `/admin/[orgId]` y verificar que se puede gestionar el timezone

2. **Configurar timezone para tenants existentes**
   - Si tienes tenants existentes, puedes actualizar su timezone desde el admin panel
   - O ejecutar SQL directamente:

```sql
UPDATE public.tenants
SET timezone = 'Europe/Madrid'
WHERE timezone IS NULL OR timezone = '';
```

3. **Probar los endpoints API**
   - Probar `GET /api/tenants/[tenantId]/timezone`
   - Probar `PUT /api/admin/tenants/[orgId]/timezone` (requiere autenticación)

## Contacto

Si tienes problemas aplicando la migración, consulta:
- `DEPLOYMENT_CHECKLIST.md` - Checklist completo de despliegue
- `README_DEPLOY.md` - Guía de despliegue rápida
- `docs/P1_TIMEZONE_COMPLETE_FINAL.md` - Documentación completa de timezone










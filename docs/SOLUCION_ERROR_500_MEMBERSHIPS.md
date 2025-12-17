# Solución al Error 500 al Consultar Memberships

## 🔴 Problema

Al intentar acceder a `/panel`, se produce un error 500 al consultar la tabla `memberships`:

```
Failed to load resource: the server responded with a status of 500 ()
/rest/v1/memberships?select=tenant_id%2Crole&user_id=eq.db57dbd2-9a8c-4050-b77f-e2236300f448
```

El mensaje en consola muestra:
```
[PanelLayout] Error cargando membership: {}
```

## 🔍 Causa Raíz

El error 500 se debe a que las **políticas RLS (Row Level Security)** de la tabla `memberships` están fallando o la tabla no existe correctamente. Esto puede ocurrir por:

1. **Tabla `memberships` no existe**: La tabla no se creó correctamente en las migraciones.
2. **Políticas RLS incorrectas**: Las políticas están causando un error interno al evaluarse.
3. **RLS no habilitado**: La tabla existe pero RLS no está habilitado.
4. **Políticas conflictivas**: Hay múltiples políticas que se contradicen.

## ✅ Solución: Script Completo

He creado un script completo que corrige **TODO** lo necesario:

**📄 Archivo**: `scripts/fix-memberships-table-and-rls.sql`

### Pasos para Ejecutar

1. **Abre el SQL Editor de Supabase**:
   - Ve a tu proyecto en Supabase Dashboard
   - Navega a **SQL Editor** (menú lateral)
   - Haz clic en **New Query**

2. **Ejecuta el script de corrección**:
   - Abre el archivo `scripts/fix-memberships-table-and-rls.sql`
   - Copia todo el contenido
   - Pégalo en el SQL Editor
   - Haz clic en **Run** (o presiona `Ctrl+Enter`)

3. **Vincula tu usuario al tenant demo**:
   - Abre el archivo `scripts/link-user-to-tenant-simple.sql`
   - Copia todo el contenido
   - Pégalo en el SQL Editor
   - Haz clic en **Run**

4. **Recarga la página `/panel`**:
   - Vuelve al navegador
   - Recarga la página `/panel`
   - El error 500 debería desaparecer

## 📋 Qué Hace el Script

El script `fix-memberships-table-and-rls.sql` realiza las siguientes acciones:

### 1. Crea la tabla `memberships` si no existe
- Estructura completa con todas las columnas necesarias
- Constraints y foreign keys
- Índices para optimizar consultas

### 2. Habilita RLS
- Asegura que RLS esté habilitado en la tabla

### 3. Elimina políticas problemáticas
- Elimina todas las políticas existentes para empezar limpio

### 4. Crea políticas RLS simples y seguras
- `users_read_own_memberships`: Usuarios pueden leer sus propios memberships
- `users_read_tenant_memberships`: Usuarios pueden leer memberships de su tenant
- `admins_manage_memberships`: Admins/owners pueden gestionar memberships de su tenant

### 5. Verificación
- Verifica que las políticas se crearon correctamente
- Verifica la estructura de la tabla
- Verifica que RLS está habilitado
- Muestra un resumen final

## 🔧 Verificación Manual

Si después de ejecutar el script sigue habiendo problemas, verifica manualmente:

### 1. Verificar que la tabla existe

```sql
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'memberships';
```

**Si no existe**: El script debería haberla creado. Si no, ejecuta manualmente:

```sql
CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','staff','viewer')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);
```

### 2. Verificar que RLS está habilitado

```sql
SELECT tablename, rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'memberships';
```

**Si no está habilitado**: Ejecuta:

```sql
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
```

### 3. Verificar que las políticas existen

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'memberships';
```

**Si no existen**: Ejecuta el script `fix-memberships-table-and-rls.sql` completo.

### 4. Verificar que el membership existe

```sql
SELECT m.*, t.name as tenant_name, u.email as user_email
FROM public.memberships m
JOIN public.tenants t ON t.id = m.tenant_id
JOIN auth.users u ON u.id = m.user_id
WHERE u.email = 'u0136986872@gmail.com';
```

**Si no existe**: Ejecuta el script `link-user-to-tenant-simple.sql`.

## 🐛 Debugging Mejorado

He mejorado el logging en `app/panel/layout.tsx` para mostrar más detalles del error:

```typescript
console.error("[PanelLayout] Detalles completos:", JSON.stringify({
  user_id: user.id,
  email: user.email,
  error_code: membershipError.code,
  error_message: membershipError.message,
  error_details: membershipError.details,
  error_hint: membershipError.hint,
}, null, 2));
```

Ahora verás en la consola:
- El código de error específico
- El mensaje de error completo
- Detalles adicionales (si están disponibles)
- Hints de PostgreSQL (si están disponibles)

## 📝 Orden de Ejecución de Scripts

Si necesitas ejecutar múltiples scripts, hazlo en este orden:

1. **Primero**: `scripts/fix-memberships-table-and-rls.sql`
   - Crea la tabla y corrige las políticas RLS

2. **Segundo**: `scripts/link-user-to-tenant-simple.sql`
   - Vincula tu usuario al tenant demo

3. **Opcional**: `scripts/verificar-membership.sql`
   - Verifica que todo está correcto

## ✅ Checklist Final

Después de ejecutar los scripts, verifica que:

- [ ] El script `fix-memberships-table-and-rls.sql` se ejecutó sin errores
- [ ] El script `link-user-to-tenant-simple.sql` se ejecutó sin errores
- [ ] La tabla `memberships` existe
- [ ] RLS está habilitado en `memberships`
- [ ] Las políticas RLS existen (al menos 3)
- [ ] El membership existe para tu usuario
- [ ] La página `/panel` carga correctamente sin error 500

Si todos los checks están ✅, el problema debería estar resuelto. Si no, comparte los mensajes de error de la consola (ahora con más detalles) para diagnosticar mejor.

## 🔗 Archivos Relacionados

- `scripts/fix-memberships-table-and-rls.sql` - Script completo de corrección
- `scripts/link-user-to-tenant-simple.sql` - Script para vincular usuario
- `scripts/verificar-membership.sql` - Script de verificación
- `app/panel/layout.tsx` - Layout con logging mejorado









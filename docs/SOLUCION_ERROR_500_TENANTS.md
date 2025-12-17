# Solución al Error 500 al Consultar Tenants

## 🔴 Problema

Al intentar acceder a `/panel`, se produce un error 500 al consultar la tabla `tenants`:

```
Failed to load resource: the server responded with a status of 500 ()
/rest/v1/tenants?select=id%2Cname%2Cslug%2Ctimezone&id=eq.aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
```

## 🔍 Causa Raíz

El error 500 se debe a que las **políticas RLS (Row Level Security)** de la tabla `tenants` están fallando. Esto puede ocurrir por:

1. **Políticas RLS incorrectas**: La política intenta usar funciones o tablas que no existen o fallan.
2. **Función `app.current_tenant_id()` desactualizada**: La función busca en `public.users` en lugar de `public.memberships`.
3. **Tabla `memberships` no existe**: El usuario no tiene un registro en `memberships` que lo vincule al tenant.

## ✅ Solución: Script Completo

He creado un script completo que verifica y corrige **TODO** lo necesario:

**📄 Archivo**: `scripts/verificar-y-corregir-base-datos-completo.sql`

### Pasos para Ejecutar

1. **Abre el SQL Editor de Supabase**:
   - Ve a tu proyecto en Supabase Dashboard
   - Navega a **SQL Editor** (menú lateral)
   - Haz clic en **New Query**

2. **Copia y pega el script completo**:
   - Abre el archivo `scripts/verificar-y-corregir-base-datos-completo.sql`
   - Copia todo el contenido
   - Pégalo en el SQL Editor

3. **Ejecuta el script**:
   - Haz clic en **Run** (o presiona `Ctrl+Enter`)
   - Espera a que termine la ejecución

4. **Revisa los mensajes**:
   - El script mostrará mensajes de verificación
   - Busca la sección "VERIFICACIÓN FINAL" al final
   - Deberías ver todos los checks con ✅

5. **Recarga la página `/panel`**:
   - Vuelve al navegador
   - Recarga la página `/panel`
   - El error 500 debería desaparecer

## 📋 Qué Hace el Script

El script realiza las siguientes acciones:

### 1. Crea el esquema `app` si no existe
- Necesario para las funciones helper

### 2. Verifica y crea la tabla `tenants`
- Crea la tabla si no existe
- Añade columnas faltantes (`slug`, `timezone`)
- Genera slugs únicos para tenants sin slug
- Crea índices necesarios

### 3. Verifica y crea la tabla `memberships`
- Crea la tabla si no existe
- Crea índices necesarios
- Habilita RLS
- Crea políticas RLS básicas

### 4. Actualiza la función `app.current_tenant_id()`
- Prioriza buscar en `memberships` (nuevo sistema)
- Mantiene compatibilidad con `users` (sistema antiguo)
- Usa `SECURITY DEFINER` para acceder a `auth.uid()`

### 5. Corrige las políticas RLS de `tenants`
- Elimina políticas problemáticas
- Crea una política simple que usa `memberships` directamente
- No depende de funciones que puedan fallar

### 6. Crea el tenant demo si no existe
- ID: `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`
- Slug: `barberia-demo`
- Nombre: `Barbería Demo`
- Timezone: `Europe/Madrid`

### 7. Vincula el usuario de prueba al tenant demo
- Busca el usuario por email: `u0136986872@gmail.com`
- Crea un `membership` con rol `owner`
- Si ya existe, actualiza el rol a `owner`

### 8. Verificación final
- Verifica que todo esté correcto
- Muestra un resumen con ✅ o ❌ para cada elemento
- Muestra el estado actual del tenant y membership

## 🔧 Verificación Manual

Si después de ejecutar el script sigue habiendo problemas, verifica manualmente:

### 1. Verificar que el usuario existe en `auth.users`

```sql
SELECT id, email, created_at
FROM auth.users
WHERE email = 'u0136986872@gmail.com';
```

**Si no existe**: Crea el usuario desde el panel de Supabase (Authentication > Users) o usa el endpoint `/api/auth/dev-login` en desarrollo.

### 2. Verificar que el tenant demo existe

```sql
SELECT id, name, slug, timezone
FROM public.tenants
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
```

**Si no existe**: Ejecuta la migración `0019_seed_booking_demo.sql` o crea el tenant manualmente.

### 3. Verificar que el membership existe

```sql
SELECT m.*, t.name as tenant_name, u.email as user_email
FROM public.memberships m
JOIN public.tenants t ON t.id = m.tenant_id
JOIN auth.users u ON u.id = m.user_id
WHERE u.email = 'u0136986872@gmail.com';
```

**Si no existe**: El script debería haberlo creado. Si no, ejecuta manualmente:

```sql
INSERT INTO public.memberships (tenant_id, user_id, role)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  (SELECT id FROM auth.users WHERE email = 'u0136986872@gmail.com'),
  'owner'
)
ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'owner';
```

### 4. Verificar que la función existe

```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'app'
AND routine_name = 'current_tenant_id';
```

**Si no existe**: El script debería haberla creado. Si no, ejecuta la migración `0025_p1_rls_complete.sql`.

### 5. Verificar que la política RLS existe

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'tenants'
AND policyname = 'tenant_read_tenants';
```

**Si no existe**: El script debería haberla creado. Si no, ejecuta:

```sql
CREATE POLICY "tenant_read_tenants" ON public.tenants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.memberships 
    WHERE memberships.user_id = auth.uid()
      AND memberships.tenant_id = tenants.id
  )
);
```

## 🐛 Debugging

Si el problema persiste, activa los logs en el navegador:

1. Abre la consola del navegador (F12)
2. Ve a la pestaña **Console**
3. Busca los logs que empiezan con:
   - `🔍 Iniciando carga de tenant...`
   - `✅ Usuario autenticado:`
   - `✅ Membership encontrado:`
   - `✅ Tenant cargado:`

4. Si ves errores, comparte los mensajes para diagnosticar mejor.

## 📝 Notas Importantes

- **El script es idempotente**: Puedes ejecutarlo múltiples veces sin problemas.
- **No elimina datos existentes**: Solo crea o actualiza lo necesario.
- **Requiere permisos de administrador**: Ejecuta el script con un usuario con permisos suficientes (service_role o admin).

## 🔗 Archivos Relacionados

- `scripts/verificar-y-corregir-base-datos-completo.sql` - Script completo de verificación y corrección
- `scripts/create-memberships-and-link-user.sql` - Script específico para crear memberships
- `scripts/fix-tenants-rls-simple.sql` - Script específico para corregir RLS de tenants
- `scripts/fix-current-tenant-id-and-rls.sql` - Script específico para corregir la función y RLS

## ✅ Checklist Final

Después de ejecutar el script, verifica que:

- [ ] El script se ejecutó sin errores
- [ ] La verificación final muestra todos los checks con ✅
- [ ] El usuario existe en `auth.users`
- [ ] El tenant demo existe en `public.tenants`
- [ ] El membership existe en `public.memberships`
- [ ] La función `app.current_tenant_id()` existe
- [ ] La política RLS `tenant_read_tenants` existe
- [ ] La página `/panel` carga correctamente sin error 500

Si todos los checks están ✅, el problema debería estar resuelto. Si no, comparte los mensajes de error para diagnosticar mejor.









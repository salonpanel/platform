# 🔧 Solución: Membership Existe pero No se Puede Acceder

## Problema

El membership se creó correctamente en la base de datos, pero al iniciar sesión sigue apareciendo:
> "No tienes acceso a ninguna barbería"

## Causas Posibles

1. **Políticas RLS bloqueando el acceso** - Las políticas no permiten que el usuario vea su propio membership
2. **Sesión no válida** - El token de autenticación no está funcionando correctamente
3. **Error silencioso** - La consulta falla pero no se muestra el error

## Solución Paso a Paso

### Paso 1: Verificar que el Membership Existe

Ejecuta en SQL Editor:

```sql
SELECT 
  m.id,
  m.tenant_id,
  m.user_id,
  m.role,
  t.name as tenant_name,
  u.email as user_email
FROM public.memberships m
JOIN public.tenants t ON t.id = m.tenant_id
JOIN auth.users u ON u.id = m.user_id
WHERE u.email = 'u0136986872@gmail.com';
```

**Si no retorna resultados**: El membership no existe, ejecuta `scripts/create-memberships-and-link-user.sql`

**Si retorna resultados**: Continúa con el Paso 2.

### Paso 2: Corregir Políticas RLS

Ejecuta el script `scripts/fix-memberships-rls.sql` que:
- Elimina políticas conflictivas
- Crea la política `users_read_own_memberships` que permite a los usuarios ver sus propios memberships
- Crea políticas para admins

### Paso 3: Verificar desde el Navegador

1. **Abre la consola del navegador** (F12)
2. **Ve a la pestaña Console**
3. **Recarga la página** `/panel`
4. **Busca mensajes de error** que empiecen con:
   - "Error al cargar membership:"
   - "No se encontró membership para el usuario:"

### Paso 4: Probar Consulta Directa desde el Cliente

Abre la consola del navegador y ejecuta:

```javascript
// Obtener el cliente de Supabase
const supabase = window.supabase || (await import('@supabase/supabase-js')).createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Verificar usuario
const { data: { user }, error: userError } = await supabase.auth.getUser();
console.log('Usuario:', user);
console.log('Error usuario:', userError);

// Intentar leer memberships
const { data: memberships, error: membershipError } = await supabase
  .from('memberships')
  .select('tenant_id, role')
  .eq('user_id', user.id);

console.log('Memberships:', memberships);
console.log('Error membership:', membershipError);
```

**Si `membershipError` no es null**: Es un problema de RLS. Ejecuta `scripts/fix-memberships-rls.sql`

**Si `memberships` es un array vacío**: El membership no existe o RLS lo está bloqueando.

### Paso 5: Verificar Políticas RLS Actuales

Ejecuta en SQL Editor:

```sql
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'memberships';
```

**Debe haber al menos una política** `users_read_own_memberships` con:
- `cmd = 'SELECT'`
- `qual` debe contener `auth.uid() = user_id` o similar

## Solución Rápida (Todo en Uno)

Ejecuta este script completo en SQL Editor:

```sql
-- 1. Eliminar políticas existentes
DROP POLICY IF EXISTS "users_read_own_memberships" ON public.memberships;
DROP POLICY IF EXISTS "admins_manage_memberships" ON public.memberships;
DROP POLICY IF EXISTS "users_read_tenant_memberships" ON public.memberships;

-- 2. Crear política simple: usuarios ven sus propios memberships
CREATE POLICY "users_read_own_memberships" ON public.memberships
FOR SELECT
USING (auth.uid() = user_id);

-- 3. Verificar que se creó
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'memberships';
```

Luego:
1. **Cierra sesión** en la aplicación
2. **Inicia sesión** nuevamente
3. **Accede a `/panel`**

## Si Aún No Funciona

1. **Verifica los logs en la consola del navegador** (F12 > Console)
2. **Comparte los errores** que aparezcan
3. **Verifica que el usuario existe** en Supabase Dashboard > Authentication > Users
4. **Verifica que el tenant demo existe** ejecutando:
   ```sql
   SELECT * FROM public.tenants WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
   ```

---

**Última actualización**: 2024-11-14







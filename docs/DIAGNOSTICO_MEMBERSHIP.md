# 🔍 Diagnóstico de Problemas con Membership

## Problema: "No tienes acceso a ninguna barbería"

Aunque el membership se haya creado, puede haber varios problemas:

## Pasos de Diagnóstico

### 1. Verificar que el Membership Existe

Ejecuta en SQL Editor:

```sql
-- Verificar membership
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

**Resultado esperado**: Debe mostrar una fila con el membership.

### 2. Verificar Políticas RLS

Ejecuta:

```sql
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'memberships';
```

**Resultado esperado**: Debe haber al menos una política `users_read_own_memberships` con `cmd = 'SELECT'`.

### 3. Corregir Políticas RLS

Si las políticas no existen o están mal configuradas, ejecuta:

```sql
-- Eliminar políticas existentes
DROP POLICY IF EXISTS "users_read_own_memberships" ON public.memberships;
DROP POLICY IF EXISTS "admins_manage_memberships" ON public.memberships;

-- Crear política para que usuarios vean sus propios memberships
CREATE POLICY "users_read_own_memberships" ON public.memberships
FOR SELECT
USING (auth.uid() = user_id);

-- Política para admins
CREATE POLICY "admins_manage_memberships" ON public.memberships
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.memberships m2
    WHERE m2.user_id = auth.uid()
    AND m2.tenant_id = memberships.tenant_id
    AND m2.role IN ('owner', 'admin')
  )
);
```

### 4. Verificar desde el Cliente

Abre la consola del navegador (F12) y ejecuta:

```javascript
// Verificar que estás autenticado
const { data: { user } } = await supabase.auth.getUser();
console.log('Usuario:', user?.id, user?.email);

// Intentar leer memberships
const { data: memberships, error } = await supabase
  .from('memberships')
  .select('tenant_id, role')
  .eq('user_id', user.id);

console.log('Memberships:', memberships);
console.log('Error:', error);
```

**Si hay error**: Puede ser un problema de RLS o sesión.

### 5. Verificar Sesión

Asegúrate de que:
- Estás autenticado correctamente
- La sesión no ha expirado
- El token de autenticación es válido

**Solución**: Cierra sesión y vuelve a iniciar sesión.

## Soluciones Comunes

#### Problema 1: RLS Bloqueando Acceso

**Síntoma**: El membership existe pero la consulta retorna null.

**Solución**: Ejecuta `scripts/fix-memberships-rls.sql`

#### Problema 2: Sesión Expirada

**Síntoma**: `getUser()` retorna null.

**Solución**: Cierra sesión y vuelve a iniciar sesión.

#### Problema 3: Membership No Existe

**Síntoma**: La consulta de verificación no retorna resultados.

**Solución**: Ejecuta `scripts/create-memberships-and-link-user.sql` nuevamente.

#### Problema 4: Tenant No Existe

**Síntoma**: El membership existe pero el tenant no.

**Solución**: Aplica las migraciones de seeds (`0019_seed_booking_demo.sql`).

## Scripts de Diagnóstico

- `scripts/verificar-membership.sql` - Verifica que todo existe
- `scripts/fix-memberships-rls.sql` - Corrige políticas RLS
- `scripts/create-memberships-and-link-user.sql` - Crea membership completo

---

**Última actualización**: 2024-11-14







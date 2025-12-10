# 🔧 FIX: Menú Sidebar - Permisos para Owner/Admin

## 🐛 Problema

Los usuarios con rol `owner` o `admin` solo ven 4 opciones en el menú sidebar:
- ✅ Dashboard
- ✅ Agenda
- ✅ Clientes
- ✅ Chat

**Faltan:**
- ❌ Servicios
- ❌ Staff
- ❌ Marketing
- ❌ Monedero
- ❌ Ajustes

## 🔍 Causa

La función `get_user_role_and_permissions` devuelve permisos restrictivos por defecto **incluso para usuarios owner/admin**, porque no verifica el rol antes de aplicar los permisos.

## ✅ Solución

Modificar la función SQL para que **automáticamente devuelva permisos completos** cuando el rol es `owner` o `admin`.

---

## 🚀 OPCIÓN 1: Aplicar con Script (RECOMENDADO)

### Windows (PowerShell)

```powershell
cd supabase/migrations
.\apply_fix_permissions.ps1 -Host db.xxx.supabase.co -User postgres -Database postgres
```

### Linux/Mac (Bash)

```bash
cd supabase/migrations
psql -h db.xxx.supabase.co -U postgres -d postgres -f 0110_fix_permissions_owner_admin.sql
```

---

## 🚀 OPCIÓN 2: Aplicar Manualmente en Supabase Dashboard

### Paso 1: Abrir SQL Editor

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto
3. Menú lateral → **SQL Editor**
4. Click en **New query**

### Paso 2: Copiar y Pegar SQL

Copia **TODO** el contenido del archivo `0110_fix_permissions_owner_admin.sql`:

```sql
-- Fix: get_user_role_and_permissions - Devolver permisos completos para owner/admin
-- Fecha: 2025-12-10
-- Problema: Los usuarios owner/admin no veían todas las opciones del menú
-- Solución: Devolver permisos completos automáticamente para estos roles

create or replace function public.get_user_role_and_permissions(
  p_user_id uuid,
  p_tenant_id uuid
)
returns table (
  role text,
  permissions jsonb
) language sql stable as $$
  select 
    m.role,
    case 
      -- Si es owner o admin, devolver permisos completos
      when m.role in ('owner', 'admin') then 
        '{"dashboard":true,"agenda":true,"clientes":true,"servicios":true,"staff":true,"marketing":true,"reportes":true,"ajustes":true}'::jsonb
      -- Para otros roles, usar permisos de la tabla o permisos por defecto restrictivos
      else
        coalesce(up.permissions, '{"dashboard":true,"agenda":true,"clientes":true,"servicios":false,"staff":false,"marketing":false,"reportes":false,"ajustes":false}'::jsonb)
    end as permissions
  from public.memberships m
  left join public.user_permissions up
    on up.user_id = m.user_id and up.tenant_id = m.tenant_id
  where m.user_id = p_user_id and m.tenant_id = p_tenant_id
  limit 1;
$$;

comment on function public.get_user_role_and_permissions is 'Devuelve el rol y los permisos del usuario para un tenant. Los roles owner/admin reciben automáticamente permisos completos.';
```

### Paso 3: Ejecutar

1. Click en **Run** (o presiona `Ctrl+Enter`)
2. Deberías ver: `Success. No rows returned`

---

## 🧪 Verificación

### 1. Verificar la función actualizada

En SQL Editor, ejecuta:

```sql
-- Reemplazar USER_ID y TENANT_ID con valores reales de un usuario owner
SELECT * FROM get_user_role_and_permissions(
  'REEMPLAZAR_USER_ID'::uuid,
  'REEMPLAZAR_TENANT_ID'::uuid
);
```

**Resultado esperado:**
```json
{
  "role": "owner",
  "permissions": {
    "dashboard": true,
    "agenda": true,
    "clientes": true,
    "servicios": true,   ← DEBE SER TRUE
    "staff": true,        ← DEBE SER TRUE
    "marketing": true,    ← DEBE SER TRUE
    "reportes": true,     ← DEBE SER TRUE
    "ajustes": true       ← DEBE SER TRUE
  }
}
```

### 2. Verificar en el navegador

1. **Refresca la página** del panel (Ctrl+Shift+R o Cmd+Shift+R)
2. Si no funciona, **cierra sesión** y vuelve a entrar
3. Deberías ver **todas** las opciones del menú:
   - ✅ Dashboard
   - ✅ Agenda
   - ✅ Clientes
   - ✅ **Servicios** (nuevo)
   - ✅ **Staff** (nuevo)
   - ✅ **Monedero** (nuevo)
   - ✅ **Marketing** (nuevo)
   - ✅ Chat
   - ✅ **Ajustes** (nuevo)

### 3. Debug en la consola

Si aún no aparecen, abre la consola del navegador (F12) y ejecuta:

```javascript
// Ver permisos actuales
console.log('Permisos:', window.localStorage.getItem('permissions'));

// Forzar recarga de permisos
window.localStorage.removeItem('permissions');
window.location.reload();
```

---

## 🔄 Rollback (Si necesitas revertir)

Si algo sale mal, puedes revertir a la versión anterior:

```sql
create or replace function public.get_user_role_and_permissions(
  p_user_id uuid,
  p_tenant_id uuid
)
returns table (
  role text,
  permissions jsonb
) language sql stable as $$
  select m.role,
         coalesce(up.permissions, '{"dashboard":true,"agenda":true,"clientes":true,"servicios":false,"staff":false,"marketing":false,"reportes":false,"ajustes":false}'::jsonb) as permissions
  from public.memberships m
  left join public.user_permissions up
    on up.user_id = m.user_id and up.tenant_id = m.tenant_id
  where m.user_id = p_user_id and m.tenant_id = p_tenant_id
  limit 1;
$$;
```

---

## 📚 Archivos Relacionados

- **Migración:** `supabase/migrations/0110_fix_permissions_owner_admin.sql`
- **Script PowerShell:** `supabase/migrations/apply_fix_permissions.ps1`
- **Función original:** `supabase/migrations/0102_get_user_role_and_permissions.sql` (actualizada)
- **Debug SQL:** `supabase/migrations/debug_permissions.sql`

---

## 💡 Notas Técnicas

### ¿Por qué pasaba esto?

La función `get_user_role_and_permissions` tenía esta lógica:

```sql
-- ANTES (❌ MALO)
coalesce(up.permissions, '{"servicios":false,"staff":false,...}')
```

Esto significa:
- Si existe un registro en `user_permissions` → usar esos permisos
- Si NO existe → usar permisos restrictivos **PARA TODOS** (incluyendo owner/admin)

### ¿Qué hace el fix?

Ahora la función verifica el rol primero:

```sql
-- DESPUÉS (✅ BUENO)
case 
  when m.role in ('owner', 'admin') then 
    '{"dashboard":true,"agenda":true,...,"servicios":true,"staff":true,...}'
  else
    coalesce(up.permissions, '{"servicios":false,"staff":false,...}')
end
```

Esto significa:
- Si es `owner` o `admin` → **siempre** permisos completos
- Si es otro rol → usar tabla `user_permissions` o restrictivos por defecto

### ¿Afecta a otros roles?

**NO**. El fix solo afecta a usuarios con rol `owner` o `admin`. Los demás roles (employee, viewer, etc.) siguen usando la tabla `user_permissions` como antes.

---

## ✅ Checklist de Aplicación

- [ ] Script ejecutado O SQL aplicado manualmente
- [ ] Función verificada con query de prueba
- [ ] Usuario owner refresca la página
- [ ] Todas las opciones del menú visibles
- [ ] Commit y push del fix al repositorio

---

**Versión:** 1.0.0  
**Fecha:** 2025-12-10  
**Autor:** GitHub Copilot  
**Ticket:** Fix sidebar menu permissions for owner/admin users

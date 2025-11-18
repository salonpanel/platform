# 🔗 Vincular Usuario al Tenant Demo

## Problema

Al iniciar sesión con `u0136986872@gmail.com`, aparece el mensaje:
> "No tienes acceso a ninguna barbería"

Esto ocurre porque el usuario no tiene un `membership` que lo vincule al tenant demo.

## Solución

### ⚠️ IMPORTANTE: Si obtienes error "relation memberships does not exist"

**Causa**: Las migraciones de Supabase no se han aplicado. La tabla `memberships` se crea en la migración `0018_booking_system_complete.sql`.

**Solución rápida**: Usa el script `scripts/create-memberships-and-link-user.sql` que:
1. Crea la tabla `memberships` si no existe
2. Crea los índices necesarios
3. Configura las políticas RLS básicas
4. Vincula el usuario al tenant demo

### Opción 1: Ejecutar Script SQL Completo (Recomendado si memberships no existe)

1. **Abre el SQL Editor de Supabase:**
   - Ve a tu proyecto en Supabase Dashboard
   - Navega a SQL Editor

2. **Ejecuta el script completo** (`scripts/create-memberships-and-link-user.sql`):
   ```sql
   -- Vincular usuario al tenant demo
   DO $$
   DECLARE
     v_user_id uuid;
     v_tenant_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; -- ID del tenant demo
   BEGIN
     -- Buscar el usuario por email
     SELECT id INTO v_user_id
     FROM auth.users
     WHERE email = 'u0136986872@gmail.com';

     -- Si no se encuentra el usuario, mostrar error
     IF v_user_id IS NULL THEN
       RAISE EXCEPTION 'Usuario con email u0136986872@gmail.com no encontrado en auth.users';
     END IF;

     -- Crear membership si no existe
     INSERT INTO public.memberships (tenant_id, user_id, role)
     VALUES (v_tenant_id, v_user_id, 'owner')
     ON CONFLICT (tenant_id, user_id) 
     DO UPDATE SET role = 'owner';

     RAISE NOTICE 'Usuario % vinculado al tenant demo con rol owner', v_user_id;
   END $$;
   ```

3. **Verificar que se creó correctamente:**
   ```sql
   SELECT 
     m.id,
     m.tenant_id,
     m.user_id,
     m.role,
     t.name as tenant_name,
     t.slug as tenant_slug,
     u.email as user_email
   FROM public.memberships m
   JOIN public.tenants t ON t.id = m.tenant_id
   JOIN auth.users u ON u.id = m.user_id
   WHERE u.email = 'u0136986872@gmail.com';
   ```

### Opción 2: Usar el Script del Proyecto

1. **Abre el archivo:**
   ```
   scripts/link-user-to-demo-tenant.sql
   ```

2. **Copia el contenido** y ejecútalo en el SQL Editor de Supabase

3. **Si quieres vincular otro usuario**, cambia el email en el script:
   ```sql
   WHERE email = 'otro-email@ejemplo.com';
   ```

## Verificación

Después de ejecutar el script:

1. **Cierra sesión** en la aplicación
2. **Inicia sesión** nuevamente con `u0136986872@gmail.com`
3. **Accede a `/panel`** - Deberías ver el panel de la barbería demo

## Información del Tenant Demo

- **ID**: `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`
- **Slug**: `barberia-demo` o `demo-barber`
- **Nombre**: "Barbería Demo" o "Demo Barber"
- **Timezone**: `Europe/Madrid`

## Solución Permanente

Para evitar este problema en el futuro, puedes:

1. **Modificar el trigger `handle_new_user`** para que automáticamente vincule nuevos usuarios al tenant demo (solo en desarrollo)
2. **Crear un endpoint de API** que permita vincular usuarios al tenant demo desde el panel de admin
3. **Usar el panel de admin** (`/admin`) para crear tenants y asignar usuarios

## Notas

- El rol `owner` da acceso completo al tenant
- Un usuario puede tener múltiples memberships (pertenecer a varios tenants)
- El sistema usa `memberships` para determinar a qué tenant(s) tiene acceso un usuario

---

**Última actualización**: 2024-11-14


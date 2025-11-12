# Configuración del Primer Platform Admin

Esta guía te ayudará a crear el primer usuario platform admin para acceder al panel de administración.

## 📋 Prerequisitos

- Usuario creado en Supabase Authentication (`auth.users`)
- Acceso al SQL Editor de Supabase
- UUID del usuario de `auth.users`

## 🚀 Pasos para Crear el Primer Platform Admin

### Opción 1: Desde el SQL Editor (Recomendado)

1. **Obtén el UUID de tu usuario**:
   - Ve a Supabase Dashboard > Authentication > Users
   - Encuentra tu usuario y copia su UUID

2. **Ejecuta este SQL en el SQL Editor**:

```sql
-- Reemplaza estos valores con los de tu usuario
INSERT INTO platform.platform_users (id, email, name, role, active)
VALUES (
  'f8bb3d24-342f-4468-9aa4-2f25350f4c29', -- UUID del usuario de auth.users
  'josepcalafat@icloud.com', -- Tu email
  'Josep Calafat Aloy', -- Tu nombre
  'admin', -- Rol: 'admin', 'support', o 'viewer'
  true -- Activo
);
```

3. **Verifica que se creó correctamente**:

```sql
SELECT * FROM platform.platform_users WHERE id = 'f8bb3d24-342f-4468-9aa4-2f25350f4c29';
```

### Opción 2: Desde la UI (Requiere al menos un admin existente)

1. Inicia sesión con un usuario que ya sea platform admin
2. Ve a `/admin/platform-users`
3. Haz clic en "Crear Platform User"
4. Completa el formulario:
   - **User ID**: UUID del usuario de `auth.users`
   - **Email**: Email del usuario
   - **Nombre**: Nombre del administrador
   - **Rol**: Selecciona 'admin', 'support', o 'viewer'

### Opción 3: Usando la Función RPC

```sql
-- Ejecuta en SQL Editor
SELECT public.create_platform_admin(
  'TU_USER_ID_AQUI'::uuid,
  'tu-email@ejemplo.com',
  'Administrador Principal',
  'admin'
);
```

## 🔐 Roles Disponibles

- **admin**: Acceso completo a todas las funcionalidades de administración
- **support**: Acceso limitado para soporte técnico
- **viewer**: Solo lectura, sin permisos de modificación

## ✅ Verificación

Después de crear el platform admin:

1. **Cierra sesión** si estás logueado
2. **Inicia sesión** con el usuario que acabas de vincular
3. **Accede a `/admin`** - Deberías ver el panel de administración
4. Si ves un error de "No autorizado", verifica:
   - Que el usuario existe en `auth.users`
   - Que el UUID coincide exactamente
   - Que `active = true` en `platform.platform_users`

## 🐛 Solución de Problemas

### Error: "No autorizado" al acceder a /admin

**Causas posibles**:
- El usuario no está en `platform.platform_users`
- El campo `active` está en `false`
- El UUID no coincide con el de `auth.users`

**Solución**:
```sql
-- Verificar si el usuario existe
SELECT * FROM platform.platform_users WHERE id = 'TU_USER_ID';

-- Si existe pero está inactivo, activarlo
UPDATE platform.platform_users 
SET active = true 
WHERE id = 'TU_USER_ID';

-- Si no existe, crearlo (ver Opción 1)
```

### Error: "relation platform.platform_users does not exist"

**Causa**: Las migraciones no se han aplicado correctamente.

**Solución**:
```bash
npx supabase db push
```

### No puedo acceder a platform.platform_users desde el cliente

**Causa**: Las tablas del schema `platform` no son accesibles directamente desde el cliente.

**Solución**: Usa la función RPC `check_platform_admin()` o accede con `service_role`.

## 📝 Notas Importantes

1. **Seguridad**: Solo crea platform admins para usuarios de confianza
2. **Primer Admin**: El primer admin debe crearse manualmente desde SQL
3. **Auditoría**: Todas las creaciones de platform users quedan registradas en `platform.audit_logs`
4. **Service Role**: Para crear platform users desde código, necesitas usar `SUPABASE_SERVICE_ROLE_KEY`

## 🔄 Próximos Pasos

Una vez creado el primer platform admin:

1. Accede a `/admin` y verifica que puedes ver la lista de tenants
2. Crea algunos tenants de prueba desde `/admin`
3. Asigna planes y activa/desactiva features
4. Prueba la funcionalidad de impersonación

## 📚 Referencias

- [Documentación de Gobierno de Plataforma](./PLATFORM_GOVERNANCE.md)
- [Migración de Platform Governance](../supabase/migrations/0011_platform_governance.sql)


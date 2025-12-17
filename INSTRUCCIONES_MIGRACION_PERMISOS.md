# Instrucciones para aplicar la migración de permisos

## Paso 1: Acceder al SQL Editor de Supabase

1. Ve a: https://supabase.com/dashboard/project/jbwihqkxfmfmyzhweary
2. En el menú lateral, haz clic en "SQL Editor"
3. Haz clic en "+ New query"

## Paso 2: Copiar y ejecutar el SQL

Copia TODO el contenido del archivo `supabase/migrations/0100_user_permissions.sql` y pégalo en el editor SQL de Supabase.

Luego haz clic en "Run" (botón verde inferior derecho).

## Paso 3: Verificar que se aplicó correctamente

Ejecuta esta query en el SQL Editor:

```sql
select table_name 
from information_schema.tables 
where table_schema = 'public' 
  and table_name = 'user_permissions';
```

Debería devolver una fila con `user_permissions`.

## Paso 4: Verificar la función helper

```sql
select get_user_permissions(
  'e86c7e6e-71eb-48df-b7ff-451dec05ad8b'::uuid,  -- Sergi's user_id
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid   -- Book Fast tenant_id
);
```

Debería devolver un JSON con todos los permisos en `true` (porque Sergi es owner).

## Resumen

✅ Tabla `user_permissions` creada con índices y RLS
✅ Función `get_user_permissions()` para obtener permisos
✅ Policies de seguridad configuradas (usuarios ven solo sus permisos, owners/admins ven todo)
✅ Trigger para actualizar `updated_at` automáticamente

Una vez aplicada la migración, el sistema de permisos estará completamente funcional.

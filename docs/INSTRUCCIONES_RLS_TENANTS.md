# Instrucciones para Corregir RLS de Tenants

## 🎯 Objetivo

Corregir el error 500 al consultar `/rest/v1/tenants` que impide cargar el panel.

## 📋 Pasos a Seguir

### 1️⃣ Arreglar RLS de tenants (SQL directo en Supabase)

1. **Ve a Supabase → SQL Editor**
2. **Ejecuta el script**: `scripts/fix-tenants-rls-complete.sql`
   - Este script elimina todas las políticas problemáticas
   - Crea una única política simple y robusta
   - Verifica que todo está correcto

### 2️⃣ Verificar que el tenant y el membership existen

1. **Ejecuta el script**: `scripts/verificar-tenant-y-membership.sql`
   - Verifica que el tenant demo existe
   - Verifica que el usuario tiene membership
   - Si falta membership, descomenta y ejecuta el INSERT al final del script

### 3️⃣ Probar en el navegador

1. **Cierra sesión** si hace falta
2. **Vuelve a hacer login** por magic link
3. **Abre `/panel`** y revisa:
   - ✅ Que ya no salga el 500 en la llamada a `/rest/v1/tenants`
   - ✅ Que desaparezca el mensaje de "No tienes ninguna barbería asignada"
   - ✅ Que veas el nombre de la barbería demo en el panel

## 🔍 Qué Verificar

### Si la request a `/rest/v1/tenants` sigue saliendo 500:

1. Revisa la consola del navegador (F12) para ver los detalles del error
2. Verifica que ejecutaste el script `fix-tenants-rls-complete.sql`
3. Verifica que la política `tenant_read_tenants` existe:
   ```sql
   SELECT policyname, cmd
   FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'tenants';
   ```

### Si ves el nombre de la barbería demo:

✅ **¡Perfecto!** El problema está resuelto. Puedes continuar con el desarrollo de la UI.

## 📝 Scripts Creados

- `scripts/fix-tenants-rls-complete.sql` - Resetea y crea políticas RLS simples
- `scripts/verificar-tenant-y-membership.sql` - Verifica que todo existe

## 🔧 Mejoras en el Layout

He mejorado el manejo de errores en `app/panel/layout.tsx`:

- ✅ Distingue entre "error 500" y "no hay membership"
- ✅ Muestra mensajes diferentes según el tipo de error
- ✅ Logging mejorado con detalles completos del error

## 📌 Próximos Pasos

Una vez que `/panel` carga correctamente:

1. **Eliminar warning de GoTrueClient**: Revisar inicialización de Supabase
2. **Mejorar UI/UX**: Trabajar en `/panel/agenda` y otras secciones
3. **Hacer la webapp "vendible"**: Pulir interfaz y experiencia de usuario









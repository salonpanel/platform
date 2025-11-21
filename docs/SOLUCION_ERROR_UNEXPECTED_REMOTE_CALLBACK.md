# Solución: Error "unexpected" en Remote Callback

## Problema Actual

Cuando haces clic en el magic link del correo, te redirige a:
```
https://pro.bookfast.es/login?error=unexpected
```

Y en la consola ves que el polling sigue mostrando `status: 'pending', hasTokens: false`, lo que significa que el endpoint `/auth/remote-callback` no está actualizando correctamente la request.

## Causa Principal

El error `unexpected` viene del bloque `catch` del endpoint `/auth/remote-callback`, lo que significa que hay una excepción no manejada. Las causas más probables son:

1. **Supabase no está usando nuestro `emailRedirectTo`**: Si la URL no está en la lista de Redirect URLs permitidas en Supabase, Supabase la ignora y redirige a la Site URL (`/login`).

2. **Falta de variables de entorno**: `NEXT_PUBLIC_SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY` no están configuradas en Vercel.

3. **Error en `exchangeCodeForSession`**: El código puede estar expirado o ser inválido.

## Solución Paso a Paso

### Paso 1: Verificar Redirect URLs en Supabase

**CRÍTICO**: Asegúrate de que la URL de callback esté en la lista de Redirect URLs permitidas.

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto
3. Ve a **Authentication** → **URL Configuration**
4. En **Redirect URLs**, verifica que esté esta URL (exactamente, sin espacios):
   ```
   https://pro.bookfast.es/auth/remote-callback
   ```
5. Si NO está, añádela:
   - Haz clic en **Add** o el botón de añadir
   - Pega la URL: `https://pro.bookfast.es/auth/remote-callback`
   - Espera a que Supabase valide la URL (puede tardar unos segundos)
   - Haz clic en **Save**

### Paso 2: Verificar Variables de Entorno en Vercel

1. Ve a [Vercel Dashboard](https://vercel.com)
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**
4. Verifica que estas variables estén configuradas:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (CRÍTICO para el endpoint remote-callback)

### Paso 3: Verificar Logs del Servidor

Después de hacer clic en el magic link, verifica los logs en Vercel:

1. Ve a **Functions** → **Logs** en Vercel
2. Busca logs que empiecen con `[remote-callback]`
3. Los logs ahora incluyen información detallada sobre qué está fallando:
   - `[remote-callback] Request received` - Muestra todos los parámetros que llegan
   - `[remote-callback] Step 1: Creating Supabase client`
   - `[remote-callback] Step 2: Exchanging code for session`
   - `[remote-callback] Step 3: Creating admin client for database operations`
   - `[remote-callback] Unexpected error:` - Muestra el error específico

### Paso 4: Verificar que Supabase Está Usando Nuestro Callback

Cuando recibas el correo con el magic link:

1. Inspecciona el HTML del correo (clic derecho → Ver código fuente)
2. Busca el atributo `href` del enlace
3. Debe apuntar a algo como:
   ```
   https://pro.bookfast.es/auth/remote-callback?code=...&request_id=...&token=...
   ```
4. Si apunta a `https://jsqminbgggwhvkfgeibz.supabase.co/auth/v1/verify?...`, significa que Supabase NO está usando nuestro `emailRedirectTo` y necesitas verificar las Redirect URLs.

## Mejoras Implementadas

### 1. Logging Mejorado

El endpoint `/auth/remote-callback` ahora incluye logging detallado en cada paso:
- Parámetros recibidos
- Creación del cliente de Supabase
- Intercambio de código por sesión
- Creación del cliente admin
- Errores específicos con detalles

### 2. Manejo de Errores Mejorado

- Errores específicos ahora redirigen con mensajes descriptivos:
  - `invalid_link` - Falta el código
  - `invalid_session` - Error al intercambiar código por sesión
  - `no_session` - No se obtuvo sesión después del intercambio
  - `server_config` - Faltan variables de entorno
  - `update_failed` - Error al actualizar la request en la base de datos
  - `login_request_not_found` - La request no existe o ya fue procesada
  - `unexpected` - Error inesperado (con detalles en el parámetro `details`)

### 3. Middleware Mejorado

El middleware ahora intercepta magic links incluso cuando Supabase redirige a `/login` en lugar de `/auth/remote-callback`.

## Próximos Pasos

1. **Verifica las Redirect URLs en Supabase** (Paso 1) - Esto es lo más importante
2. **Verifica las variables de entorno en Vercel** (Paso 2)
3. **Haz un nuevo intento de login** y verifica los logs (Paso 3)
4. **Comparte los logs** si el problema persiste para poder identificar el error específico

## Debug Adicional

Si después de verificar todo lo anterior el problema persiste:

1. **Verifica los logs en Vercel** después de hacer clic en el magic link
2. **Copia el error completo** que aparece en los logs
3. **Verifica la URL del magic link** en el correo (debe apuntar a nuestro callback)
4. **Verifica que Realtime esté habilitado** en Supabase para la tabla `auth_login_requests`

## Notas Importantes

- Las Redirect URLs son **case-sensitive**: `https://pro.bookfast.es/auth/remote-callback` es diferente de `https://pro.bookfast.es/auth/Remote-Callback`
- No uses wildcards: Supabase no soporta wildcards como `https://*.bookfast.es/auth/remote-callback`
- Cada variante necesita su propia entrada: Si usas `http://` y `https://`, necesitas añadir ambas
- El orden no importa: Puedes añadir las URLs en cualquier orden
- Espera unos minutos después de guardar cambios en Supabase: A veces Supabase cachea las configuraciones




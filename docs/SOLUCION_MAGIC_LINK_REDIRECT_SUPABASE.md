# Solución: Magic Link Redirige a Supabase en Lugar de Nuestro Callback

## Problema Actual

Cuando el usuario hace clic en el magic link desde el correo, Supabase está redirigiendo directamente a su propio endpoint de verificación:
```
https://jsqminbgggwhvkfgeibz.supabase.co/auth/v1/verify?token=...&type=magiclink&redirect_to=%20%20%20https://pro.bookfast.es
```

En lugar de usar nuestro callback personalizado:
```
https://pro.bookfast.es/auth/remote-callback?request_id=...&token=...
```

**Causa**: Supabase ignora el parámetro `emailRedirectTo` si la URL no está en la lista de **Redirect URLs** permitidas en la configuración de Supabase.

## Solución: Configurar Redirect URLs en Supabase

### Paso 1: Ir a Supabase Dashboard

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto
3. Ve a **Authentication** → **URL Configuration**

### Paso 2: Configurar Site URL

En **Site URL**, asegúrate de que esté configurado como:
```
https://pro.bookfast.es
```

### Paso 3: Añadir Redirect URLs (CRÍTICO)

En **Redirect URLs**, añade **UNA POR UNA** (no todas a la vez):

1. **Primera URL** (la más importante):
   ```
   https://pro.bookfast.es/auth/remote-callback
   ```
   - Haz clic en **Add** o el botón de añadir
   - Espera a que Supabase valide la URL (puede tardar unos segundos)
   - Si aparece un error, verifica que el dominio esté funcionando correctamente

2. **Segunda URL** (para callbacks normales):
   ```
   https://pro.bookfast.es/auth/callback
   ```
   - Haz clic en **Add**
   - Espera a que se valide

3. **Tercera URL** (para desarrollo local):
   ```
   http://localhost:3000/auth/remote-callback
   ```
   - Haz clic en **Add**

4. **Cuarta URL** (para desarrollo local):
   ```
   http://localhost:3000/auth/callback
   ```
   - Haz clic en **Add**

### Paso 4: Guardar Cambios

Haz clic en **Save** o **Update** para guardar los cambios.

### Paso 5: Verificar que NO hay Espacios

**IMPORTANTE**: Asegúrate de que NO haya espacios antes o después de las URLs. Si hay espacios, Supabase los codificará como `%20` en el `redirect_to`, causando problemas.

Para verificar:
1. Copia cada URL desde el campo de texto
2. Pégala en un editor de texto
3. Verifica que no haya espacios al inicio o al final

## Verificación Post-Configuración

Después de configurar las Redirect URLs:

1. **Prueba el login de nuevo**:
   - Ve a `https://pro.bookfast.es/login`
   - Introduce tu email
   - Revisa el correo que recibes

2. **Verifica el magic link**:
   - El magic link debería tener esta estructura:
     ```
     https://pro.bookfast.es/auth/remote-callback?request_id=...&token=...
     ```
   - **NO** debería tener espacios codificados (`%20`) en la URL
   - **NO** debería redirigir directamente a `supabase.co/auth/v1/verify`

3. **Verifica la consola del navegador**:
   - En la pestaña de espera (PC), abre DevTools → Console
   - Busca logs que empiecen con `[Login]`, `[Realtime]` o `[Polling]`
   - Deberías ver: `[Login] emailRedirectTo URL: https://pro.bookfast.es/auth/remote-callback?...`

## Si Supabase Sigue Ignorando el emailRedirectTo

Si después de añadir las URLs a la lista de Redirect URLs, Supabase sigue redirigiendo directamente a su endpoint:

1. **Verifica que la URL esté exactamente igual**:
   - Debe ser `https://pro.bookfast.es/auth/remote-callback` (sin espacios, sin trailing slash)
   - Debe coincidir exactamente con la URL que se está enviando en `emailRedirectTo`

2. **Verifica que el dominio esté funcionando**:
   - Abre `https://pro.bookfast.es/auth/remote-callback` en el navegador
   - Debería cargar (aunque muestre un error si no tiene los parámetros correctos)
   - Si no carga, hay un problema con el dominio o el deployment

3. **Limpia la caché de Supabase**:
   - A veces Supabase cachea las configuraciones
   - Espera unos minutos después de guardar los cambios
   - O intenta crear un nuevo magic link

4. **Verifica los logs del servidor**:
   - En Vercel → Functions → Logs
   - Busca logs de `[RemoteCallback]` cuando hagas clic en el magic link
   - Si no aparecen logs, significa que Supabase no está redirigiendo a nuestro callback

## Debug Adicional

Si el problema persiste, verifica:

1. **En la consola del navegador (página de login)**:
   ```javascript
   // Busca este log:
   [Login] emailRedirectTo URL: https://pro.bookfast.es/auth/remote-callback?request_id=...&token=...
   ```

2. **En el correo del magic link**:
   - Inspecciona el HTML del correo
   - Busca el atributo `href` del enlace
   - Verifica que apunte a `pro.bookfast.es/auth/remote-callback` y no a `supabase.co`

3. **En los logs de Vercel**:
   - Busca requests a `/auth/remote-callback`
   - Si no aparecen, Supabase no está redirigiendo correctamente

## Notas Importantes

- **Las Redirect URLs son case-sensitive**: `https://pro.bookfast.es/auth/remote-callback` es diferente de `https://pro.bookfast.es/auth/Remote-Callback`
- **No uses wildcards**: Supabase no soporta wildcards como `https://*.bookfast.es/auth/remote-callback`
- **Cada variante necesita su propia entrada**: Si usas `http://` y `https://`, necesitas añadir ambas
- **El orden no importa**: Puedes añadir las URLs en cualquier orden




# Verificación de Configuración de Supabase para Magic Link

## Problemas Comunes y Soluciones

### 1. Verificar Redirect URLs en Supabase Dashboard

**Ubicación:** Supabase Dashboard → Authentication → URL Configuration → Redirect URLs

**URLs que DEBEN estar configuradas:**

```
https://pro.bookfast.es/auth/callback
https://pro.bookfast.es/auth/remote-callback
https://admin.bookfast.es/auth/callback
https://admin.bookfast.es/auth/remote-callback
https://*.bookfast.es/auth/callback
https://*.bookfast.es/auth/remote-callback
```

**Nota:** El wildcard `https://*.bookfast.es/auth/callback` cubre todos los subdominios, pero es recomendable tener también las URLs específicas.

### 2. Verificar Site URL

**Ubicación:** Supabase Dashboard → Authentication → URL Configuration → Site URL

**Debe estar configurado como:**
```
https://pro.bookfast.es
```

**Importante:** Esta es la URL base que Supabase usa como fallback si `emailRedirectTo` no está en la lista de Redirect URLs permitidas.

### 3. Verificar Configuración de Cookies

**Dominio de cookies:**
- Las cookies de Supabase se establecen automáticamente en el dominio actual
- Para `pro.bookfast.es`, las cookies se establecen en `.bookfast.es` (con el punto inicial)
- Esto permite compartir cookies entre subdominios

**Verificar en el navegador:**
1. Abre DevTools → Application → Cookies
2. Busca cookies que empiecen con `sb-` o `supabase.`
3. Verifica que el dominio sea `.bookfast.es` (con punto inicial)

### 4. Verificar Variables de Entorno en Vercel

**Variables requeridas:**
- `NEXT_PUBLIC_SUPABASE_URL` - URL de tu proyecto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Clave anónima de Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Clave de servicio (solo en servidor)
- `NEXT_PUBLIC_APP_URL` - URL base de la aplicación (ej: `https://pro.bookfast.es`)

**Verificar:**
1. Vercel Dashboard → Tu proyecto → Settings → Environment Variables
2. Asegúrate de que todas las variables estén configuradas para "Production"
3. Verifica que los valores sean correctos (sin espacios, sin comillas extra)

### 5. Logs de Depuración

Los logs de depuración están habilitados en:
- `[Login]` - Logs de la página de login
- `[SupabaseProvider]` - Logs del provider de autenticación
- `[Middleware]` - Logs del middleware de Next.js
- `[PanelLayout]` - Logs del layout del panel
- `[remote-callback]` - Logs del endpoint de callback remoto

**Ver logs en:**
- **Desarrollo:** Consola del navegador
- **Producción:** Vercel Dashboard → Tu proyecto → Logs

### 6. Flujo de Autenticación Mejorado

El sistema ahora detecta sesiones de múltiples formas:

1. **onAuthStateChange** - Detecta cambios de sesión en tiempo real (incluyendo otras pestañas)
2. **getSession() polling** - Verifica la sesión cada 2 segundos
3. **API polling** - Verifica el estado de la request cada 3 segundos
4. **Realtime subscription** - Escucha cambios en la base de datos

**Orden de prioridad:**
1. Realtime subscription (más rápido)
2. onAuthStateChange (sincronización entre pestañas)
3. getSession() polling (verificación directa)
4. API polling (fallback)

### 7. Solución de Problemas

**Problema: "error=unexpected" en /login**
- Verifica que `/auth/remote-callback` esté en Redirect URLs
- Verifica que las variables de entorno estén correctas
- Revisa los logs de Vercel para ver el error específico

**Problema: Sesión no se detecta en la pestaña original**
- Verifica que `persistSession: true` esté configurado
- Verifica que las cookies se estén estableciendo correctamente
- Revisa los logs de `[Login]` para ver si `onAuthStateChange` se está disparando

**Problema: Redirección a /login después de autenticarse**
- Verifica que el middleware no esté redirigiendo prematuramente
- Revisa los logs de `[Middleware]` y `[PanelLayout]`
- Asegúrate de que la sesión esté disponible antes de redirigir

### 8. Testing

**Probar el flujo completo:**
1. Abre `https://pro.bookfast.es/login` en una pestaña
2. Ingresa tu email y solicita el magic link
3. Abre el correo en otra pestaña/dispositivo
4. Haz clic en el magic link
5. La pestaña original debería detectar la sesión automáticamente y redirigir

**Verificar en consola:**
- `[Login] onAuthStateChange event: SIGNED_IN` - Debe aparecer cuando se establece la sesión
- `[Login] Session found via direct check` - Debe aparecer cuando se detecta la sesión
- `[SupabaseProvider] Auth state changed: SIGNED_IN` - Debe aparecer en todas las pestañas

### 9. Configuración de Dominio en Supabase

**Para múltiples subdominios:**
- Usa wildcards en Redirect URLs: `https://*.bookfast.es/auth/callback`
- Asegúrate de que el Site URL sea el dominio principal
- Las cookies se compartirán automáticamente entre subdominios si el dominio es `.bookfast.es`

### 10. Contacto

Si después de verificar todo lo anterior el problema persiste:
1. Revisa los logs de Vercel para errores específicos
2. Revisa los logs del navegador para errores de JavaScript
3. Verifica que todas las URLs estén correctamente configuradas
4. Asegúrate de que las variables de entorno estén correctas




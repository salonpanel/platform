# Debug: Login Remoto No Detecta Aprobación

## Problema Actual

1. El magic link apunta directamente a Supabase (`https://jsqminbgggwhvkfgeibz.supabase.co/auth/v1/verify?...`)
2. El `redirect_to` tiene espacios codificados (`%20%20%20`)
3. La pantalla de espera no detecta la aprobación

## Verificaciones Necesarias

### 1. Configuración de Supabase

En Supabase Dashboard → Authentication → URL Configuration:

**Site URL:**
```
https://pro.bookfast.es
```

**Redirect URLs (debe incluir):**
```
https://pro.bookfast.es/auth/remote-callback
https://pro.bookfast.es/auth/callback
http://localhost:3000/auth/remote-callback
http://localhost:3000/auth/callback
```

**IMPORTANTE:** Asegúrate de que NO hay espacios antes/después de las URLs.

### 2. Verificar que el emailRedirectTo se está usando

El código actual usa:
```typescript
const callbackUrl = `${baseUrl}/auth/remote-callback?request_id=${requestId}&token=${token}`;
await supabase.auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo: callbackUrl,
  },
});
```

**Verificación:**
1. Abre la consola del navegador en la página de login
2. Busca el log del `callbackUrl` que se está enviando
3. Verifica que NO tenga espacios

### 3. Verificar Realtime

En Supabase Dashboard → Database → Realtime:

1. Verifica que Realtime está habilitado
2. Verifica que `auth_login_requests` está en la lista de tablas con Realtime
3. Si no está, ejecuta:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE auth_login_requests;
```

### 4. Debug en Consola

Después del deployment, cuando pruebes el login:

1. **En la pestaña de espera (PC):**
   - Abre DevTools → Console
   - Busca logs que empiecen con `[Realtime]` o `[Polling]`
   - Verifica que la subscription se crea: `[Realtime] Successfully subscribed to changes`
   - Verifica que el polling está funcionando: `[Polling] Status check: ...`

2. **Cuando hagas clic en el magic link (móvil):**
   - Verifica en los logs de Vercel que `/auth/remote-callback` se ejecuta
   - Busca logs que empiecen con `[RemoteCallback]`
   - Verifica que la request se actualiza: `[RemoteCallback] Request updated successfully`

3. **En la pestaña de espera (PC) después del clic:**
   - Verifica que aparece: `[Realtime] Change detected:` o `[Polling] Request approved`
   - Verifica que se ejecuta: `[handleApprovedRequest] Setting session with tokens...`

### 5. Verificar que el Magic Link Pasa por Nuestro Callback

El problema puede ser que Supabase no está usando nuestro `emailRedirectTo`. 

**Solución temporal:** Si el magic link apunta directamente a Supabase, el middleware debería detectarlo cuando redirige a `pro.bookfast.es` y redirigir a nuestro callback.

**Verificar:**
1. Cuando hagas clic en el magic link, verifica la URL final
2. Debe ser algo como: `https://pro.bookfast.es/auth/remote-callback?code=...&request_id=...&token=...`
3. Si no es así, el middleware no está interceptando correctamente

## Solución Alternativa: Usar el Flujo Tradicional

Si el flujo remoto sigue sin funcionar, podemos hacer que el magic link funcione en el mismo navegador (flujo tradicional) mientras arreglamos el remoto:

1. El magic link se abre en el mismo navegador
2. Se loguea directamente
3. Funciona como antes

¿Quieres que implemente esta solución temporal mientras debuggeamos el remoto?




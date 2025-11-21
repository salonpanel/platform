# 🔍 Diagnóstico: Bucle de Redirecciones (Cookies no llegan al servidor)

## 🚨 Problema Observado

Los logs de Vercel muestran un patrón de redirecciones en bucle:
```
GET 307 /panel → /login
GET 307 /panel → /login
GET 307 /panel → /login
```

Esto indica que:
1. El usuario verifica el código OTP correctamente
2. Se redirige a `/panel`
3. El middleware o PanelLayout no detecta la sesión
4. Redirige de vuelta a `/login`
5. Se crea un bucle infinito

## 🔍 Diagnóstico Paso a Paso

### Paso 1: Verificar Cookies en el Navegador

1. **Abre Chrome DevTools** (F12)
2. Ve a **Application** → **Cookies**
3. Selecciona tu dominio (`pro.bookfast.es`)

**Después de verificar el código OTP, deberías ver:**

- ✅ `sb-panel-auth-auth-token` (debe existir)
- ✅ `sb-panel-auth-refresh-token` (debe existir)

**Verificar cada cookie:**

- **Name:** Debe empezar con `sb-panel-auth-`
- **Value:** No debe estar vacío
- **Domain:** Debe ser `.bookfast.es` (con punto inicial) o `pro.bookfast.es`
- **Path:** Debe ser `/`
- **Expires:** Debe tener una fecha futura
- **HttpOnly:** Puede ser `true` o `false`
- **Secure:** Debe ser `true` (en producción con HTTPS)
- **SameSite:** Debe ser `None` o `Lax` (no `Strict`)

### Paso 2: Verificar Logs en Vercel

Después del deployment, busca en los logs de Vercel:

#### Logs del Middleware

Busca líneas que contengan `[Middleware]` o `[Pro Domain]`:

```
[Middleware] Session check for /panel: {
  hasSession: false,
  authCookiesCount: 0,  // ⚠️ Si es 0, las cookies no están llegando
  authCookieNames: [],
  allCookiesCount: X,
  allCookieNames: [...]
}
```

**Si `authCookiesCount: 0`:**
- Las cookies no se están estableciendo en el navegador, O
- Las cookies se establecen pero no se envían al servidor

#### Logs del PanelLayout

Busca líneas que contengan `[PanelLayout]`:

```
[PanelLayout] Available cookies: {
  totalCookies: X,
  authCookies: 0,  // ⚠️ Si es 0, las cookies no están llegando
  authCookieNames: [],
  allCookieNames: [...]
}
```

**Si `authCookies: 0`:**
- Las cookies no están llegando al servidor

### Paso 3: Verificar Configuración de Supabase

#### 1. Site URL

**Ubicación:** Supabase Dashboard → Authentication → URL Configuration → Site URL

**Debe estar configurado como:**
```
https://pro.bookfast.es
```

#### 2. Cookie Settings

**Ubicación:** Supabase Dashboard → Authentication → URL Configuration → Cookie Settings

**Configuración recomendada:**
- **SameSite:** `None` (permite cookies en requests cross-site)
- **Secure:** `true` (requiere HTTPS)
- **Domain:** Dejar vacío (Supabase lo maneja automáticamente)

#### 3. Redirect URLs

**Ubicación:** Supabase Dashboard → Authentication → URL Configuration → Redirect URLs

**Deben estar configuradas:**
```
https://pro.bookfast.es/auth/callback
https://pro.bookfast.es/login/verify-code
https://*.bookfast.es/auth/callback
```

## 🔧 Soluciones Posibles

### Solución 1: Verificar que las cookies se establecen

**En el navegador, después de verificar el código OTP:**

1. Abre la consola del navegador (F12 → Console)
2. Busca logs que contengan `[VerifyCode] Cookies after setSession:`
3. Verifica que `authCookies.length > 0`

**Si `authCookies.length === 0`:**
- Las cookies no se están estableciendo
- Verifica la configuración de Supabase (Cookie Settings)
- Verifica que estés usando HTTPS en producción

### Solución 2: Verificar dominio de cookies

**Si las cookies se establecen pero no se envían al servidor:**

1. Verifica que el dominio de las cookies sea correcto
2. En DevTools → Application → Cookies, verifica:
   - **Domain:** Debe ser `.bookfast.es` (con punto inicial) para compartir entre subdominios
   - O `pro.bookfast.es` (sin punto) si solo necesitas ese subdominio

### Solución 3: Aumentar delay antes de redirigir

**Si las cookies se establecen pero el servidor no las lee inmediatamente:**

- El delay actual es de 1000ms (1 segundo)
- Si persiste el problema, puede ser necesario aumentar a 2000ms (2 segundos)

### Solución 4: Verificar configuración del cliente Supabase

**En `src/lib/supabase/browser.ts`:**

Verifica que esté configurado con:
```typescript
{
  auth: {
    persistSession: true,        // ✅ Debe ser true
    storageKey: "sb-panel-auth", // ✅ Debe coincidir
    autoRefreshToken: true,      // ✅ Debe ser true
    flowType: 'pkce',           // ✅ Usar PKCE
    detectSessionInUrl: false,   // ✅ false para OTP
  }
}
```

## 📋 Checklist de Verificación

Después del deployment, verifica:

- [ ] Las cookies aparecen en DevTools después de verificar el código OTP
- [ ] Las cookies tienen el dominio correcto (`.bookfast.es` o `pro.bookfast.es`)
- [ ] Las cookies tienen `Secure: true` en producción
- [ ] Las cookies tienen `SameSite: None` o `Lax` (no `Strict`)
- [ ] Los logs del middleware muestran `authCookiesCount > 0`
- [ ] Los logs del PanelLayout muestran `authCookies > 0`
- [ ] Site URL en Supabase está configurado como `https://pro.bookfast.es`
- [ ] Cookie Settings en Supabase tienen `SameSite: None` y `Secure: true`

## 🚨 Si el Problema Persiste

Si después de verificar todo lo anterior el problema persiste:

1. **Verifica los logs completos de Vercel** para ver qué cookies están llegando
2. **Comparte los logs** del middleware y PanelLayout para análisis
3. **Verifica en el navegador** que las cookies se establecen correctamente
4. **Prueba en modo incógnito** para descartar problemas de caché

## 📝 Notas Técnicas

- Las cookies de Supabase se establecen automáticamente cuando llamas a `setSession()`
- El delay de 1000ms debería ser suficiente para que las cookies se establezcan
- Si las cookies no aparecen en DevTools, el problema está en el cliente
- Si las cookies aparecen en DevTools pero no en los logs del servidor, el problema está en la configuración de dominio o SameSite


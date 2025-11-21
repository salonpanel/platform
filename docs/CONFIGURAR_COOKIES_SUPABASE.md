# 🔐 Configuración de Cookies en Supabase para OTP

## 🚨 Problema Común

Después de verificar el código OTP, el usuario se autentica correctamente (`SIGNED_IN` se dispara), pero el middleware redirige al login porque no detecta la sesión. Esto suele deberse a problemas de configuración de cookies.

## ✅ Solución: Verificar Configuración en Supabase Dashboard

### 1. Site URL

**Ubicación:** Supabase Dashboard → Authentication → URL Configuration → Site URL

**Debe estar configurado como:**
```
https://pro.bookfast.es
```

**⚠️ IMPORTANTE:** 
- Debe ser HTTPS (no HTTP)
- Debe coincidir con tu dominio de producción
- No debe tener trailing slash

### 2. Cookie Settings

**Ubicación:** Supabase Dashboard → Authentication → URL Configuration → Cookie Settings

**Configuración recomendada para producción:**

- **SameSite:** `None` (permite cookies en requests cross-site)
- **Secure:** `true` (requiere HTTPS)
- **Domain:** Dejar vacío o configurar como `.bookfast.es` (con punto inicial para compartir entre subdominios)

**⚠️ NOTA:** 
- En desarrollo local (localhost), `Secure: true` puede causar problemas. Supabase debería detectar automáticamente el entorno.
- Si tienes problemas en localhost, verifica que estés usando `http://localhost:3000` (no HTTPS)

### 3. Redirect URLs

**Ubicación:** Supabase Dashboard → Authentication → URL Configuration → Redirect URLs

**URLs que DEBEN estar configuradas:**

```
https://pro.bookfast.es/auth/callback
https://pro.bookfast.es/login/verify-code
https://admin.bookfast.es/auth/callback
https://*.bookfast.es/auth/callback
http://localhost:3000/auth/callback
http://localhost:3000/login/verify-code
```

**Nota:** El wildcard `https://*.bookfast.es/auth/callback` cubre todos los subdominios.

## 🔍 Verificar Configuración del Cliente

### En `src/lib/supabase/browser.ts`

Verifica que el cliente esté configurado con:

```typescript
{
  auth: {
    persistSession: true,        // ✅ Debe ser true
    storageKey: "sb-panel-auth", // ✅ Debe coincidir con el esperado por el middleware
    autoRefreshToken: true,      // ✅ Debe ser true
    flowType: 'pkce',           // ✅ Usar PKCE para mejor seguridad
    detectSessionInUrl: false,   // ✅ false para OTP (no Magic Link)
  }
}
```

## 🧪 Verificar Cookies en el Navegador

### Paso 1: Abrir DevTools

1. Abre Chrome DevTools (F12)
2. Ve a **Application** → **Cookies**
3. Selecciona tu dominio (`pro.bookfast.es`)

### Paso 2: Verificar Cookies de Supabase

Después de hacer login, deberías ver cookies como:

- `sb-panel-auth-auth-token` ✅
- `sb-panel-auth-refresh-token` ✅

**Verificar:**
- **Domain:** Debe ser `.bookfast.es` (con punto inicial) o `pro.bookfast.es`
- **Path:** Debe ser `/`
- **HttpOnly:** Puede ser `true` o `false` (depende de la configuración)
- **Secure:** Debe ser `true` en producción (HTTPS)
- **SameSite:** Debe ser `None` o `Lax`

### Paso 3: Si las cookies no aparecen

**Posibles causas:**
1. **Secure flag en HTTP:** Si estás en localhost con HTTP, las cookies con `Secure: true` no se establecerán
2. **Dominio incorrecto:** Verifica que el dominio de las cookies coincida con tu dominio actual
3. **SameSite muy restrictivo:** `SameSite: Strict` puede bloquear cookies en algunos flujos

## 🔧 Solución de Problemas

### Problema: Cookies no se establecen en localhost

**Solución:**
- Asegúrate de usar `http://localhost:3000` (no HTTPS)
- Verifica que Supabase detecte automáticamente el entorno de desarrollo
- Si persiste, verifica que `NEXT_PUBLIC_SUPABASE_URL` apunte a tu proyecto correcto

### Problema: Cookies se establecen pero el middleware no las lee

**Solución:**
1. Verifica que el `storageKey` en el cliente sea `sb-panel-auth`
2. Verifica que el middleware busque cookies con el prefijo `sb-panel-auth-`
3. Revisa los logs del middleware para ver qué cookies están disponibles

### Problema: Redirección infinita al login

**Solución:**
1. Verifica que el middleware haga reintento de `getSession()` si hay cookies pero no sesión
2. Aumenta el delay antes de redirigir (actualmente 300ms)
3. Verifica que no haya múltiples redirecciones compitiendo

## 📋 Checklist de Verificación

- [ ] Site URL en Supabase: `https://pro.bookfast.es`
- [ ] Redirect URLs incluyen `https://pro.bookfast.es/auth/callback`
- [ ] Redirect URLs incluyen `https://pro.bookfast.es/login/verify-code`
- [ ] Cookie Settings: `SameSite: None`, `Secure: true`
- [ ] Cliente Supabase: `storageKey: "sb-panel-auth"`
- [ ] Cliente Supabase: `persistSession: true`
- [ ] Cliente Supabase: `autoRefreshToken: true`
- [ ] Cookies aparecen en DevTools después del login
- [ ] Middleware hace reintento si hay cookies pero no sesión

## 🔗 Referencias

- [Supabase Auth Helpers - Next.js](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [Supabase Cookies Configuration](https://supabase.com/docs/guides/auth/auth-deep-dive/auth-deep-dive-cookies)


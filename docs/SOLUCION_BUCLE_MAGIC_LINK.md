# 🔄 Solución: Bucle Infinito con Magic Links

## 🚨 Problema

Al hacer clic en el magic link del correo, se crea un bucle infinito:
1. El magic link redirige a `https://pro.bookfast.es` (sin `/auth/callback`)
2. El middleware redirige `/` a `/panel`
3. Como no hay sesión, redirige a `/login`
4. Se repite el ciclo

**URL del magic link problemática:**
```
https://jsqminbgggwhvkfgeibz.supabase.co/auth/v1/verify?token=...&type=magiclink&redirect_to=%20%20%20https://pro.bookfast.es
```

**Problemas detectados:**
- El `redirect_to` tiene espacios codificados (`%20%20%20`)
- Supabase redirige a `https://pro.bookfast.es` (sin ruta) en lugar de `/auth/callback`
- El middleware no detecta que es un magic link y redirige a `/panel` → `/login`

## ✅ Solución Implementada

### 1. Detección en Middleware

El middleware ahora detecta si la request viene de Supabase (con `type=magiclink` y `token`) y redirige al callback antes de verificar la sesión:

```typescript
// En middleware.ts
if (pathname === "/") {
  const type = url.searchParams.get("type");
  const token = url.searchParams.get("token");
  const code = url.searchParams.get("code");
  
  // Si viene de Supabase con magic link, redirigir al callback
  if ((type === "magiclink" && token) || code) {
    const callbackUrl = new URL("/auth/callback", url);
    // Preservar todos los query params
    url.searchParams.forEach((value, key) => {
      callbackUrl.searchParams.set(key, value);
    });
    return NextResponse.redirect(callbackUrl);
  }
  
  // Redirigir / a /panel (solo si no es un magic link)
  url.pathname = "/panel";
  return NextResponse.redirect(url);
}
```

### 2. Manejo en Callback

El callback ahora maneja el caso cuando viene con `token` pero sin `code`:

```typescript
// En app/auth/callback/route.ts
const token = url.searchParams.get("token");
const type = url.searchParams.get("type");

// Si viene de Supabase con token pero sin code, redirigir al cliente
if (type === "magiclink" && token && !code && !accessToken) {
  const clientHandlerUrl = new URL("/auth/magic-link-handler", allowedAppUrl);
  url.searchParams.forEach((value, key) => {
    clientHandlerUrl.searchParams.set(key, value);
  });
  return NextResponse.redirect(clientHandlerUrl);
}
```

### 3. Limpieza de URL en Login

El código de login ahora limpia espacios en la URL del callback:

```typescript
// En app/login/page.tsx
const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || window.location.origin).trim();
const callbackUrl = callbackBase.trim();
```

### 4. Manejo en Magic Link Handler

El handler del cliente ahora también maneja tokens en query params:

```typescript
// En app/auth/magic-link-handler/page.tsx
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get("token");
const type = urlParams.get("type");

// Si viene con token pero sin hash, redirigir al callback
if (token && type === "magiclink" && !accessToken && !code) {
  const callbackUrl = new URL("/auth/callback", window.location.origin);
  urlParams.forEach((value, key) => {
    callbackUrl.searchParams.set(key, value);
  });
  window.location.href = callbackUrl.toString();
  return;
}
```

## 🔍 Flujo Corregido

1. Usuario hace clic en magic link del correo
2. Supabase redirige a `https://pro.bookfast.es?type=magiclink&token=...`
3. **Middleware detecta** que es un magic link y redirige a `/auth/callback?type=magiclink&token=...`
4. **Callback detecta** el token y redirige a `/auth/magic-link-handler?type=magiclink&token=...`
5. **Handler del cliente** procesa el token y establece la sesión
6. Redirige a `/panel` ✅

## 📋 Verificación

Después de desplegar estos cambios:

1. Solicita un nuevo magic link desde `https://pro.bookfast.es/login`
2. Revisa el correo
3. Haz clic en el magic link
4. Deberías ser redirigido a `/panel` sin bucle ✅

## 🐛 Si Persiste el Problema

### Verificar que el código está desplegado

1. Verifica que Vercel ha desplegado los cambios más recientes
2. Limpia la caché del navegador
3. Solicita un nuevo magic link (los antiguos pueden tener el problema)

### Verificar configuración de Supabase

1. Ve a Supabase Dashboard → Authentication → URL Configuration
2. Verifica que **Site URL** es: `https://pro.bookfast.es`
3. Verifica que las **Redirect URLs** incluyen:
   - `https://*.bookfast.es/auth/callback`
   - `https://*.bookfast.es/auth/magic-link-handler`

### Verificar variable de entorno

1. Ve a Vercel Dashboard → Settings → Environment Variables
2. Verifica que `NEXT_PUBLIC_APP_URL=https://pro.bookfast.es` está configurada para **Production**

## 📚 Archivos Modificados

- `middleware.ts` - Detección de magic links en la raíz
- `app/auth/callback/route.ts` - Manejo de tokens de Supabase
- `app/auth/magic-link-handler/page.tsx` - Manejo de tokens en query params
- `app/login/page.tsx` - Limpieza de espacios en URLs

## 🔗 Referencias

- `docs/CONFIGURAR_SUPABASE_REDIRECTS.md` - Configuración de Supabase
- `docs/CONFIGURACION_WILDCARDS_SUPABASE.md` - Uso de wildcards
- `docs/CHECKLIST_FINAL_MAGIC_LINKS.md` - Checklist completo


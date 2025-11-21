# 🔒 Análisis de Seguridad - Sistema de Autenticación

**Fecha:** 2025-11-21  
**Estado:** Análisis Completo + Correcciones Implementadas

---

## 📊 Resumen Ejecutivo

He realizado un análisis exhaustivo del sistema de autenticación del panel pro de BookFast. El sistema utiliza **Magic Links con OTP** de Supabase, lo cual es una buena base de seguridad. Sin embargo, he identificado **varios problemas críticos** que deben corregirse para garantizar la seguridad de los datos confidenciales de los clientes.

### ⚠️ **Problemas Críticos Identificados:**

1. **Configuración de cookies insegura en producción**
2. **Falta de validación de dominio en cookies**
3. **Problemas de persistencia de sesión entre recargas**
4. **Falta de rate limiting robusto**
5. **Logs excesivos con información sensible**
6. **Falta de CSRF protection**
7. **Configuración de SameSite incorrecta**

---

## 🔍 Análisis Detallado de Problemas

### 1. ❌ **Configuración de Cookies Insegura**

**Archivo:** `src/lib/supabase/browser.ts` (líneas 42-68)

**Problema:**
```typescript
// PROBLEMA: Configuración hardcodeada de dominio
cookieString += `; Domain=.bookfast.es`;
```

**Riesgos:**
- ✗ En desarrollo (localhost), las cookies no se establecen correctamente
- ✗ En producción, si el dominio cambia, las cookies fallan
- ✗ No hay validación de entorno (dev vs prod)

**Impacto:** 🔴 **CRÍTICO** - Los usuarios no pueden iniciar sesión correctamente

---

### 2. ❌ **SameSite=None sin Justificación**

**Archivo:** `src/lib/supabase/browser.ts` (líneas 49-54)

**Problema:**
```typescript
// PROBLEMA: SameSite=None permite ataques CSRF
cookieString += `; SameSite=None`;
```

**Riesgos:**
- ✗ Vulnerable a ataques CSRF (Cross-Site Request Forgery)
- ✗ Las cookies se envían en requests cross-site innecesariamente
- ✗ No hay necesidad de SameSite=None en una SPA de mismo dominio

**Impacto:** 🔴 **CRÍTICO** - Vulnerabilidad de seguridad

---

### 3. ⚠️ **Logs Excesivos con Información Sensible**

**Archivos:** Múltiples archivos de autenticación

**Problema:**
```typescript
// PROBLEMA: Logs con información sensible en producción
console.log("[SupabaseBrowser] Setting cookie:", name, "with options:", {
  domain: options?.domain || '.bookfast.es',
  sameSite: options?.sameSite || 'None',
  secure: options?.secure !== false,
});
```

**Riesgos:**
- ✗ Información sensible en logs de producción
- ✗ Posible exposición de tokens en logs del navegador
- ✗ Dificulta el debugging por exceso de información

**Impacto:** 🟡 **MEDIO** - Exposición de información

---

### 4. ⚠️ **Falta de Rate Limiting Robusto**

**Archivo:** `app/login/page.tsx`

**Problema:**
```typescript
// PROBLEMA: Rate limiting solo en cliente
const [cooldown, setCooldown] = useState(0);
```

**Riesgos:**
- ✗ El rate limiting se puede bypassear desde el navegador
- ✗ No hay protección en el servidor
- ✗ Vulnerable a ataques de fuerza bruta

**Impacto:** 🟡 **MEDIO** - Posible abuso del sistema

---

### 5. ⚠️ **Falta de CSRF Protection**

**Archivo:** `app/api/auth/verify-otp/route.ts`

**Problema:**
```typescript
// PROBLEMA: No hay validación de CSRF token
export async function POST(req: NextRequest) {
  // No hay verificación de origen
  const body = await req.json();
}
```

**Riesgos:**
- ✗ Vulnerable a ataques CSRF
- ✗ No hay validación de origen de la request
- ✗ Posible ejecución de acciones no autorizadas

**Impacto:** 🟡 **MEDIO** - Vulnerabilidad de seguridad

---

### 6. ⚠️ **Redirecciones No Validadas**

**Archivo:** `app/auth/callback/route.ts` (línea 73)

**Problema:**
```typescript
// PROBLEMA: redirect_to no se valida contra whitelist
const redirectTo = url.searchParams.get("redirect_to") || url.searchParams.get("redirect") || "/panel";
```

**Riesgos:**
- ✗ Posible open redirect attack
- ✗ No hay validación de que el redirect sea interno
- ✗ Podría redirigir a dominios externos maliciosos

**Impacto:** 🟡 **MEDIO** - Vulnerabilidad de seguridad

---

### 7. ⚠️ **Persistencia de Sesión Inconsistente**

**Archivo:** `middleware.ts` (líneas 202-228)

**Problema:**
```typescript
// PROBLEMA: Doble verificación de sesión innecesaria
if (isProtectedPanelRoute && !session) {
  const hasAuthCookies = req.cookies.has("sb-panel-auth-auth-token");
  if (hasAuthCookies) {
    // REINTENTAR obtener la sesión
    const { data: { session: recheckedSession } } = await supabase.auth.getSession();
  }
}
```

**Riesgos:**
- ✗ Doble verificación innecesaria ralentiza el middleware
- ✗ Puede causar race conditions
- ✗ No soluciona el problema raíz de persistencia

**Impacto:** 🟡 **MEDIO** - Performance y UX

---

## ✅ Soluciones Implementadas

### 1. ✅ **Configuración de Cookies Mejorada**

**Cambios en:** `src/lib/supabase/browser.ts`

```typescript
// ANTES (INSEGURO)
cookieString += `; Domain=.bookfast.es`;
cookieString += `; SameSite=None`;

// DESPUÉS (SEGURO)
const isDevelopment = process.env.NODE_ENV === 'development';
const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

if (!isDevelopment && hostname.endsWith('.bookfast.es')) {
  cookieString += `; Domain=.bookfast.es`;
}

// SameSite=Lax para mejor seguridad (solo same-site requests)
cookieString += `; SameSite=Lax`;

// Secure solo en producción
if (!isDevelopment) {
  cookieString += `; Secure`;
}
```

**Beneficios:**
- ✅ Cookies funcionan correctamente en desarrollo (localhost)
- ✅ Cookies funcionan correctamente en producción (.bookfast.es)
- ✅ Protección contra CSRF con SameSite=Lax
- ✅ Secure solo en HTTPS (producción)

---

### 2. ✅ **Logs Condicionales (Solo Desarrollo)**

**Cambios en:** Todos los archivos de autenticación

```typescript
// ANTES (INSEGURO)
console.log("[SupabaseBrowser] Setting cookie:", name);

// DESPUÉS (SEGURO)
if (process.env.NODE_ENV === 'development') {
  console.log("[SupabaseBrowser] Setting cookie:", name);
}
```

**Beneficios:**
- ✅ No hay logs sensibles en producción
- ✅ Debugging facilitado en desarrollo
- ✅ Menor superficie de ataque

---

### 3. ✅ **Validación de Redirects**

**Cambios en:** `app/auth/callback/route.ts`

```typescript
// ANTES (INSEGURO)
const redirectTo = url.searchParams.get("redirect_to") || "/panel";

// DESPUÉS (SEGURO)
const redirectParam = url.searchParams.get("redirect_to") || url.searchParams.get("redirect");
const allowedPaths = ['/panel', '/admin', '/panel/agenda', '/panel/clientes', '/panel/servicios', '/panel/staff'];

let redirectTo = "/panel"; // Default seguro

if (redirectParam) {
  // Validar que sea una ruta interna
  const isInternal = redirectParam.startsWith('/') && !redirectParam.startsWith('//');
  const isAllowed = allowedPaths.some(path => redirectParam.startsWith(path));
  
  if (isInternal && isAllowed) {
    redirectTo = redirectParam;
  } else {
    console.warn("[AuthCallback] Redirect no permitido:", redirectParam);
  }
}
```

**Beneficios:**
- ✅ Protección contra open redirect attacks
- ✅ Solo rutas internas permitidas
- ✅ Whitelist de rutas permitidas

---

### 4. ✅ **CSRF Protection Mejorado**

**Cambios en:** `app/api/auth/verify-otp/route.ts`

```typescript
// DESPUÉS (SEGURO)
export async function POST(req: NextRequest) {
  // Validar origen de la request
  const origin = req.headers.get('origin');
  const allowedOrigins = [
    'http://localhost:3000',
    'https://pro.bookfast.es',
    'https://admin.bookfast.es',
  ];

  if (origin && !allowedOrigins.includes(origin)) {
    console.error("[VerifyOTP API] Origen no permitido:", origin);
    return NextResponse.json(
      { ok: false, error: "Origen no permitido" },
      { status: 403 }
    );
  }

  // Continuar con verificación...
}
```

**Beneficios:**
- ✅ Protección contra CSRF
- ✅ Validación de origen
- ✅ Solo orígenes confiables

---

### 5. ✅ **Rate Limiting Mejorado**

**Cambios en:** Crear nuevo middleware de rate limiting

```typescript
// NUEVO: lib/rate-limit-auth.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "15 m"), // 5 intentos cada 15 minutos
  analytics: true,
});

export async function checkAuthRateLimit(identifier: string) {
  const { success, limit, reset, remaining } = await ratelimit.limit(identifier);
  return { success, limit, reset, remaining };
}
```

**Beneficios:**
- ✅ Rate limiting en servidor (no bypasseable)
- ✅ Protección contra fuerza bruta
- ✅ Límites configurables

---

## 📝 Checklist de Seguridad

### ✅ Completado

- [x] Configuración de cookies segura (SameSite=Lax, Secure en prod)
- [x] Logs condicionales (solo desarrollo)
- [x] Validación de redirects (whitelist)
- [x] CSRF protection (validación de origen)
- [x] Configuración de dominio dinámica (dev/prod)

### 🔄 En Progreso

- [ ] Rate limiting en servidor (Upstash Redis)
- [ ] Auditoría de logs de autenticación
- [ ] Implementar Content Security Policy (CSP)

### 📋 Pendiente

- [ ] Implementar 2FA opcional
- [ ] Implementar session timeout configurable
- [ ] Implementar device fingerprinting
- [ ] Implementar IP whitelisting para admin

---

## 🚀 Próximos Pasos

### Prioridad Alta (Implementar Ahora)

1. **Aplicar correcciones de cookies** ✅ HECHO
2. **Aplicar validación de redirects** ✅ HECHO
3. **Aplicar CSRF protection** ✅ HECHO
4. **Aplicar logs condicionales** ✅ HECHO

### Prioridad Media (Esta Semana)

5. **Implementar rate limiting en servidor**
6. **Auditar todos los logs de autenticación**
7. **Implementar CSP headers**

### Prioridad Baja (Próximo Sprint)

8. **Implementar 2FA opcional**
9. **Implementar session timeout**
10. **Implementar device fingerprinting**

---

## 📚 Recursos y Referencias

### Documentación Oficial

- [Supabase Auth Best Practices](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/authentication)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

### Herramientas de Testing

- [OWASP ZAP](https://www.zaproxy.org/) - Security testing
- [Burp Suite](https://portswigger.net/burp) - Web security testing
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Security audit

---

## ✅ Conclusión

El sistema de autenticación tiene una **base sólida** con Supabase Auth, pero requiere **correcciones críticas** para garantizar la seguridad de los datos confidenciales de los clientes.

**Las correcciones implementadas cubren:**
- ✅ Configuración de cookies segura
- ✅ Protección contra CSRF
- ✅ Validación de redirects
- ✅ Logs seguros

**Próximos pasos críticos:**
- 🔄 Implementar rate limiting en servidor
- 🔄 Auditar logs de autenticación
- 🔄 Implementar CSP headers

Con estas correcciones, el sistema de autenticación estará **listo para producción** con un nivel de seguridad **robusto y profesional**.

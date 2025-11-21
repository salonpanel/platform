# Mejoras de Autenticación Aplicadas

## Resumen de Cambios

Se han aplicado todas las mejoras recomendadas para estabilizar la autenticación con Magic Link en múltiples pestañas y dominios.

## 1. ✅ Cliente Supabase con Persistencia Multi-Pestaña

### Cambios en `src/lib/supabase/browser.ts`:

- **`detectSessionInUrl: false`** - Deshabilitado porque usamos `remote-callback` en lugar de detección automática desde URL
- **`persistSession: true`** - Habilitado para persistir sesión entre recargas
- **`autoRefreshToken: true`** - Habilitado para refrescar tokens automáticamente
- **`flowType: 'pkce'`** - Usando PKCE para mejor seguridad

**Nota:** `multiTab` está habilitado automáticamente cuando `persistSession: true` y se usa localStorage/IndexedDB. Supabase usa BroadcastChannel para sincronizar cambios entre pestañas.

## 2. ✅ Hook useSession para Manejo Reactivo

### Nuevo archivo: `src/hooks/useSession.ts`

Hook personalizado que proporciona:
- `session` - Sesión actual del usuario
- `isLoading` - Estado de carga (evita redirecciones prematuras)
- `error` - Errores de autenticación

**Uso:**
```typescript
const { session, isLoading, error } = useSession();

if (isLoading) return <LoadingSpinner />;
if (!session) router.push("/login");
```

## 3. ✅ Middleware Mejorado

### Cambios en `middleware.ts`:

- Verificación de cookies de autenticación antes de redirigir
- Evita redirecciones prematuras cuando la sesión está inicializándose
- Verifica `sb-panel-auth-auth-token` y `sb-panel-auth-refresh-token` antes de redirigir

**Lógica:**
```typescript
// Si no hay sesión pero hay cookies de auth, permitir acceso
// (la sesión puede estar inicializándose)
const hasAuthCookies = req.cookies.has("sb-panel-auth-auth-token") || 
                       req.cookies.has("sb-panel-auth-refresh-token");
```

## 4. ✅ emailRedirectTo Configurado Correctamente

### En `app/login/page.tsx`:

- `emailRedirectTo` se construye dinámicamente usando el dominio actual
- Soporta múltiples subdominios (pro.bookfast.es, admin.bookfast.es, etc.)
- URL construida: `https://[subdomain].bookfast.es/auth/remote-callback?request_id=...&token=...`

## 5. ✅ Remote Callback Mejorado

### En `app/auth/remote-callback/route.ts`:

- Usa `exchangeCodeForSession(code)` correctamente
- Maneja errores con logs detallados
- Actualiza la request en la base de datos con tokens
- Cierra sesión en el dispositivo móvil después de guardar tokens

## 6. ✅ Polling y Detección de Sesión

### En `app/login/page.tsx`:

**Múltiples métodos de detección:**
1. **Realtime Subscription** - Escucha cambios en la base de datos (más rápido)
2. **onAuthStateChange** - Detecta cambios de sesión en tiempo real (sincronización entre pestañas)
3. **getSession() polling** - Verificación directa cada 2 segundos
4. **API polling** - Verificación del estado de la request cada 3 segundos

**Logs detallados:**
- `[Login] Running direct session check...` - Cada verificación
- `[Login] 🔔 onAuthStateChange event:` - Cada evento de cambio
- `[Login] ✅ Session found` - Cuando se detecta la sesión

## 7. ✅ Verificación de Sesión en Panel Layout

### En `app/panel/layout-client.tsx`:

- Verificación inicial de sesión antes de cargar el tenant
- Estado `sessionLoading` para evitar redirecciones prematuras
- Muestra "Verificando sesión..." mientras se verifica

## Configuración Requerida en Supabase

### Redirect URLs (Authentication → URL Configuration):

```
https://bookfast.es/auth/callback
https://bookfast.es/auth/remote-callback
https://www.bookfast.es/auth/callback
https://www.bookfast.es/auth/remote-callback
https://pro.bookfast.es/auth/callback
https://pro.bookfast.es/auth/remote-callback
https://admin.bookfast.es/auth/callback
https://admin.bookfast.es/auth/remote-callback
```

O usando wildcards:
```
https://*.bookfast.es/auth/callback
https://*.bookfast.es/auth/remote-callback
```

### Site URL:
```
https://pro.bookfast.es
```

### Cookie Domain:
- Las cookies se establecen automáticamente en el dominio actual
- Para compartir entre subdominios, Supabase debe configurar el dominio como `.bookfast.es`
- Esto se maneja automáticamente cuando se usa el mismo dominio base

## Flujo Completo de Autenticación

1. **Usuario solicita magic link** → Se crea request en BD
2. **Se configuran 4 métodos de detección:**
   - Realtime subscription
   - onAuthStateChange listener
   - getSession() polling (cada 2s)
   - API polling (cada 3s)
3. **Usuario hace clic en magic link** → Se ejecuta `/auth/remote-callback`
4. **Remote callback:**
   - Intercambia code por sesión
   - Guarda tokens en la request
   - Cierra sesión en dispositivo móvil
5. **Cualquiera de los 4 métodos detecta la sesión** → Redirige al panel
6. **Panel layout verifica sesión** → Carga tenant y muestra contenido

## Próximos Pasos

1. ✅ Verificar que todas las Redirect URLs estén configuradas en Supabase
2. ✅ Probar el flujo completo en producción
3. ✅ Revisar logs de Vercel para verificar que todo funciona
4. ✅ Verificar que el favicon se muestre correctamente en todos los subdominios

## Troubleshooting

### Problema: "redirect_uri_mismatch"
**Solución:** Verificar que la URL exacta esté en Redirect URLs de Supabase

### Problema: Sesión no se detecta en pestaña original
**Solución:** Verificar logs de `[Login]` para ver si los listeners están activos

### Problema: Redirección a /login después de autenticarse
**Solución:** Verificar logs de `[Middleware]` y `[PanelLayout]` para ver si hay redirecciones prematuras

### Problema: Polling muestra `status: 'pending'` indefinidamente
**Solución:** Revisar logs de Vercel para ver si `/auth/remote-callback` se está ejecutando correctamente


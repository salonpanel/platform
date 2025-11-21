# Verificación del Flujo de Login Remoto

## ✅ Checklist de Verificación

### 1. Variables de Entorno

Verificar que en **Vercel (Production)** y en **.env.local** estén configuradas:

```env
NEXT_PUBLIC_APP_URL=https://pro.bookfast.es
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ... (solo servidor, nunca en cliente)
```

**⚠️ CRÍTICO:** `NEXT_PUBLIC_APP_URL` debe coincidir exactamente con `https://pro.bookfast.es` (sin trailing slash, sin www).

### 2. Migración SQL

Verificar que la migración `0078_create_auth_login_requests.sql` esté aplicada:

```sql
-- Verificar que la tabla existe
SELECT * FROM information_schema.tables 
WHERE table_name = 'auth_login_requests';

-- Verificar RLS está activo
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'auth_login_requests';
```

### 3. Callbacks y Cookies

#### `/auth/callback` (flujo tradicional)
- ✅ Usa `createRouteHandlerClient({ cookies })`
- ✅ Llama a `exchangeCodeForSession(code)` que setea cookies automáticamente
- ✅ Valida `NEXT_PUBLIC_APP_URL` antes de redirigir

#### `/auth/remote-callback` (flujo remoto)
- ✅ Usa `createRouteHandlerClient({ cookies })`
- ✅ Intercambia `code` por sesión temporal
- ✅ Guarda tokens en `auth_login_requests` usando `service_role`
- ✅ Cierra sesión en el móvil (`supabase.auth.signOut()`)

### 4. Pantalla de Espera (Desktop)

En `app/login/page.tsx`, verificar:

#### ✅ `handleApprovedRequest` llama correctamente a `setSession`:

```typescript
const { data, error } = await supabase.auth.setSession({
  access_token: accessToken,
  refresh_token: refreshToken,
});
```

#### ✅ Usa `getSupabaseBrowser()` que retorna cliente con:
- `persistSession: true`
- `autoRefreshToken: true`
- `detectSessionInUrl: true`

#### ✅ Después de `setSession` exitoso:
- Limpia tokens del servidor (llama a `/api/auth/login-request/consume`)
- Limpia polling y realtime subscriptions
- Redirige con `router.replace(redirectPath || "/panel")`

### 5. Layout del Panel (Server-side)

En `app/panel/layout.tsx`:

#### ✅ Usa `createServerComponentClient({ cookies })`:

```typescript
const supabase = createServerComponentClient({ cookies });
const { data: { user }, error } = await supabase.auth.getUser();
```

#### ✅ Si no hay usuario, redirige a login:

```typescript
if (!user || error) {
  redirect(`/login?redirect=${encodeURIComponent("/panel")}`);
}
```

### 6. Rutas Protegidas

Todas las rutas bajo `/panel/*` deben:
- ✅ Confiar en el layout server-side para verificación de sesión
- ✅ NO duplicar lógica de autenticación
- ✅ NO lanzar `AuthSessionMissingError` si hay sesión válida

## 🔍 Diagnóstico de Problemas

### Problema: "Sigue pidiendo login al cambiar de sección"

#### Paso 1: Verificar cookies en DevTools
1. Abre DevTools → Application → Cookies
2. Busca cookies que empiecen con `sb-` (ej: `sb-xxx-auth-token`)
3. Verifica que:
   - Existen después del login
   - Tienen el dominio correcto (`pro.bookfast.es`)
   - No están marcadas como `HttpOnly: false` (deben ser `true`)

#### Paso 2: Verificar que `setSession` se ejecutó
1. En la consola del navegador, después del login remoto, busca:
   ```
   Error setting session: ...
   ```
2. Si hay error, revisa los tokens que se están pasando

#### Paso 3: Verificar que el servidor lee las cookies
1. Añade logs temporales en `app/panel/layout.tsx`:
   ```typescript
   const { data: { user }, error } = await supabase.auth.getUser();
   console.log("[PanelLayout] User:", user?.id, "Error:", error?.message);
   ```
2. Revisa los logs de Vercel para ver si el servidor ve la sesión

#### Paso 4: Verificar `NEXT_PUBLIC_APP_URL`
1. En Vercel, verifica que `NEXT_PUBLIC_APP_URL=https://pro.bookfast.es`
2. En los callbacks, verifica que el host coincida:
   ```typescript
   if (url.host !== allowedHost) {
     // Esto rechazaría la request
   }
   ```

### Problema: "El móvil se queda logueado"

#### Verificar `/auth/remote-callback`:
1. Debe llamar a `supabase.auth.signOut()` después de guardar tokens
2. Debe redirigir a `/auth/remote-confirmed` (NO a `/panel`)

### Problema: "Realtime no detecta la aprobación"

#### Verificar:
1. Realtime está habilitado en Supabase para `auth_login_requests`
2. El polling fallback está activo (cada 3 segundos)
3. La subscription se crea correctamente:
   ```typescript
   const channel = supabase
     .channel(`login-request-${requestId}`)
     .on("postgres_changes", { ... })
   ```

## 🧪 Testing

### Test Manual Completo

1. **PC:** Abre `https://pro.bookfast.es/login`
2. **PC:** Introduce email y envía magic link
3. **PC:** Verifica que aparece "Esperando confirmación..."
4. **Móvil:** Abre email y haz clic en magic link
5. **Móvil:** Verifica que aparece "Login confirmado" (NO el panel)
6. **PC:** Verifica que se redirige automáticamente a `/panel`
7. **PC:** Navega a `/panel/agenda` → NO debe pedir login
8. **PC:** Navega a otras secciones → NO debe pedir login
9. **Móvil:** Cierra y abre la app → NO debe estar logueado

### Test de Cookies

1. Después del login, en DevTools → Application → Cookies
2. Debe haber cookies de Supabase (ej: `sb-xxx-auth-token`)
3. Navega a otra sección
4. Las cookies deben persistir

## 📝 Notas Importantes

1. **Timing:** Después de `setSession`, puede haber un pequeño delay antes de que el servidor lea las cookies. Si hay problemas, añadir un pequeño delay antes de redirigir.

2. **Caché del navegador:** Los navegadores cachean agresivamente las sesiones. Si hay problemas, probar en ventana de incógnito.

3. **Service Role:** Los tokens en `auth_login_requests` solo son accesibles via `service_role`. El cliente NUNCA debe leer estos tokens directamente.

4. **Limpieza:** Los tokens se limpian después de usar (llamada a `/api/auth/login-request/consume`). Si falla esta llamada, los tokens quedan expuestos (aunque protegidos por RLS).

## 🔧 Comandos Útiles

```bash
# Verificar build local
npm run build

# Verificar tipos
npm run type-check

# Verificar lint
npm run lint

# Verificar que la migración está aplicada (en Supabase SQL Editor)
SELECT * FROM auth_login_requests LIMIT 1;
```


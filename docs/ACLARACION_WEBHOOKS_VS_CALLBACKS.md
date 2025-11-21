# Aclaración: Webhooks vs Callbacks en Autenticación

## 🔍 Diferencia Fundamental

### Webhooks (POST_SIGN_IN Hook)
- **Se ejecutan en el servidor** (Supabase → Tu API)
- **NO pueden establecer cookies** para el cliente
- **NO pueden redirigir** al usuario
- **Propósito:** Actualizar datos en la base de datos para que el frontend detecte cambios

### Callbacks (/auth/remote-callback, /auth/magic-link-handler)
- **Se ejecutan cuando el cliente hace clic** en el magic link
- **SÍ pueden establecer cookies** usando `exchangeCodeForSession()` o `setSession()`
- **SÍ pueden redirigir** al usuario
- **Propósito:** Establecer la sesión en el navegador del cliente

## ❌ Por qué NO funciona establecer cookies en webhooks

```typescript
// ❌ ESTO NO FUNCIONA en un webhook
export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  await supabase.auth.setSession({ access_token, refresh_token });
  // ❌ Las cookies se establecen en el SERVIDOR, no en el cliente que hizo clic
  // ❌ El cliente nunca recibirá estas cookies
}
```

**Razón:** El webhook se ejecuta en el servidor cuando Supabase detecta el sign-in. El cliente que hizo clic en el magic link está en un dispositivo diferente y no puede recibir cookies del servidor.

## ✅ Flujo Correcto

### 1. Usuario hace clic en magic link
```
Usuario → Supabase → Redirige a /auth/remote-callback?code=...
```

### 2. Callback establece la sesión
```typescript
// /auth/remote-callback/route.ts
const supabase = createRouteHandlerClient({ cookies });
const { data } = await supabase.auth.exchangeCodeForSession(code);
// ✅ Esto establece las cookies en el navegador del cliente
```

### 3. Webhook actualiza la base de datos
```typescript
// /api/webhooks/supabase-auth/route.ts (se ejecuta en paralelo)
// Actualiza auth_login_requests para que el frontend detecte el cambio
await supabaseAdmin
  .from("auth_login_requests")
  .update({ status: "approved" })
  .eq("id", requestId);
```

### 4. Frontend detecta el cambio
```typescript
// El frontend (ventana original) detecta el cambio via Realtime o polling
// y redirige al panel
```

## 📋 Responsabilidades

### Webhook (`/api/webhooks/supabase-auth`)
- ✅ Actualizar `auth_login_requests` con status `approved`
- ✅ Establecer `approved_at`
- ❌ NO establecer cookies
- ❌ NO redirigir al usuario

### Callback (`/auth/remote-callback`)
- ✅ Intercambiar `code` por sesión usando `exchangeCodeForSession()`
- ✅ Establecer cookies en el navegador del cliente
- ✅ Redirigir al usuario al panel
- ✅ Actualizar `auth_login_requests` con tokens (opcional)

### Frontend (ventana original)
- ✅ Detectar cambios en `auth_login_requests` via Realtime o polling
- ✅ Establecer sesión usando tokens de `auth_login_requests`
- ✅ Redirigir al panel cuando detecta `status = 'approved'`

## 🔄 Flujo Completo

```
┌─────────────────┐
│ Usuario solicita│
│   magic link    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Se crea request │
│ status: pending │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Usuario hace    │
│ clic en email   │
└────────┬────────┘
         │
         ├─────────────────────────────────┐
         │                                 │
         ▼                                 ▼
┌─────────────────┐              ┌──────────────────┐
│ /auth/remote-   │              │ POST_SIGN_IN     │
│ callback        │              │ Webhook          │
│                 │              │                  │
│ ✅ Establece    │              │ ✅ Actualiza     │
│    cookies      │              │    auth_login_   │
│ ✅ Redirige     │              │    requests      │
└─────────────────┘              └──────────────────┘
         │                                 │
         │                                 │
         └─────────────┬───────────────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ Frontend detecta │
              │ cambio (Realtime)│
              │                  │
              │ ✅ Redirige a    │
              │    panel         │
              └──────────────────┘
```

## 🎯 Conclusión

- **Webhooks:** Actualizan datos en la BD para sincronización
- **Callbacks:** Establecen la sesión en el navegador del cliente
- **Frontend:** Detecta cambios y redirige al usuario

Cada componente tiene su responsabilidad específica y no pueden hacer el trabajo del otro.


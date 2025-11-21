# Flujo de Aprobación Remota de Login

## Resumen

Este documento describe la implementación del flujo de "aprobación remota de login" donde:
- El usuario introduce su email en el ordenador (PC)
- Se muestra una pantalla de "Esperando confirmación"
- El usuario abre el magic link desde otro dispositivo (móvil)
- El móvil aprueba la solicitud pero NO se queda logueado
- El PC detecta la aprobación y se loguea automáticamente

## Arquitectura

### 1. Base de Datos

**Tabla: `auth_login_requests`**

```sql
- id: uuid (PK)
- email: text
- status: 'pending' | 'approved' | 'expired' | 'cancelled'
- created_at: timestamptz
- approved_at: timestamptz
- redirect_path: text (default: '/panel')
- secret_token: text (token secreto para validación)
- supabase_access_token: text (solo accesible via service_role)
- supabase_refresh_token: text (solo accesible via service_role)
```

**RLS Policies:**
- Los usuarios solo pueden leer sus propias requests (sin tokens)
- Los usuarios pueden cancelar sus propias requests pendientes
- Cualquiera puede crear una request (para el flujo de login)
- Los tokens solo son accesibles via `service_role`

**Índices:**
- `email`
- `created_at`
- `status`
- `secret_token`

**TTL:** Las requests con más de 15 minutos se consideran expiradas.

### 2. Flujo Completo

#### Paso 1: Usuario introduce email en PC (`/login`)

1. Usuario introduce email y hace clic en "Enviar enlace mágico"
2. Se crea una `auth_login_requests` con:
   - `email`
   - `status = 'pending'`
   - `redirect_path` (de query param o default `/panel`)
   - `secret_token` (generado aleatoriamente)
3. Se envía magic link de Supabase con `emailRedirectTo` apuntando a:
   ```
   /auth/remote-callback?request_id={requestId}&token={secretToken}
   ```
4. La UI cambia a pantalla de "Esperando confirmación..."

#### Paso 2: Pantalla de Espera (PC)

La pantalla muestra:
- Spinner animado
- Mensaje: "Esperando confirmación de login..."
- Texto explicando que puede abrir el link desde cualquier dispositivo
- Botón "Cancelar" para cancelar la solicitud

**Detección de Aprobación:**
- **Realtime Subscription:** Se suscribe a cambios en `auth_login_requests` usando Supabase Realtime
- **Polling Fallback:** Cada 3 segundos se hace polling a `/api/auth/login-request/status`
- Cuando `status = 'approved'` y existen tokens:
  1. Se llama a `supabase.auth.setSession({ access_token, refresh_token })`
  2. Se limpian los tokens del servidor (llamada a `/api/auth/login-request/consume`)
  3. Se redirige a `redirect_path`

#### Paso 3: Usuario hace clic en magic link desde móvil

1. Supabase redirige a `/auth/remote-callback?code=...&request_id=...&token=...`
2. El handler:
   - Intercambia `code` por sesión temporal (en el móvil)
   - Valida `request_id` y `secret_token`
   - Actualiza `auth_login_requests` con tokens usando `service_role`
   - Marca `status = 'approved'`
   - Cierra sesión en el móvil (`supabase.auth.signOut()`)
   - Redirige a `/auth/remote-confirmed`

#### Paso 4: Página de Confirmación (móvil)

Muestra mensaje:
- "Login confirmado"
- "Vuelve a la ventana donde estabas iniciando sesión"
- "Esta página se puede cerrar"

**IMPORTANTE:** El móvil NO se queda logueado.

#### Paso 5: PC detecta aprobación y se loguea

Cuando el PC detecta que `status = 'approved'`:
1. Obtiene `access_token` y `refresh_token` de la request
2. Llama a `supabase.auth.setSession()`
3. Limpia tokens del servidor
4. Redirige al panel

## API Routes

### `POST /api/auth/login-request/create`
Crea una nueva login request.

**Body:**
```json
{
  "email": "user@example.com",
  "redirectPath": "/panel"
}
```

**Response:**
```json
{
  "requestId": "uuid",
  "secretToken": "random-token",
  "email": "user@example.com",
  "redirectPath": "/panel"
}
```

### `GET /api/auth/login-request/status?requestId={id}`
Obtiene el estado de una request (usado para polling).

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "status": "pending" | "approved" | "expired" | "cancelled",
  "redirectPath": "/panel",
  "accessToken": "token-or-null",
  "refreshToken": "token-or-null"
}
```

### `POST /api/auth/login-request/cancel`
Cancela una request pendiente.

**Body:**
```json
{
  "requestId": "uuid"
}
```

### `POST /api/auth/login-request/consume`
Limpia los tokens de una request después de usarlos (seguridad).

**Body:**
```json
{
  "requestId": "uuid"
}
```

**Requiere:** Usuario autenticado (verifica que el email coincide)

## Rutas

### `/auth/remote-callback`
Handler que procesa el magic link desde el móvil.

**Query Params:**
- `code`: Código de Supabase
- `request_id`: ID de la login request
- `token`: Secret token para validación

**Flujo:**
1. Intercambia `code` por sesión
2. Valida `request_id` y `token`
3. Guarda tokens en la request (via service_role)
4. Cierra sesión en el móvil
5. Redirige a `/auth/remote-confirmed`

### `/auth/remote-confirmed`
Página de confirmación para el móvil.

## Seguridad

1. **Tokens nunca expuestos al cliente:**
   - Los tokens (`supabase_access_token`, `supabase_refresh_token`) solo son accesibles via `service_role`
   - RLS policies previenen que clientes normales lean tokens

2. **Validación de secret_token:**
   - El `secret_token` se valida en `/auth/remote-callback` antes de actualizar la request
   - Solo se genera una vez y se envía en el email

3. **Limpieza de tokens:**
   - Después de usar los tokens, se llaman a `/api/auth/login-request/consume` para limpiarlos
   - Esto previene reutilización de tokens

4. **TTL:**
   - Las requests expiran después de 15 minutos
   - Función `mark_expired_login_requests()` puede ser llamada por cron

5. **Validación de email:**
   - `/api/auth/login-request/consume` verifica que el email del usuario autenticado coincide con el de la request

## Configuración en Supabase

### Authentication → URL Configuration

**Site URL:**
```
https://pro.bookfast.es
```

**Redirect URLs:**
```
https://pro.bookfast.es/auth/remote-callback
https://pro.bookfast.es/auth/callback
http://localhost:3000/auth/remote-callback
http://localhost:3000/auth/callback
```

## Variables de Entorno

```env
NEXT_PUBLIC_APP_URL=https://pro.bookfast.es
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=... (ya configurada)
```

## Migración

Ejecutar la migración:
```bash
supabase migration up
```

O aplicar manualmente:
```sql
-- Ver: supabase/migrations/0078_create_auth_login_requests.sql
```

## Testing

### Flujo Completo

1. **PC:** Ir a `https://pro.bookfast.es/login`
2. **PC:** Introducir email y hacer clic en "Enviar enlace mágico"
3. **PC:** Verificar que aparece pantalla "Esperando confirmación..."
4. **Móvil:** Abrir email y hacer clic en magic link
5. **Móvil:** Verificar que aparece página "Login confirmado"
6. **PC:** Verificar que se redirige automáticamente a `/panel`
7. **PC:** Verificar que está logueado (puede navegar por el panel)
8. **Móvil:** Verificar que NO está logueado (cerrar y abrir app, no debería estar logueado)

### Verificar Seguridad

1. Verificar que tokens no son accesibles desde cliente:
   ```sql
   -- Como usuario normal, intentar leer tokens
   SELECT supabase_access_token FROM auth_login_requests;
   -- Debería fallar o retornar null
   ```

2. Verificar que tokens se limpian después de usar:
   - Después de login exitoso, verificar que `supabase_access_token` y `supabase_refresh_token` son `null` en la request

3. Verificar TTL:
   - Crear una request y esperar 15+ minutos
   - Verificar que `status` cambia a `expired`

## Troubleshooting

### El PC no detecta la aprobación

1. Verificar que Realtime está habilitado en Supabase
2. Verificar que el polling está funcionando (revisar Network tab)
3. Verificar que la request tiene `status = 'approved'` y tokens no nulos

### El móvil se queda logueado

1. Verificar que `/auth/remote-callback` llama a `supabase.auth.signOut()`
2. Verificar que no hay redirección a `/panel` desde el móvil

### Error "invalid_link" o "invalid_session"

1. Verificar que `secret_token` coincide
2. Verificar que `request_id` es válido
3. Verificar que la request tiene `status = 'pending'`
4. Verificar que el código de Supabase no ha expirado

## Notas

- El flujo tradicional de magic link (abrir en el mismo navegador) sigue funcionando a través de `/auth/callback`
- Este flujo de aprobación remota es opcional y se activa automáticamente cuando se crea una login request
- El polling es un fallback si Realtime falla, pero Realtime es preferido para mejor UX




# Configurar Supabase Auth Hooks

## 📋 Resumen

Los Auth Hooks de Supabase permiten ejecutar lógica personalizada cuando ocurren eventos de autenticación. Esto es especialmente útil para:

- ✅ Actualizar automáticamente `auth_login_requests` cuando se detecta un sign-in
- ✅ Permitir que la ventana original detecte el login sin polling agresivo
- ✅ Sincronizar el estado de autenticación entre dispositivos

## 🎯 Hook Recomendado: POST_SIGN_IN

El hook `POST_SIGN_IN` se ejecuta después de cada inicio de sesión exitoso, lo que lo hace ideal para actualizar el estado de las requests de login pendientes.

## 🔧 Configuración en Supabase Dashboard

### Paso 1: Ir a Database Hooks

1. Abre el [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto
3. Ve a **Database** → **Hooks** (o **Database** → **Webhooks** en versiones anteriores)

### Paso 2: Crear un nuevo Hook

1. Haz clic en **"Create a new hook"** o **"Add hook"**
2. Selecciona el tipo: **"Auth Hook"** o **"Database Hook"**
3. Si es Auth Hook, selecciona el evento: **POST_SIGN_IN**

### Paso 3: Configurar el Hook

**Nombre del Hook:**
```
Update Login Requests on Sign In
```

**Tipo de Hook:**
- **Auth Hook** → **POST_SIGN_IN**
- O **Database Hook** → Tabla: `auth.users` → Evento: `INSERT` o `UPDATE`

**URL del Webhook:**
```
https://pro.bookfast.es/api/webhooks/supabase-auth
```

**Método HTTP:**
```
POST
```

**Headers:**
```
Authorization: Bearer {SUPABASE_WEBHOOK_SECRET}
Content-Type: application/json
```

**Secret (SUPABASE_WEBHOOK_SECRET):**
- Genera un secret seguro (puedes usar: `openssl rand -hex 32`)
- Guarda este secret en las variables de entorno de Vercel

### Paso 4: Configurar Variables de Entorno

En **Vercel Dashboard** → **Settings** → **Environment Variables**, agrega:

```
SUPABASE_WEBHOOK_SECRET=tu_secret_generado_aqui
```

**Importante:** Este secret debe ser el mismo que configures en el hook de Supabase.

## 📝 Payload del Hook

Supabase enviará un payload similar a este:

```json
{
  "type": "POST_SIGN_IN",
  "table": "users",
  "record": {
    "id": "uuid-del-usuario",
    "email": "usuario@example.com",
    "email_confirmed_at": "2024-01-01T00:00:00Z",
    "last_sign_in_at": "2024-01-01T00:00:00Z",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "old_record": null
}
```

## 🔒 Seguridad

El endpoint valida que el request viene de Supabase verificando:

1. **Authorization Header:** Debe contener `Bearer {SUPABASE_WEBHOOK_SECRET}`
2. **Secret Match:** El secret debe coincidir con `SUPABASE_WEBHOOK_SECRET` en Vercel

Si el secret no coincide, el endpoint retorna `401 Unauthorized`.

## 🔄 Flujo Completo

1. **Usuario solicita magic link** → Se crea request en `auth_login_requests` con status `pending`
2. **Usuario hace clic en magic link** → Supabase procesa el login
3. **Supabase ejecuta POST_SIGN_IN hook** → Llama a `/api/webhooks/supabase-auth`
4. **El endpoint actualiza la request** → Cambia status a `approved` y establece `approved_at`
5. **Frontend detecta el cambio** → Via Realtime subscription o polling, ve que `status = 'approved'`
6. **Frontend redirige al panel** → Usuario autenticado correctamente

## 🧪 Testing

### Probar el Hook Localmente

1. Usa [ngrok](https://ngrok.com/) para exponer tu servidor local:
   ```bash
   ngrok http 3000
   ```

2. Configura el hook en Supabase con la URL de ngrok:
   ```
   https://tu-dominio-ngrok.ngrok.io/api/webhooks/supabase-auth
   ```

3. Solicita un magic link y haz clic en él

4. Verifica los logs de tu servidor local para ver el payload recibido

### Verificar que Funciona

1. Solicita un magic link desde `/login`
2. Haz clic en el enlace del correo
3. Verifica en los logs de Vercel que el hook se ejecutó:
   ```
   [SupabaseAuthHook] Received hook: { type: 'POST_SIGN_IN', ... }
   [SupabaseAuthHook] Request marked as approved: { requestId: '...', ... }
   ```
4. La ventana original debería detectar el cambio y redirigir automáticamente

## ⚠️ Notas Importantes

1. **Tokens:** El hook se ejecuta antes de que los tokens estén disponibles en el cliente. Los tokens se establecerán cuando el cliente procese el callback (`/auth/remote-callback` o `/auth/magic-link-handler`).

2. **Idempotencia:** El endpoint es idempotente. Si se llama múltiples veces, solo actualizará requests con status `pending`.

3. **Timeout:** Supabase espera una respuesta en menos de 5 segundos. El endpoint debe responder rápidamente.

4. **Retries:** Si el endpoint retorna un error (no 200), Supabase reintentará hasta 3 veces.

## 🔍 Troubleshooting

### El hook no se ejecuta

- Verifica que el hook esté activo en Supabase Dashboard
- Verifica que la URL del webhook sea correcta y accesible
- Verifica que el método HTTP sea `POST`

### Error 401 Unauthorized

- Verifica que `SUPABASE_WEBHOOK_SECRET` esté configurado en Vercel
- Verifica que el header `Authorization` contenga el secret correcto
- Verifica que el secret en Supabase coincida con el de Vercel

### El hook se ejecuta pero no actualiza la request

- Verifica que haya una request pendiente para el email del usuario
- Verifica que la request no haya expirado (más de 15 minutos)
- Revisa los logs de Vercel para ver errores específicos

### La ventana original no detecta el cambio

- Verifica que Realtime esté habilitado para `auth_login_requests`
- Verifica que el frontend esté suscrito a cambios en la tabla
- Verifica que el polling esté activo como fallback

## 📚 Referencias

- [Supabase Database Hooks](https://supabase.com/docs/guides/database/webhooks)
- [Supabase Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)




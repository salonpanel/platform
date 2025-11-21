# Configurar Database Webhooks de Supabase

## 📋 Resumen

Los Database Webhooks de Supabase permiten enviar datos en tiempo real desde tu base de datos a otro sistema cuando ocurre un evento en una tabla (INSERT, UPDATE, DELETE).

Para nuestro caso de uso, queremos detectar cuando un usuario inicia sesión o confirma su email, lo cual se refleja como un UPDATE en la tabla `auth.users`.

## 🎯 Configuración Recomendada

### Opción 1: Database Webhook (Recomendado)

Detecta cambios en `auth.users` cuando:
- `last_sign_in_at` cambia (usuario inicia sesión)
- `email_confirmed_at` se establece (usuario confirma email)

### Opción 2: Auth Hook

Detecta eventos de autenticación directamente:
- `POST_SIGN_IN` - Después de cada inicio de sesión
- `POST_CONFIRMATION` - Después de confirmar email

**Nota:** El endpoint `/api/webhooks/supabase-auth` soporta ambos tipos de webhooks.

## 🔧 Configuración en Supabase Dashboard

### Paso 1: Ir a Database Webhooks

1. Abre el [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto
3. Ve a **Database** → **Webhooks**
4. Haz clic en **"Create a new webhook"**

### Paso 2: Configurar el Webhook

**Nombre del Webhook:**
```
Update Login Requests on Auth Users Update
```

**Tabla:**
```
auth.users
```

**Eventos:**
- ✅ **UPDATE** (marcar solo este)

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

**HTTP Version:**
```
HTTP/1.1
```

### Paso 3: Configurar Filtros (Opcional)

Puedes agregar filtros para que el webhook solo se active cuando campos específicos cambian:

**Filtro (opcional):**
```sql
-- Solo activar cuando last_sign_in_at o email_confirmed_at cambian
-- Esto se maneja en el código del endpoint, pero puedes agregar filtros aquí también
```

### Paso 4: Configurar Variables de Entorno

En **Vercel Dashboard** → **Settings** → **Environment Variables**, asegúrate de tener:

```
SUPABASE_WEBHOOK_SECRET=tu_secret_generado_aqui
```

**Generar secret:**
```bash
openssl rand -hex 32
```

## 📝 Payload del Database Webhook

Supabase enviará un payload similar a este cuando se actualice `auth.users`:

```json
{
  "type": "UPDATE",
  "table": "auth.users",
  "record": {
    "id": "uuid-del-usuario",
    "email": "usuario@example.com",
    "email_confirmed_at": "2024-01-01T00:00:00Z",
    "last_sign_in_at": "2024-01-01T00:00:00Z",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "old_record": {
    "id": "uuid-del-usuario",
    "email": "usuario@example.com",
    "email_confirmed_at": null,
    "last_sign_in_at": null,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

## 🔍 Cómo Funciona

1. **Usuario hace clic en magic link** → Supabase procesa el login
2. **Supabase actualiza `auth.users`** → Establece `last_sign_in_at` o `email_confirmed_at`
3. **Database Webhook se activa** → Llama a `/api/webhooks/supabase-auth`
4. **El endpoint detecta el cambio** → Compara `old_record` con `record`
5. **Si `last_sign_in_at` o `email_confirmed_at` cambió** → Actualiza `auth_login_requests`
6. **Frontend detecta el cambio** → Via Realtime o polling, redirige al panel

## 🧪 Testing

### Probar el Webhook Localmente

1. Usa [ngrok](https://ngrok.com/) para exponer tu servidor local:
   ```bash
   ngrok http 3000
   ```

2. Configura el webhook en Supabase con la URL de ngrok:
   ```
   https://tu-dominio-ngrok.ngrok.io/api/webhooks/supabase-auth
   ```

3. Solicita un magic link y haz clic en él

4. Verifica los logs de tu servidor local para ver el payload recibido

### Verificar que Funciona

1. Solicita un magic link desde `/login`
2. Haz clic en el enlace del correo
3. Verifica en los logs de Vercel que el webhook se ejecutó:
   ```
   [SupabaseWebhook] Database webhook - auth.users UPDATE: {
     userId: 'uuid',
     email: 'present',
     lastSignInChanged: true,
     emailConfirmedChanged: false
   }
   [SupabaseWebhook] Request marked as approved: { requestId: '...', ... }
   ```
4. La ventana original debería detectar el cambio y redirigir automáticamente

## ⚠️ Notas Importantes

1. **Performance:** Los Database Webhooks se ejecutan después de cada UPDATE en `auth.users`. El endpoint filtra solo los cambios relevantes (`last_sign_in_at` o `email_confirmed_at`).

2. **Idempotencia:** El endpoint es idempotente. Si se llama múltiples veces, solo actualizará requests con status `pending`.

3. **Timeout:** Supabase espera una respuesta en menos de 5 segundos. El endpoint debe responder rápidamente.

4. **Retries:** Si el endpoint retorna un error (no 200), Supabase reintentará hasta 3 veces.

## 🔒 Seguridad

El endpoint valida que el request viene de Supabase verificando:

1. **Authorization Header:** Debe contener `Bearer {SUPABASE_WEBHOOK_SECRET}`
2. **Secret Match:** El secret debe coincidir con `SUPABASE_WEBHOOK_SECRET` en Vercel

Si el secret no coincide, el endpoint retorna `401 Unauthorized`.

## 🔄 Comparación: Database Webhook vs Auth Hook

| Característica | Database Webhook | Auth Hook |
|----------------|------------------|-----------|
| **Cuándo se activa** | Después de UPDATE en `auth.users` | Después de evento de auth |
| **Payload** | `{ type: "UPDATE", table: "auth.users", record, old_record }` | `{ type: "POST_SIGN_IN", record }` |
| **Filtrado** | Necesita comparar `old_record` vs `record` | Ya viene filtrado por tipo de evento |
| **Flexibilidad** | Puede detectar cualquier cambio | Solo eventos específicos |
| **Performance** | Se ejecuta en cada UPDATE | Solo en eventos de auth |

**Recomendación:** Usa Database Webhook si quieres más control sobre qué cambios detectar. Usa Auth Hook si solo necesitas eventos de autenticación.

## 📚 Referencias

- [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks)
- [Supabase Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)




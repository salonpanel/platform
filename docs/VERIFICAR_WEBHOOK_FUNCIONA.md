# Verificar que el Webhook Funciona Correctamente

## ✅ Configuración Completada

Has configurado:
- ✅ Webhook secret generado
- ✅ Webhook creado en Supabase
- ✅ Variable de entorno en Vercel

## 🧪 Pasos para Probar

### 1. Verificar que el Webhook está Activo

En Supabase Dashboard:
1. Ve a **Database** → **Webhooks**
2. Verifica que tu webhook aparezca en la lista
3. Verifica que esté **"Active"** o habilitado (debe tener un toggle o indicador verde)

### 2. Probar el Flujo Completo

1. **Abre tu aplicación en producción:**
   ```
   https://pro.bookfast.es/login
   ```

2. **Solicita un magic link:**
   - Ingresa tu email
   - Haz clic en "Enviar magic link"

3. **Abre tu correo y haz clic en el enlace del magic link**

4. **Revisa los logs de Vercel:**
   - Ve a [Vercel Dashboard](https://vercel.com)
   - Selecciona tu proyecto
   - Ve a **Deployments** → Último deployment → **Logs**
   - Busca mensajes que empiecen con `[SupabaseWebhook]`

### 3. Logs Esperados (Si Funciona)

Deberías ver algo como:

```
[SupabaseWebhook] Received hook: {
  type: 'UPDATE',
  userId: 'uuid-del-usuario',
  email: 'present',
  lastSignInChanged: true,
  emailConfirmedChanged: false
}
[SupabaseWebhook] Request marked as approved: {
  requestId: 'uuid-de-la-request',
  email: 'tu-email@example.com',
  redirectPath: '/panel',
  hookType: 'Database Webhook'
}
```

### 4. Logs de Error (Si No Funciona)

Si ves esto, hay un problema:

```
[SupabaseWebhook] Invalid authorization header
```
**Solución:** El secret en Supabase no coincide con el de Vercel. Verifica que ambos tengan el mismo valor.

```
[SupabaseWebhook] SUPABASE_WEBHOOK_SECRET no configurado
```
**Solución:** La variable de entorno no está configurada en Vercel. Ve a Settings → Environment Variables.

```
[SupabaseWebhook] No pending request found for email: ...
```
**Esto es normal** si no hay una request pendiente (puede ser un login directo sin request).

## 🎯 Verificar que la Ventana Original Detecta el Cambio

1. **Abre dos pestañas:**
   - Pestaña 1: `/login` (donde solicitas el magic link)
   - Pestaña 2: Tu correo (donde haces clic en el enlace)

2. **En la pestaña 1 (login):**
   - Deberías ver "Esperando confirmación de login..."
   - Abre la consola del navegador (F12)

3. **En la pestaña 2 (correo):**
   - Haz clic en el magic link
   - Debería redirigir a `/auth/remote-callback` o `/auth/magic-link-handler`

4. **Vuelve a la pestaña 1:**
   - Debería detectar el cambio automáticamente
   - Debería redirigir a `/panel`
   - En la consola deberías ver:
     ```
     [Login] ✅ Session found
     [Login] Redirecting to panel...
     ```

## 🔍 Troubleshooting

### El webhook no se ejecuta

**Verifica:**
1. ✅ El webhook está activo en Supabase
2. ✅ La URL es correcta: `https://pro.bookfast.es/api/webhooks/supabase-auth`
3. ✅ El método es `POST`
4. ✅ El header `Authorization` está configurado con `Bearer {secret}`

### El webhook se ejecuta pero no actualiza la request

**Verifica:**
1. ✅ Hay una request pendiente en `auth_login_requests` para ese email
2. ✅ La request no ha expirado (menos de 15 minutos)
3. ✅ Revisa los logs de Vercel para ver errores específicos

### La ventana original no detecta el cambio

**Verifica:**
1. ✅ Realtime está habilitado para `auth_login_requests`
2. ✅ El frontend está suscrito a cambios en la tabla
3. ✅ El polling está activo como fallback
4. ✅ Revisa la consola del navegador para ver errores

## 📊 Monitoreo Continuo

Para monitorear que el webhook funciona correctamente:

1. **En Vercel Logs:**
   - Busca `[SupabaseWebhook]` para ver todos los eventos
   - Verifica que no haya errores repetidos

2. **En Supabase Dashboard:**
   - Ve a **Database** → **Webhooks**
   - Haz clic en tu webhook
   - Revisa el historial de ejecuciones (si está disponible)

3. **En la Base de Datos:**
   - Verifica que `auth_login_requests` se actualice correctamente
   - El campo `status` debería cambiar de `pending` a `approved`
   - El campo `approved_at` debería establecerse

## ✅ Checklist Final

- [ ] Webhook creado en Supabase
- [ ] Webhook activo/habilitado
- [ ] Header `Authorization` configurado con `Bearer {secret}`
- [ ] Variable `SUPABASE_WEBHOOK_SECRET` en Vercel
- [ ] Secret coincide en ambos lugares
- [ ] Probar el flujo completo
- [ ] Verificar logs en Vercel
- [ ] Verificar que la ventana original detecta el cambio

## 🎉 Si Todo Funciona

Si ves los logs correctos y la ventana original redirige automáticamente, ¡el webhook está funcionando perfectamente!

El flujo completo debería ser:
1. Usuario solicita magic link → Request creada
2. Usuario hace clic en el enlace → Supabase procesa login
3. Webhook se ejecuta → Actualiza `auth_login_requests`
4. Frontend detecta cambio → Redirige al panel

¡Todo listo! 🚀


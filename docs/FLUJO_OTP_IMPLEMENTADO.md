# Flujo OTP Implementado

## Resumen

Se ha implementado un sistema de autenticación por código OTP (One-Time Password) que reemplaza completamente el sistema anterior de Magic Link. El nuevo flujo es más simple, más seguro y ofrece una mejor experiencia de usuario.

## Cambios Realizados

### 1. Configuración de Supabase

**Archivo:** `docs/CONFIGURAR_OTP_SUPABASE.md`

- Plantilla de email modificada para enviar códigos de 6 dígitos en lugar de enlaces
- Expiración configurada a 10 minutos (recomendado)
- Límites de envío respetados (1 código/minuto, 30/hora)

### 2. Frontend

#### Pantalla de Login (`app/login/page.tsx`)
- Formulario simple para ingresar email
- Envío de código OTP usando `supabase.auth.signInWithOtp()`
- Manejo de errores (rate limit, email inválido, etc.)
- Redirección automática a la página de verificación

#### Pantalla de Verificación (`app/login/verify-code/page.tsx`)
- Formulario para ingresar código de 6 dígitos
- Validación en tiempo real
- Botón de reenvío con contador de 60 segundos
- Verificación usando `supabase.auth.verifyOtp()`
- Redirección automática al panel tras verificación exitosa

### 3. Backend

#### Eliminado
- `app/auth/remote-callback/route.ts` - Ya no necesario
- `app/auth/magic-link-handler/page.tsx` - Ya no necesario
- `app/auth/remote-confirmed/page.tsx` - Ya no necesario
- `app/api/auth/login-request/*` - Sistema obsoleto
- `app/api/auth/login/approve/route.ts` - Ya no necesario

#### Simplificado
- `app/api/webhooks/supabase-auth/route.ts` - Solo registra eventos para auditoría
- `middleware.ts` - Eliminada toda la lógica de Magic Link

### 4. Middleware

**Archivo:** `middleware.ts`

- Eliminada toda la lógica de detección y redirección de Magic Links
- Simplificado para solo manejar callbacks normales de Supabase (por si acaso)
- Mantiene protección de rutas `/panel/*`

## Flujo de Autenticación

### Paso 1: Solicitar Código
1. Usuario ingresa su email en `/login`
2. Frontend llama a `supabase.auth.signInWithOtp({ email })`
3. Supabase genera un código de 6 dígitos y lo envía por email
4. Usuario es redirigido a `/login/verify-code?email=...`

### Paso 2: Verificar Código
1. Usuario ingresa el código de 6 dígitos recibido por email
2. Frontend llama a `supabase.auth.verifyOtp({ email, token, type: 'email' })`
3. Si el código es válido, Supabase crea la sesión automáticamente
4. Usuario es redirigido a `/panel`

### Reenvío de Código
- Disponible después de 60 segundos
- Máximo 30 códigos por hora por usuario
- El código anterior se invalida al solicitar uno nuevo

## Ventajas del Nuevo Sistema

1. **Simplicidad**: No requiere múltiples pestañas, callbacks complejos ni polling
2. **Seguridad**: Códigos de corta duración (10 min), un solo uso, rate limiting automático
3. **UX Mejorada**: Usuario permanece en la app, no necesita abrir email en otra pestaña
4. **Menos Código**: Eliminadas ~1000 líneas de código relacionadas con Magic Link
5. **Mantenibilidad**: Flujo más directo, menos puntos de fallo

## Compatibilidad

- ✅ Usuarios existentes: Funciona igual, solo cambia el método de autenticación
- ✅ Administradores: Pueden seguir usando otros métodos si están configurados
- ✅ Sesiones activas: No se invalidan, siguen funcionando normalmente
- ✅ RLS y permisos: No cambian, siguen funcionando igual

## Configuración Requerida

Antes de usar el sistema en producción:

1. **Configurar plantilla de email en Supabase** (ver `docs/CONFIGURAR_OTP_SUPABASE.md`)
2. **Configurar expiración del OTP** a 10 minutos
3. **Verificar límites de envío** (considerar SMTP personalizado si es necesario)

## Pruebas

### Flujo Exitoso
1. Ingresar email → Recibir código → Ingresar código → Acceder al panel ✅

### Casos de Error
- **Código incorrecto**: Muestra error, permite reintentar
- **Código expirado**: Muestra error, permite solicitar uno nuevo
- **Rate limit**: Muestra mensaje, espera 60 segundos
- **Email inválido**: Validación en frontend y backend

## Monitoreo

El webhook `app/api/webhooks/supabase-auth/route.ts` registra todos los eventos de autenticación para auditoría:
- POST_SIGN_IN: Cuando un usuario inicia sesión
- POST_CONFIRMATION: Cuando un usuario confirma su email
- UPDATE en auth.users: Cuando cambia last_sign_in_at

## Rollback

Si es necesario volver a Magic Link:
1. Restaurar plantilla de email en Supabase
2. Revertir cambios en `app/login/page.tsx`
3. Restaurar archivos eliminados (si están en git)

## Próximos Pasos

- [ ] Configurar plantilla de email en Supabase
- [ ] Probar flujo completo en staging
- [ ] Monitorear logs de autenticación
- [ ] Considerar SMTP personalizado si hay muchos usuarios




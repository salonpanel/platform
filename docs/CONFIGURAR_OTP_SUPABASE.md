# Configurar OTP en Supabase

## 1. Habilitar OTP en lugar de Magic Link

1. Ve a **Authentication > Email Templates > Magic Link** en el panel de Supabase
2. Edita la plantilla reemplazando el contenido por:

```html
<h2>Código de acceso</h2>
<p>Introduce este código en la app: <strong>{{ .Token }}</strong></p>
<p>Este código expira en 10 minutos.</p>
```

**IMPORTANTE:**
- **NO incluyas** `{{ .ConfirmationURL }}` en la plantilla
- Esto hace que Supabase envíe un código numérico en lugar de un enlace
- El código será de 6 dígitos

3. Ajusta el **asunto** del correo a algo como: "Tu código de inicio de sesión"

## 2. Configurar expiración del OTP

1. Ve a **Auth > Settings > Providers > Email**
2. Busca **Email OTP Expiration**
3. Configura a **600 segundos (10 minutos)** para mayor seguridad
   - Por defecto es 3600 segundos (1 hora)
   - Recomendado: 10-15 minutos

## 3. Verificar límites de envío

- **Límite por usuario**: 1 código por minuto, máximo 30 por hora
- **Límite de emails de autenticación**: ~2 emails por hora por usuario (sin SMTP personalizado)
- **Límite de verificación**: ~360 intentos por hora por IP

**Nota:** Si necesitas más emails, configura un SMTP personalizado en **Auth > Settings > Custom SMTP**

## 4. Verificar que Email Auth está activado

1. Ve a **Auth > Settings > Providers**
2. Asegúrate de que **Email** esté habilitado
3. No es necesario deshabilitar otros métodos (password, OAuth, etc.)

## 5. (Opcional) Deshabilitar confirmación de email duplicada

Si usas `shouldCreateUser: true` en `signInWithOtp`, los usuarios nuevos se crean automáticamente. Para evitar doble verificación:

1. Ve a **Auth > Settings > Email Confirmations**
2. Considera deshabilitar "Confirm email" si quieres que el OTP sea suficiente

## Verificación

Después de configurar:
1. Solicita un código OTP desde la app
2. Revisa tu correo - deberías recibir un email con un código de 6 dígitos
3. El código NO debe incluir ningún enlace




# Configuración de Variables de Entorno

Este documento explica cómo configurar las variables de entorno necesarias para que la plataforma funcione correctamente.

## 📋 Archivo .env.local

Crea un archivo `.env.local` en la raíz del proyecto con las siguientes variables:

```env
# URL de la aplicación (obligatorio para producción, opcional en desarrollo)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase (obligatorio)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui

# Stripe (opcional, necesario para pagos)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_DEFAULT_CURRENCY=eur

# Upstash (opcional, necesario para rate limiting)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# reCAPTCHA (opcional, necesario para protección anti-spam)
RECAPTCHA_SECRET_KEY=...
RECAPTCHA_SITE_KEY=...

# Cron Jobs (obligatorio para producción)
# Genera una clave aleatoria fuerte (mínimo 32 caracteres)
# Esta clave protege los endpoints de cron jobs internos
INTERNAL_CRON_KEY=clave-secreta-aleatoria-minimo-32-caracteres
```

## 🔑 Dónde Obtener las Claves

### Supabase

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Settings > API
3. Copia:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ mantener secreto)

### Stripe

1. Ve a [Stripe Dashboard](https://dashboard.stripe.com)
2. Developers > API keys
3. Copia:
   - **Secret key** → `STRIPE_SECRET_KEY`
   - Para webhook: Developers > Webhooks > Añadir endpoint → copia el **Signing secret**

### Upstash (Opcional)

1. Crea cuenta en [Upstash](https://upstash.com)
2. Crea una base de datos Redis
3. Copia:
   - **UPSTASH_REDIS_REST_URL**
   - **UPSTASH_REDIS_REST_TOKEN**

### reCAPTCHA (Opcional)

1. Ve a [Google reCAPTCHA](https://www.google.com/recaptcha/admin)
2. Crea un sitio (tipo v3)
3. Copia:
   - **Site Key** → `RECAPTCHA_SITE_KEY`
   - **Secret Key** → `RECAPTCHA_SECRET_KEY`

## 🚀 Desarrollo Local

Para desarrollo local, **mínimo necesitas**:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_key
```

`NEXT_PUBLIC_APP_URL` es opcional en desarrollo - el sistema usará `http://localhost:3000` automáticamente.

## ⚠️ Importante

- **NUNCA** subas `.env.local` a Git (ya está en `.gitignore`)
- **NUNCA** expongas `SUPABASE_SERVICE_ROLE_KEY` o `STRIPE_SECRET_KEY` en el cliente
- En **producción**, configura todas las variables en tu plataforma de hosting (Vercel, etc.)

## 🔄 Reiniciar Servidor

Después de crear o modificar `.env.local`, **reinicia el servidor de desarrollo**:

```bash
# Detén el servidor (Ctrl+C) y vuelve a iniciarlo
npm run dev
```

## ✅ Verificación

Para verificar que las variables están configuradas:

1. Reinicia el servidor
2. Intenta hacer login
3. Si ves errores, revisa la consola del servidor



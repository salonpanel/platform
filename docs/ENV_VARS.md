# Variables de Entorno para Vercel Deployment

Este documento lista todas las variables de entorno usadas en el proyecto y su configuración para deployment en Vercel.

## Variables de Entorno por Categoría

### 🔵 Frontend (NEXT_PUBLIC_*)

Estas variables se exponen al cliente y están disponibles en el bundle del navegador.

#### `NEXT_PUBLIC_SUPABASE_URL` (Obligatorio)
- **Tipo**: Público (Frontend)
- **Descripción**: URL del proyecto Supabase
- **Formato**: `https://tu-proyecto.supabase.co`
- **Uso**: Configuración del cliente de Supabase en el navegador
- **Dónde se usa**: 
  - `src/lib/supabase/browser.ts`
  - `app/supabase-provider.tsx`
  - Componentes client que usan Supabase

#### `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Obligatorio)
- **Tipo**: Público (Frontend)
- **Descripción**: Clave pública anónima de Supabase (read-only por defecto)
- **Formato**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Uso**: Autenticación y acceso público a Supabase desde el cliente
- **Seguridad**: Esta clave es pública, pero está protegida por RLS en Supabase

#### `NEXT_PUBLIC_APP_URL` (Obligatorio en Producción)
- **Tipo**: Público (Frontend)
- **Descripción**: URL base de la aplicación
- **Formato**: 
  - Producción: `https://tu-dominio.com`
  - Preview: `https://tu-proyecto-git-branch-...vercel.app`
  - Desarrollo: Opcional (se infiere de la request)
- **Uso**: 
  - Callbacks de autenticación (`app/auth/callback/route.ts`)
  - Enlaces de magic links
  - Validación de host/origen en callbacks
- **Nota**: En desarrollo puede estar vacío, pero en producción es obligatorio

#### `NEXT_PUBLIC_ENABLE_DEV_LOGIN` (Opcional, Solo Desarrollo)
- **Tipo**: Público (Frontend)
- **Descripción**: Flag para habilitar endpoint de dev-login
- **Valor**: `"true"` (string) para habilitar, no definida en producción
- **Uso**: Control adicional de seguridad para `/api/auth/dev-login`
- **⚠️ IMPORTANTE**: Nunca definir esta variable en producción

---

### 🔴 Backend (Solo Server-Side)

Estas variables son secretos y **NUNCA** deben exponerse al cliente.

#### `SUPABASE_SERVICE_ROLE_KEY` (Obligatorio)
- **Tipo**: Secreto (Backend)
- **Descripción**: Clave de servicio de Supabase con permisos de administrador
- **Formato**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Uso**: 
  - Operaciones administrativas en Supabase
  - Endpoints API que necesitan bypass de RLS
  - Migraciones y operaciones de sistema
- **Dónde se usa**: 
  - `src/lib/supabase/server.ts`
  - `app/api/auth/dev-login/route.ts`
  - Endpoints que requieren permisos elevados
- **⚠️ CRÍTICO**: Nunca usar como `NEXT_PUBLIC_*`

#### `STRIPE_SECRET_KEY` (Obligatorio si hay pagos)
- **Tipo**: Secreto (Backend)
- **Descripción**: Clave secreta de Stripe
- **Formato**: 
  - Producción: `sk_live_...`
  - Desarrollo: `sk_test_...`
- **Uso**: 
  - Creación de Payment Intents
  - Sincronización de servicios con Stripe
  - Operaciones de pago
- **Dónde se usa**: 
  - `src/lib/stripe.ts`
  - `app/api/checkout/` routes
  - `app/api/payments/services/sync/route.ts`
- **⚠️ CRÍTICO**: Nunca exponer al cliente

#### `STRIPE_WEBHOOK_SECRET` (Obligatorio si hay webhooks)
- **Tipo**: Secreto (Backend)
- **Descripción**: Secret para verificar webhooks de Stripe
- **Formato**: `whsec_...`
- **Uso**: Verificación de firma de webhooks de Stripe
- **Dónde se usa**: `app/api/webhooks/stripe/route.ts`
- **⚠️ CRÍTICO**: Nunca exponer al cliente

#### `UPSTASH_REDIS_REST_URL` (Opcional, recomendado)
- **Tipo**: Secreto (Backend)
- **Descripción**: URL REST de Upstash Redis
- **Formato**: `https://...upstash.io`
- **Uso**: Rate limiting y caché distribuido
- **Dónde se usa**: 
  - `src/lib/rate-limit.ts`
  - Tests de rate limiting
- **⚠️ CRÍTICO**: Nunca exponer al cliente

#### `UPSTASH_REDIS_REST_TOKEN` (Opcional, recomendado)
- **Tipo**: Secreto (Backend)
- **Descripción**: Token de autenticación de Upstash Redis
- **Formato**: String alfanumérico largo
- **Uso**: Autenticación en requests a Upstash Redis
- **Dónde se usa**: `src/lib/rate-limit.ts`
- **⚠️ CRÍTICO**: Nunca exponer al cliente

#### `INTERNAL_CRON_KEY` (Obligatorio en Producción)
- **Tipo**: Secreto (Backend)
- **Descripción**: Clave secreta para proteger endpoints de cron jobs internos
- **Formato**: String aleatorio fuerte (mínimo 32 caracteres recomendado)
- **Uso**: 
  - Protección de `/api/internal/cron/release-holds`
  - Protección de `/api/internal/cron/calculate-metrics`
- **Dónde se usa**: 
  - `app/api/internal/cron/release-holds/route.ts`
  - `app/api/internal/cron/calculate-metrics/route.ts`
- **⚠️ IMPORTANTE**: Esta clave debe coincidir con el `?key=` en la configuración de cron jobs de Vercel

#### `RESEND_API_KEY` (Opcional)
- **Tipo**: Secreto (Backend)
- **Descripción**: API key de Resend para envío de emails
- **Formato**: `re_...`
- **Uso**: Envío de emails (magic links, notificaciones, etc.)
- **Dónde se usa**: 
  - `app/api/test-email/route.ts`
  - Cualquier endpoint que envíe emails
- **Nota**: También puede configurarse en `next.config.ts` (ver `next.config.ts`)

#### `RECAPTCHA_SECRET_KEY` (Opcional)
- **Tipo**: Secreto (Backend)
- **Descripción**: Secret key de Google reCAPTCHA v3
- **Formato**: String largo
- **Uso**: Verificación de reCAPTCHA en formularios
- **Dónde se usa**: `src/lib/recaptcha.ts`

#### `RECAPTCHA_SITE_KEY` (Opcional)
- **Tipo**: Público (Frontend)
- **Descripción**: Site key de Google reCAPTCHA v3
- **Formato**: String alfanumérico
- **Uso**: Renderizado de widget de reCAPTCHA en el cliente
- **Nota**: Aunque es público, se recomienda mantenerlo como variable de entorno

---

## Configuración en Vercel

### Paso 1: Añadir Variables de Entorno

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**
4. Añade cada variable una por una:

#### Variables Obligatorias (Mínimo para que funcione):

**Frontend:**
```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
NEXT_PUBLIC_APP_URL=https://tu-dominio.com
```

**Backend:**
```
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
INTERNAL_CRON_KEY=tu-clave-secreta-muy-larga-y-aleatoria-minimo-32-caracteres
```

#### Variables Opcionales pero Recomendadas:

**Backend:**
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
RESEND_API_KEY=re_...
```

### Paso 2: Configurar Entornos

Para cada variable, selecciona en qué entornos estará disponible:
- ✅ **Production**: Para el dominio principal
- ✅ **Preview**: Para deployments de branches
- ✅ **Development**: Para deployments locales (opcional)

### Paso 3: Verificar Variables Críticas

Después de añadir las variables, verifica que:

1. **NUNCA** hayas puesto `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `UPSTASH_REDIS_REST_TOKEN` o `INTERNAL_CRON_KEY` como `NEXT_PUBLIC_*`
2. Todas las variables obligatorias están definidas para **Production**
3. `NEXT_PUBLIC_APP_URL` en Production apunta a tu dominio principal
4. `INTERNAL_CRON_KEY` es una clave fuerte y única

---

## Verificación Post-Deploy

### 1. Verificar que los secretos no se exponen

```bash
# En el navegador, en la consola:
# Esto NO debe mostrar secretos
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL) // ✅ OK
console.log(process.env.SUPABASE_SERVICE_ROLE_KEY) // ❌ undefined (correcto)
```

### 2. Verificar que las variables están disponibles

```bash
# Hacer una request a /api/health
curl https://tu-dominio.com/api/health

# Debe retornar 200 con información del estado
```

### 3. Verificar logs de Vercel

En Vercel → **Deployments** → **Functions** → **Logs**:
- ✅ No debe haber errores relacionados con variables faltantes
- ✅ No debe haber logs que muestren valores de secretos

---

## Checklist de Deployment

- [ ] Todas las variables obligatorias están configuradas en Vercel
- [ ] `NEXT_PUBLIC_APP_URL` está configurado para Production
- [ ] `INTERNAL_CRON_KEY` está configurado y coincide con la configuración de cron jobs
- [ ] Ningún secreto está expuesto como `NEXT_PUBLIC_*`
- [ ] Las variables están configuradas para Production (y Preview si aplica)
- [ ] Se ha verificado que el build pasa sin errores
- [ ] Se han probado los endpoints críticos después del deploy

---

## Valores Mínimos para Desarrollo Local

Para desarrollo local, el mínimo requerido es:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

`NEXT_PUBLIC_APP_URL` es opcional en desarrollo - el sistema usará `http://localhost:3000` automáticamente.

---

## Troubleshooting

### Error: "Variable X no está definida"
- Verifica que la variable está añadida en Vercel Dashboard
- Verifica que está configurada para el entorno correcto (Production/Preview)
- Reinicia el deployment

### Error: "Secreto expuesto en el cliente"
- Verifica que ningún secreto tiene el prefijo `NEXT_PUBLIC_`
- Verifica que no hay `console.log` que imprima secretos
- Busca en el código cualquier uso de secretos fuera de rutas `/api/*`

### Error: "Cron job retorna 401"
- Verifica que `INTERNAL_CRON_KEY` en Vercel coincide con el `?key=` en la configuración del cron job
- Verifica que el cron job está configurado en Vercel Dashboard (Settings → Cron Jobs)





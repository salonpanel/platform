# Guía de Deployment en Vercel

Esta guía te llevará paso a paso para desplegar la plataforma en Vercel de forma segura y exitosa.

## 📋 Checklist Pre-Deployment

Antes de hacer push a GitHub y desplegar en Vercel, verifica:

- [ ] El proyecto compila localmente: `npm run build`
- [ ] No hay errores de TypeScript: `npm run type-check`
- [ ] El lint pasa sin errores críticos: `npm run lint`
- [ ] Todos los tests pasan: `npm test`
- [ ] Las variables de entorno están documentadas (ver `docs/ENV_VARS.md`)

## 🚀 Proceso de Deployment

### 1. Preparar el Repositorio

1. Asegúrate de que todos los cambios están commitados:
   ```bash
   git status
   git add .
   git commit -m "Preparar para deployment en Vercel"
   ```

2. Push a GitHub:
   ```bash
   git push origin main
   ```

### 2. Conectar Proyecto con Vercel

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Click en **Add New Project**
3. Importa tu repositorio de GitHub
4. Vercel detectará automáticamente que es un proyecto Next.js

### 3. Configurar Variables de Entorno

**⚠️ CRÍTICO**: Configura todas las variables antes del primer deploy.

Ve a **Settings** → **Environment Variables** y añade todas las variables documentadas en `docs/ENV_VARS.md`.

**Variables Mínimas Obligatorias:**

**Frontend (NEXT_PUBLIC_*):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL` (para Production)

**Backend (Secretos):**
- `SUPABASE_SERVICE_ROLE_KEY`
- `INTERNAL_CRON_KEY`

**Ver detalles completos en `docs/ENV_VARS.md`**

### 4. Configurar Build Settings

En **Settings** → **General** → **Build & Development Settings**:

- **Build Command**: `npm run build` (ya configurado por defecto)
- **Output Directory**: `.next` (ya configurado por defecto)
- **Install Command**: `npm install` (ya configurado por defecto)
- **Node.js Version**: `20.x` (configurado automáticamente desde `package.json` → `engines.node`)

**Nota**: La versión de Node.js se especifica en `package.json` en el campo `engines.node: "20.x"`. Vercel detectará y usará esta versión automáticamente. No necesitas cambiar nada aquí, Next.js está configurado correctamente.

### 5. Configurar Dominio

1. Ve a **Settings** → **Domains**
2. Añade tu dominio personalizado (ej: `pro.bookfast.es`)
3. Sigue las instrucciones de Vercel para configurar DNS

**Importante**: Una vez configurado el dominio, actualiza `NEXT_PUBLIC_APP_URL` en Production para que apunte a ese dominio.

### 6. Configurar Cron Jobs

Los cron jobs **NO** se configuran en `vercel.json` con variables interpoladas. En su lugar, se configuran manualmente en el Dashboard de Vercel.

#### 6.1. Cron Job: Release Holds

1. Ve a **Settings** → **Cron Jobs** (o **Functions** → **Cron Jobs** en versiones antiguas)
2. Click en **Add Cron Job**
3. Configura:
   - **Path**: `/api/internal/cron/release-holds?key=TU_INTERNAL_CRON_KEY_REAL`
   - **Schedule**: `*/5 * * * *` (cada 5 minutos)
   - **Method**: POST
4. Reemplaza `TU_INTERNAL_CRON_KEY_REAL` con el valor real de `INTERNAL_CRON_KEY` de tus variables de entorno

#### 6.2. Cron Job: Calculate Metrics

1. Añade otro cron job:
   - **Path**: `/api/internal/cron/calculate-metrics?key=TU_INTERNAL_CRON_KEY_REAL`
   - **Schedule**: `0 2 * * *` (diariamente a las 2:00 AM UTC)
   - **Method**: POST

**⚠️ IMPORTANTE**: 
- El `?key=` en la URL debe coincidir **exactamente** con el valor de `INTERNAL_CRON_KEY` en tus variables de entorno
- Vercel no permite interpolación de variables en la configuración de cron jobs, por eso se usa el valor real

### 7. Primera Deployment

1. Después de configurar todo, Vercel automáticamente hará el primer deployment cuando hagas push
2. O puedes hacer deploy manualmente desde el Dashboard: **Deployments** → **Redeploy**

### 8. Verificar Deployment

#### 8.1. Verificar Build

En el Dashboard de Vercel, verifica que:
- ✅ El build completó exitosamente
- ✅ No hay errores en los logs
- ✅ El deployment está "Ready"

#### 8.2. Smoke Tests Funcionales

```bash
# 1. Página principal carga
curl https://tu-dominio.com/

# 2. Login funciona
curl https://tu-dominio.com/login

# 3. Panel carga (requiere autenticación)
curl https://tu-dominio.com/panel

# 4. Health endpoints funcionan
curl https://tu-dominio.com/api/health
curl https://tu-dominio.com/api/health/db
curl https://tu-dominio.com/api/health/payments
curl https://tu-dominio.com/api/health/webhooks
curl https://tu-dominio.com/api/health/cron
```

#### 8.3. Verificar Seguridad

1. **Endpoint dev-login bloqueado en producción:**
   ```bash
   curl -X POST https://tu-dominio.com/api/auth/dev-login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com"}'
   # Debe retornar 403
   ```

2. **Cron jobs protegidos:**
   ```bash
   # Sin key debe retornar 401
   curl -X POST https://tu-dominio.com/api/internal/cron/release-holds
   # Debe retornar 401 Unauthorized
   
   # Con key incorrecta también debe retornar 401
   curl -X POST "https://tu-dominio.com/api/internal/cron/release-holds?key=wrong-key"
   # Debe retornar 401 Unauthorized
   ```

3. **Secretos no expuestos:**
   - Abre DevTools en el navegador
   - En la consola, ejecuta: `console.log(process.env)`
   - Verifica que **NO** aparecen:
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `STRIPE_SECRET_KEY`
     - `UPSTASH_REDIS_REST_TOKEN`
     - `INTERNAL_CRON_KEY`

#### 8.4. Verificar Funcionalidad Completa

1. **Login por Magic Link:**
   - Visita `/login`
   - Introduce tu email
   - Verifica que recibes el magic link
   - Haz clic en el link y verifica que te redirige correctamente

2. **Agenda:**
   - Visita `/panel/agenda`
   - Verifica que carga sin errores
   - Verifica que puedes ver reservas existentes

3. **Pagos (si está configurado):**
   - Verifica que los webhooks de Stripe funcionan
   - Verifica en Stripe Dashboard que los eventos se procesan

4. **Cron Jobs:**
   - Espera 5 minutos y verifica en Vercel Logs que el cron de release-holds se ejecutó
   - Espera hasta las 2:00 AM UTC y verifica que el cron de calculate-metrics se ejecutó

## 🔧 Configuración por Entorno

### Producción

- `NEXT_PUBLIC_APP_URL`: Tu dominio principal (ej: `https://pro.bookfast.es`)
- Todas las variables configuradas para **Production**
- Cron jobs configurados con keys reales

### Preview (Branches)

- `NEXT_PUBLIC_APP_URL`: Puede ser opcional o apuntar a la URL de preview
- Variables pueden ser las mismas de producción o valores de staging
- Los cron jobs también funcionan en preview (si los configuras)

### Desarrollo Local

- `.env.local` con todas las variables necesarias
- `NEXT_PUBLIC_APP_URL` opcional (se infiere automáticamente)
- Ver `docs/ENV_SETUP.md` para más detalles

## 🛡️ Seguridad Post-Deployment

### 1. Endpoints Dev-Only

El endpoint `/api/auth/dev-login` está protegido y:
- ✅ Solo funciona si `NODE_ENV === "development"`
- ✅ Solo funciona si `NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true"`
- ✅ En producción, **NUNCA** definas `NEXT_PUBLIC_ENABLE_DEV_LOGIN`

**Verificación:**
```bash
# En producción debe retornar 403
curl -X POST https://tu-dominio.com/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### 2. Host Checks en Callbacks

El callback de autenticación (`/auth/callback`) valida:
- ✅ En producción, verifica que el host coincide con `NEXT_PUBLIC_APP_URL`
- ✅ En desarrollo, es más flexible

**Verificación:**
- Los magic links deben redirigir correctamente
- Intentos de acceso desde hosts no autorizados deben fallar

### 3. Logging y Observabilidad

- ✅ Verifica que no se loguean secretos en los logs de Vercel
- ✅ Revisa los logs regularmente: **Deployments** → **Functions** → **Logs**
- ✅ Usa los endpoints de health para monitoreo: `/api/health/*`

## 📊 Monitoreo Post-Deployment

### Logs de Vercel

1. Ve a **Deployments** → Selecciona un deployment → **Functions** → **Logs**
2. Busca:
   - ✅ Errores 500
   - ✅ Warnings sobre variables faltantes
   - ✅ Logs sospechosos

### Health Checks

Configura monitoring externo (ej: UptimeRobot) para:

- `GET /api/health` - Health general
- `GET /api/health/db` - Estado de la base de datos
- `GET /api/health/payments` - Estado de Stripe
- `GET /api/health/webhooks` - Estado de webhooks
- `GET /api/health/cron` - Estado de cron jobs

### Métricas en Supabase

Verifica en Supabase Dashboard:
- Tabla `org_metrics_daily` se actualiza diariamente
- Tabla `auth_logs` registra eventos de login
- Tabla `stripe_events_processed` registra eventos de Stripe

## 🐛 Troubleshooting

### Build Falla

1. **Error de TypeScript:**
   - Ejecuta `npm run type-check` localmente
   - Corrige todos los errores antes de hacer push

2. **Error de dependencias:**
   - Verifica que `package.json` y `package-lock.json` están actualizados
   - Verifica que no hay dependencias conflictivas

3. **Error de variables faltantes:**
   - Verifica que todas las variables obligatorias están en Vercel
   - Verifica que están configuradas para el entorno correcto

### Runtime Falla

1. **500 en todas las páginas:**
   - Revisa logs de Vercel
   - Verifica que las variables de entorno están configuradas
   - Verifica que Supabase está accesible

2. **401/403 en endpoints protegidos:**
   - Verifica que `INTERNAL_CRON_KEY` coincide en variables de entorno y cron jobs
   - Verifica que los webhooks de Stripe tienen el secret correcto

3. **Magic links no funcionan:**
   - Verifica que `NEXT_PUBLIC_APP_URL` está configurado correctamente
   - Verifica que el dominio está configurado en Vercel
   - Verifica en Supabase que los redirects están configurados

### Cron Jobs No Funcionan

1. **Cron job retorna 401:**
   - Verifica que `INTERNAL_CRON_KEY` en variables de entorno coincide con el `?key=` en la URL del cron job
   - Verifica que el cron job está configurado en Vercel Dashboard

2. **Cron job no se ejecuta:**
   - Verifica que el schedule está correcto (formato cron)
   - Verifica en los logs de Vercel si hay errores
   - Espera el tiempo programado (los cron jobs no se ejecutan inmediatamente)

## ✅ Checklist Final

Antes de considerar el deployment completado:

- [ ] Build pasa sin errores
- [ ] Todas las variables de entorno están configuradas
- [ ] Dominio configurado y `NEXT_PUBLIC_APP_URL` apunta correctamente
- [ ] Cron jobs configurados y funcionando
- [ ] Smoke tests pasan
- [ ] Endpoints dev-only bloqueados en producción
- [ ] Secretos no expuestos en el cliente
- [ ] Health endpoints funcionan
- [ ] Magic links funcionan
- [ ] Login y autenticación funcionan
- [ ] Panel carga sin errores
- [ ] Logs no muestran errores críticos

## 📚 Documentación Relacionada

- `docs/ENV_VARS.md` - Lista completa de variables de entorno
- `docs/ENV_SETUP.md` - Configuración para desarrollo local
- `docs/CRON_JOBS.md` - Detalles sobre cron jobs
- `DEPLOYMENT_CHECKLIST.md` - Checklist de deployment general

## 🆘 Soporte

Si encuentras problemas durante el deployment:

1. Revisa los logs de Vercel
2. Verifica la documentación relacionada
3. Ejecuta los health checks
4. Verifica que todas las variables están configuradas correctamente



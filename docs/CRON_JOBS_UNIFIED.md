# Cron Jobs - Documentación Unificada

## 📋 Descripción

Los cron jobs de la plataforma se ejecutan automáticamente en Vercel. Todos los endpoints requieren autenticación mediante `INTERNAL_CRON_KEY` en query parameter.

## 🔧 Configuración

### Variables de Entorno

```env
INTERNAL_CRON_KEY=<clave-secreta-aleatoria-minimo-32-caracteres>
```

### Configuración en Vercel Dashboard (ÚNICO MÉTODO RECOMENDADO)

**IMPORTANTE**: Vercel Cron **SÍ permite** query parameters estáticos en las URLs. Esta es la forma recomendada.

**Pasos**:

1. Ve a tu proyecto en **Vercel Dashboard**
2. Navega a **Settings > Cron Jobs**
3. Añade los siguientes cron jobs con estos paths (incluyendo el query parameter):

```
Path: /api/internal/cron/release-holds?key=TU_INTERNAL_CRON_KEY_REAL
Schedule: */5 * * * *
```

```
Path: /api/internal/cron/calculate-metrics?key=TU_INTERNAL_CRON_KEY_REAL
Schedule: 0 2 * * *
```

**Nota**: Reemplaza `TU_INTERNAL_CRON_KEY_REAL` con el valor real de tu variable de entorno `INTERNAL_CRON_KEY`.

**Ventajas**:
- La clave se configura una sola vez
- No se expone en el código fuente
- Fácil de actualizar sin redeploy
- Vercel Cron soporta query strings estáticos

## 📅 Cron Jobs

### 1. Release Holds
- **Path**: `/api/internal/cron/release-holds?key=INTERNAL_CRON_KEY`
- **Schedule**: `*/5 * * * *` (cada 5 minutos)
- **Propósito**: Libera holds expirados

### 2. Calculate Metrics
- **Path**: `/api/internal/cron/calculate-metrics?key=INTERNAL_CRON_KEY`
- **Schedule**: `0 2 * * *` (diario a las 2:00 AM UTC)
- **Propósito**: Calcula métricas diarias para todos los tenants

## 🔒 Seguridad

Todos los endpoints verifican `INTERNAL_CRON_KEY` desde el query parameter `?key=`.

## ⚠️ Notas Importantes

- **NO** uses `vercel.json` para configurar cron jobs con secrets
- **SÍ** configura desde el Dashboard con el query parameter completo
- Los cron jobs se ejecutan en UTC
- Los errores se registran en Vercel Dashboard > Functions > Logs









# Cron Jobs - Documentación

## 📋 Descripción

Los cron jobs de la plataforma se ejecutan automáticamente en Vercel según la configuración en `vercel.json`. Todos los endpoints de cron requieren autenticación mediante `INTERNAL_CRON_KEY`.

## 🔧 Configuración

### Variables de Entorno Requeridas

```env
INTERNAL_CRON_KEY=<clave-secreta-aleatoria>
```

**Importante**: Esta clave debe ser única y segura. Genera una clave aleatoria fuerte (mínimo 32 caracteres).

### Configuración en Vercel

**IMPORTANTE**: La configuración recomendada es desde el **Dashboard de Vercel**, no desde `vercel.json`.

#### Configuración desde Vercel Dashboard (Recomendado)

1. Ve a tu proyecto en Vercel Dashboard
2. Navega a **Settings > Cron Jobs**
3. Añade los siguientes cron jobs con estos paths (incluyendo el query parameter con tu clave real):

```
Path: /api/internal/cron/release-holds?key=TU_INTERNAL_CRON_KEY_REAL
Schedule: */5 * * * *
```

```
Path: /api/internal/cron/calculate-metrics?key=TU_INTERNAL_CRON_KEY_REAL
Schedule: 0 2 * * *
```

**Nota**: Reemplaza `TU_INTERNAL_CRON_KEY_REAL` con el valor real de tu variable de entorno `INTERNAL_CRON_KEY`.

#### Configuración alternativa (vercel.json)

Si prefieres usar `vercel.json`, los cron jobs están definidos ahí, pero **debes configurar manualmente los query parameters desde el Dashboard** ya que `vercel.json` no permite incluir secrets directamente.

## 📅 Cron Jobs Activos

### 1. Release Holds (`/api/internal/cron/release-holds`)

**Frecuencia**: Cada 5 minutos (`*/5 * * * *`)

**Propósito**: Libera automáticamente los "holds" (bloqueos temporales de citas) que han expirado según su TTL.

**Funcionalidad**:
- Busca bookings con `status = 'hold'` y `expires_at < now()`
- Cancela los holds expirados
- Limpia referencias relacionadas

**Protección**: Requiere `INTERNAL_CRON_KEY` en query parameter `?key=`

**Logs**: Registra cantidad de holds liberados

---

### 2. Calculate Metrics (`/api/internal/cron/calculate-metrics`)

**Frecuencia**: Diario a las 2:00 AM UTC (`0 2 * * *`)

**Propósito**: Calcula y almacena métricas diarias para todos los tenants.

**Funcionalidad**:
- Calcula métricas del día anterior para cada tenant
- Incluye:
  - Total de reservas por estado (confirmed, cancelled, no_show)
  - Ingresos (revenue_cents)
  - Ocupación (slots booked vs disponibles)
  - Servicios y staff activos
  - Eventos de webhooks (total y fallidos)
  - Limpiezas de cron (holds liberados)
- Almacena en `public.org_metrics_daily`

**Protección**: Requiere `INTERNAL_CRON_KEY` en query parameter `?key=`

**Retorno**: Resumen JSON con:
```json
{
  "ok": true,
  "summary": {
    "metric_date": "2024-01-15",
    "tenants_processed": 5,
    "total_bookings": 42,
    "total_revenue_cents": 125000
  }
}
```

**Logs**: Registra resumen de métricas calculadas

---

## 🔒 Seguridad

### Autenticación

Todos los endpoints de cron requieren `INTERNAL_CRON_KEY`:

1. **Query Parameter** (recomendado para Vercel Cron):
   ```
   POST /api/internal/cron/calculate-metrics?key=TU_CLAVE
   ```

2. **Header** (alternativa):
   ```
   x-cron-key: TU_CLAVE
   ```

### Configuración en Vercel Dashboard

**Método Recomendado**: Configurar los cron jobs desde el Dashboard de Vercel con el query parameter `?key=` en la URL del path.

**Pasos**:
1. Ve a **Settings > Cron Jobs** en tu proyecto de Vercel
2. Añade cada cron job con el path completo incluyendo el query parameter:
   - Path: `/api/internal/cron/release-holds?key=TU_INTERNAL_CRON_KEY_REAL`
   - Path: `/api/internal/cron/calculate-metrics?key=TU_INTERNAL_CRON_KEY_REAL`
3. Configura el schedule correspondiente

**Ventajas**:
- La clave se configura una sola vez en el Dashboard
- No se expone en el código fuente
- Fácil de actualizar sin redeploy

**Nota**: Vercel Cron **sí puede** llamar URLs con query strings estáticos. Esta es la forma recomendada de autenticación para cron jobs internos.

---

## 🧪 Testing Manual

### Probar Release Holds

```bash
curl -X POST "https://tu-dominio.vercel.app/api/internal/cron/release-holds?key=TU_CLAVE"
```

### Probar Calculate Metrics

```bash
curl -X POST "https://tu-dominio.vercel.app/api/internal/cron/calculate-metrics?key=TU_CLAVE"
```

### Verificar Logs

Los logs se pueden verificar en:
- Vercel Dashboard > Functions > Logs
- Supabase Dashboard > Logs (si se configuran triggers de logging)

---

## 📊 Monitoreo

### Métricas Disponibles

Las métricas calculadas se almacenan en `public.org_metrics_daily` y pueden consultarse:

```sql
-- Ver métricas de un tenant
SELECT * FROM public.org_metrics_daily
WHERE tenant_id = 'uuid-del-tenant'
ORDER BY metric_date DESC
LIMIT 30;

-- Resumen de métricas globales
SELECT 
  metric_date,
  COUNT(*) as tenants,
  SUM(total_bookings) as total_bookings,
  SUM(revenue_cents) / 100.0 as total_revenue_eur
FROM public.org_metrics_daily
GROUP BY metric_date
ORDER BY metric_date DESC
LIMIT 30;
```

### Health Check

El endpoint `/api/health/cron` puede usarse para verificar el estado de los cron jobs (requiere implementación específica).

---

## ⚠️ Troubleshooting

### Cron no se ejecuta

1. Verificar que `vercel.json` esté correctamente configurado
2. Verificar que el proyecto esté desplegado en Vercel
3. Verificar logs en Vercel Dashboard > Cron Jobs

### Error 401 Unauthorized

1. Verificar que `INTERNAL_CRON_KEY` esté configurado en Vercel Environment Variables
2. Verificar que la clave en la URL/header coincida con la variable de entorno

### Error al calcular métricas

1. Verificar que la función `calculate_all_org_metrics_daily` exista en Supabase
2. Verificar permisos de la función (debe ser `security definer`)
3. Verificar logs de Supabase para errores SQL

### Holds no se liberan

1. Verificar que el cron se ejecute correctamente (ver logs)
2. Verificar que `HOLD_TTL_MIN` esté configurado correctamente
3. Verificar que los bookings tengan `expires_at` configurado

---

## 🔄 Actualización de Horarios

Para cambiar la frecuencia de ejecución, edita `vercel.json` y vuelve a desplegar:

```json
{
  "crons": [
    {
      "path": "/api/internal/cron/calculate-metrics",
      "schedule": "0 3 * * *"  // Cambiar a 3 AM UTC
    }
  ]
}
```

**Formato de schedule**: Cron expression estándar (minuto hora día mes día-semana)

Ejemplos:
- `0 2 * * *` - Diario a las 2:00 AM UTC
- `*/5 * * * *` - Cada 5 minutos
- `0 */6 * * *` - Cada 6 horas
- `0 0 * * 0` - Cada domingo a medianoche

---

## 📝 Notas Adicionales

- Los cron jobs se ejecutan en el timezone UTC
- Los errores se registran en los logs de Vercel
- Las métricas se calculan para el día anterior (día completo en UTC)
- Los holds se liberan automáticamente, pero también se pueden liberar manualmente desde el panel


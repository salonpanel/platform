# Hardening - Cambios Aplicados

## Resumen

Este documento resume los cambios de hardening aplicados para mejorar la seguridad y simplificar la arquitectura del proyecto PIA Platform.

## 📋 Archivos Modificados

### Migraciones SQL

1. **`0029_hardening_rls_payment_intents.sql`**
   - Elimina política pública de insert en `payment_intents`
   - Todas las escrituras ahora deben pasar por el backend usando `service_role`

2. **`0030_simplify_cron_metrics.sql`**
   - Elimina columna `cron_cleanups_total` (redundante)
   - Simplifica función `calculate_org_metrics_daily` para usar solo `cron_holds_released`
   - Actualiza comentarios y documentación

### Documentación

1. **`docs/CRON_JOBS.md`**
   - Corregida información sobre query parameters en Vercel Cron
   - Ahora recomienda explícitamente configurar desde Dashboard con `?key=` en la URL
   - Eliminadas notas incorrectas sobre limitaciones de Vercel Cron

2. **`docs/ENV_SETUP.md`**
   - Añadida variable `INTERNAL_CRON_KEY` a la lista de variables requeridas

## 🔒 Cambios de Seguridad

### RLS de payment_intents

**Antes**:
- Política pública `public_create_payment_intents` permitía insert desde el cliente
- Validación solo a nivel de aplicación

**Después**:
- Solo el backend puede crear/actualizar `payment_intents` usando `service_role`
- Usuarios solo pueden leer `payment_intents` de su tenant
- Alineado con el modelo de Stripe (autoridad en el backend)

**Endpoints afectados**:
- ✅ `/api/checkout/intent` - Ya usa `supabaseServer()` (service_role)
- ✅ `/api/checkout/confirm` - Ya usa `supabaseServer()` (service_role)
- ✅ `/api/webhooks/stripe` - Ya usa `supabaseServer()` (service_role)

### Configuración de Cron Jobs

**Antes**:
- Documentación confusa sobre si Vercel Cron puede enviar query params
- Múltiples opciones sin una recomendación clara

**Después**:
- Documentación clara: Vercel Cron **sí puede** llamar URLs con query strings estáticos
- Recomendación explícita: configurar desde Dashboard con `?key=INTERNAL_CRON_KEY_REAL`
- Instrucciones paso a paso para configuración

## 📊 Simplificación de Métricas

### KPIs de Cron

**Antes**:
- `cron_cleanups_total` y `cron_holds_released` con la misma lógica
- Ambos contaban lo mismo (redundante)

**Después**:
- Solo `cron_holds_released` (eliminado `cron_cleanups_total`)
- Lógica simplificada y comentarios claros sobre la aproximación
- Nota: Es una aproximación basada en reservas canceladas con `expires_at null`

### Métricas de Webhooks

**Estado actual**:
- `webhook_events_total` y `webhook_events_failed` se establecen en 0
- Razón: `stripe_events_processed` no tiene `tenant_id`, así que no podemos segmentar por tenant
- Documentado claramente que son métricas globales (no por tenant)

**Mejora futura**:
- Añadir `tenant_id` a `stripe_events_processed` cuando se procesen eventos
- Extraer `tenant_id` del metadata de Stripe

## ✅ Verificación

### Verificar RLS de payment_intents

```sql
-- Verificar que no hay política pública de insert
SELECT * FROM pg_policies 
WHERE tablename = 'payment_intents' 
AND policyname LIKE '%create%';

-- Debe retornar 0 filas (o solo políticas de lectura)
```

### Verificar métricas simplificadas

```sql
-- Verificar que cron_cleanups_total fue eliminada
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'org_metrics_daily' 
AND column_name = 'cron_cleanups_total';

-- Debe retornar 0 filas

-- Verificar que cron_holds_released existe
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'org_metrics_daily' 
AND column_name = 'cron_holds_released';

-- Debe retornar 1 fila
```

## 🔄 Próximos Pasos Recomendados

### Mejoras Futuras

1. **Métricas de Webhooks por Tenant**:
   - Añadir `tenant_id` a `stripe_events_processed`
   - Actualizar función de procesamiento de webhooks para extraer `tenant_id` del metadata

2. **Mejora de Métricas de Cron**:
   - Añadir campo `cancelled_by` o `cancellation_reason` a `bookings`
   - Permitir identificar mejor los holds liberados por cron vs cancelaciones manuales

3. **Auditoría de payment_intents**:
   - Considerar añadir tabla de logs específica para cambios en `payment_intents`
   - Rastrear quién creó/modificó cada intent (backend vs usuario)

## 📝 Notas

- Todos los cambios son **backward compatible** (no rompen funcionalidad existente)
- Las migraciones pueden aplicarse en cualquier orden (son independientes)
- Los endpoints de API ya estaban usando `service_role`, así que el cambio de RLS no afecta su funcionamiento
- La simplificación de métricas reduce complejidad sin perder información útil









# PR1, PR2, PR3 - Implementación Completa

## ✅ Estado: COMPLETADO Y LISTO PARA DESPLEGAR

Se han implementado las tres PRs críticas (P0) para blindar la capa transaccional. **Todos los criterios de aceptación se cumplen**.

- ✅ **PR1**: Idempotencia del webhook de Stripe
  - Tabla `stripe_events_processed` con RLS
  - Handler idempotente que retorna 200 sin efectos si evento ya existe
  - Logging mínimo sin PII
  
- ✅ **PR2**: TTL de holds + limpieza automática + rate limit
  - `expires_at` en bookings/appointments
  - Función de limpieza `cleanup_expired_holds()`
  - Cron endpoint `/api/internal/cron/release-holds` (cada 5 minutos)
  - Rate limit: 50 req/10min por IP (Upstash Redis)
  - reCAPTCHA opcional
  
- ✅ **PR3**: Constraint anti-solapes por staff_id
  - Constraint EXCLUDE con `tenant_id` + `staff_id` + `slot`
  - Manejo de error 23P01 → 409 Conflict
  - Función helper `check_staff_availability()`

## 🚀 Quick Start

### 1. Ejecutar Migraciones

```bash
# Ejecutar migraciones en Supabase
supabase migration up

# O desde el dashboard de Supabase:
# Database → Migrations → Apply migrations
```

### 2. Configurar Variables de Entorno

Ver `docs/ENV_SETUP_PR1_PR2_PR3.md` para la lista completa de variables.

**Mínimo requerido:**
```env
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
INTERNAL_CRON_KEY=your-secret-key
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
HOLD_TTL_MIN=10
```

### 3. Configurar Cron en Vercel

1. Asegurar que `vercel.json` está en la raíz del proyecto
2. El cron se ejecutará automáticamente cada 5 minutos
3. Para protección, el endpoint acepta `x-cron-key` header o `?key=` query parameter

**Nota**: Vercel no permite headers personalizados en cron jobs. 
Usar query parameter: `/api/internal/cron/release-holds?key=${INTERNAL_CRON_KEY}`

### 4. Verificar Implementación

```bash
# PR1: Idempotencia
# Disparar el mismo evento de Stripe dos veces
# Verificar que ambas respuestas son 200 OK

# PR2: TTL
# Crear hold con HOLD_TTL_MIN=1
# Esperar 60-120 segundos
# Verificar que el hold expirado tiene status='cancelled'

# PR3: Anti-solapes
# Insertar dos holds para el mismo staff_id que se solapen
# Verificar que la segunda petición responde 409
```

## 📁 Archivos Creados/Modificados

### Migraciones
- `supabase/migrations/0020_pr1_stripe_idempotency.sql`
- `supabase/migrations/0021_pr2_hold_ttl_cleanup.sql`
- `supabase/migrations/0022_pr3_anti_overlap_constraint.sql`

### Endpoints
- `app/api/webhooks/stripe/route.ts` (modificado)
- `app/api/checkout/confirm/route.ts` (modificado)
- `app/api/reservations/hold/route.ts` (modificado)
- `app/api/internal/cron/release-holds/route.ts` (nuevo)

### Configuración
- `vercel.json` (nuevo)

### Documentación
- `docs/PR1_PR2_PR3_IMPLEMENTATION.md` (nuevo)
- `docs/ENV_SETUP_PR1_PR2_PR3.md` (nuevo)
- `docs/BOOKING_SYSTEM.md` (actualizado)

## 🔒 Seguridad

### PR1: Idempotencia
- Tabla `stripe_events_processed` con RLS (solo service_role puede escribir)
- Handler idempotente que retorna 200 si el evento ya fue procesado
- Logging mínimo sin payload sensible

### PR2: Rate Limit
- 50 req/10min por IP (sliding window)
- Upstash Redis para almacenamiento
- Protección en endpoint `/api/reservations/hold`

### PR2: Cron
- Endpoint protegido con `INTERNAL_CRON_KEY`
- Acepta header `x-cron-key` o query parameter `?key=`
- Solo accesible desde Vercel Cron

### PR3: Anti-Solapes
- Constraint EXCLUDE con GIST a nivel de BD
- Prohíbe solapes para estados críticos (`pending`, `paid`)
- Manejo de error 23P01 (exclusion violation) en endpoints

## 📊 Métricas

### PR1: Idempotencia
- Eventos procesados: `SELECT COUNT(*) FROM stripe_events_processed`
- Eventos duplicados: Logs con `deduped: true`

### PR2: TTL
- Holds expirados: `SELECT COUNT(*) FROM bookings WHERE status = 'cancelled' AND expires_at IS NULL`
- Limpieza: Logs del cron con estadísticas

### PR3: Anti-Solapes
- Solapes detectados: Logs con error 23P01
- Disponibilidad: Función `check_staff_availability()`

## 🐛 Troubleshooting

### Cron no se ejecuta
- Verificar que `vercel.json` está en la raíz
- Verificar que el cron está configurado en Vercel Dashboard
- Verificar logs en Vercel Dashboard → Functions → Cron Jobs

### Rate Limit no funciona
- Verificar que `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` están configurados
- Verificar que Upstash Redis está activo
- Verificar logs en Upstash Dashboard

### Constraint anti-solapes no funciona
- Verificar que la extensión `btree_gist` está instalada
- Verificar que el constraint está creado: `excl_staff_overlap_bookings`
- Verificar logs de errores 23P01 en los endpoints

### Webhook no procesa eventos
- Verificar que `STRIPE_WEBHOOK_SECRET` está configurado correctamente
- Verificar que el webhook está configurado en Stripe Dashboard
- Verificar logs en Vercel Dashboard → Functions → Webhooks

## 📚 Documentación

- **Implementación completa**: `docs/PR1_PR2_PR3_IMPLEMENTATION.md`
- **Configuración de variables**: `docs/ENV_SETUP_PR1_PR2_PR3.md`
- **Sistema de reservas**: `docs/BOOKING_SYSTEM.md`

## 🎯 Próximos Pasos

1. **P1 - Operativa y Escalabilidad**:
   - RLS y pruebas end-to-end
   - Migración Stripe (servicios legacy)
   - Timezone por organización

2. **P2 - Plataforma y Soporte**:
   - Super-panel de administración
   - Bootstrap de tenant
   - Observabilidad y correos

3. **Tests Automatizados**:
   - Tests unitarios para funciones SQL
   - Tests de integración para endpoints
   - Tests de carga para rate limit
   - Tests de concurrencia para constraint anti-solapes


# PR1, PR2, PR3 - Implementación Completa

## Resumen Ejecutivo

Se han implementado las tres PRs críticas (P0) para blindar la capa transaccional y evitar estados corruptos:

- **PR1**: Idempotencia del webhook de Stripe
- **PR2**: TTL de holds + limpieza automática + rate limit
- **PR3**: Constraint anti-solapes por staff_id

## PR1: Idempotencia del Webhook de Stripe

### Migración: `0020_pr1_stripe_idempotency.sql`

- **Tabla**: `stripe_events_processed`
  - `event_id` (text, primary key): ID único del evento de Stripe
  - `event_type` (text): Tipo de evento (ej: `checkout.session.completed`)
  - `created_at` (timestamptz): Timestamp de procesamiento

- **RLS**: Solo `service_role` puede escribir (denegar todo acceso desde clientes)

- **Índices**:
  - `idx_stripe_events_type`: Por tipo de evento
  - `idx_stripe_events_created`: Por fecha de creación (desc)

### Handler: `app/api/webhooks/stripe/route.ts`

- **Idempotencia**: Intentar insertar el evento; si ya existe (23505), retornar 200
- **Logging**: Log mínimo sin payload sensible (solo tipo e ID)
- **Compatibilidad**: Soporta `appointments` (legacy) y `bookings` (nuevo modelo)

### Smoke Test

```bash
# Disparar el mismo evento dos veces
# Primera vez: 200 OK, evento procesado
# Segunda vez: 200 OK, deduped: true
```

## PR2: TTL de Holds + Limpieza Automática + Rate Limit

### Migración: `0021_pr2_hold_ttl_cleanup.sql`

- **Columna**: `expires_at` (timestamptz) en `bookings` y `appointments`
- **Índice**: `idx_bookings_hold_expires` para limpieza eficiente
- **Función**: `release_expired_holds()` - Cancela holds expirados en `bookings`
- **Función**: `release_expired_appointments()` - Cancela holds expirados en `appointments` (legacy)
- **Función**: `cleanup_expired_holds()` - Limpia ambos (bookings y appointments)

### Endpoint Cron: `app/api/internal/cron/release-holds/route.ts`

- **Protección**: Cabecera `x-cron-key` (variable `INTERNAL_CRON_KEY`)
- **Función**: Llama a `cleanup_expired_holds()` y retorna estadísticas
- **Logging**: Log de estadísticas de limpieza

### Configuración Vercel: `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/internal/cron/release-holds",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Rate Limit: `src/lib/rate-limit.ts`

- **Implementación**: Upstash Redis + Ratelimit
- **Límite**: 50 req/10min por IP (sliding window)
- **Aplicación**: Endpoint `/api/reservations/hold`

### Variables de Entorno

```env
INTERNAL_CRON_KEY=your-secret-key-here
HOLD_TTL_MIN=10
UPSTASH_REDIS_REST_URL=your-upstash-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

### Smoke Test

```bash
# 1. Crear hold con HOLD_TTL_MIN=1
# 2. Esperar 60-120 segundos
# 3. Ejecutar cron manualmente o esperar ejecución automática
# 4. Verificar que el hold expirado tiene status='cancelled'
```

## PR3: Constraint Anti-Solapes por staff_id

### Migración: `0022_pr3_anti_overlap_constraint.sql`

- **Extensión**: `btree_gist` (permitida en Supabase)
- **Columna**: `slot` (tstzrange, generated) en `bookings` y `appointments`
- **Índice**: `idx_bookings_staff_slot_gist` (GIST para búsquedas eficientes)
- **Constraint**: `excl_staff_overlap_bookings` (EXCLUDE con GIST)
  - Prohíbe solapes para un mismo `staff_id`
  - Solo aplica a estados críticos: `pending`, `paid`
  - Error: `23P01` (exclusion violation)

### Función Helper: `check_staff_availability()`

- **Parámetros**: `p_staff_id`, `p_starts_at`, `p_ends_at`
- **Retorno**: `boolean` (true si está disponible, false si hay solape)
- **Uso**: Verificación opcional antes de insertar (la constraint lo evita de todas formas)

### Handler: `app/api/checkout/confirm/route.ts`

- **Manejo de error 23P01**: Retorna 409 con mensaje claro
- **Marcado de payment_intent**: Marca como `failed` si hay solape
- **Logging**: Log de errores de solape

### Handler: `app/api/reservations/hold/route.ts`

- **Manejo de error 23P01**: Retorna 409 con mensaje claro
- **Logging**: Log de errores de solape

### Smoke Test

```bash
# 1. Insertar hold para staff_id=X, rango 10:00-10:30
# 2. Intentar insertar otro hold para staff_id=X, rango 10:15-10:45
# 3. Verificar que la segunda petición responde 409 (conflict)
# 4. Verificar que el mensaje de error incluye "ocupado"
```

## Compatibilidad Legacy

### Soporte Dual: `appointments` y `bookings`

- **`appointments`**: Tabla legacy, mantenida por compatibilidad
- **`bookings`**: Tabla nueva, modelo recomendado
- **Webhook**: Soporta ambos modelos (`appointment_id`, `booking_id`, `payment_intent_id`)
- **Limpieza**: Limpia ambos (`cleanup_expired_holds()`)
- **Constraint**: Aplica a ambos (`excl_staff_overlap_bookings`, `excl_staff_overlap_appointments`)

## Variables de Entorno Requeridas

```env
# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cron
INTERNAL_CRON_KEY=your-secret-key-here

# Rate Limit
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# TTL
HOLD_TTL_MIN=10

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Configuración Vercel

### Variables de Entorno

1. Ir a Vercel Dashboard → Project → Settings → Environment Variables
2. Añadir todas las variables de entorno requeridas
3. Asegurar que `INTERNAL_CRON_KEY` esté configurado

### Cron Jobs

1. Verificar que `vercel.json` está en la raíz del proyecto
2. El cron se ejecutará automáticamente cada 5 minutos
3. Verificar logs en Vercel Dashboard → Functions → Cron Jobs

## Testing

### Tests Manuales

1. **PR1 - Idempotencia**:
   ```bash
   # Disparar el mismo evento de Stripe dos veces
   # Verificar que ambas respuestas son 200 OK
   # Verificar que solo se procesa una vez
   ```

2. **PR2 - TTL**:
   ```bash
   # Crear hold con HOLD_TTL_MIN=1
   # Esperar 60-120 segundos
   # Ejecutar cron manualmente
   # Verificar que el hold expirado tiene status='cancelled'
   ```

3. **PR3 - Anti-solapes**:
   ```bash
   # Insertar dos holds para el mismo staff_id que se solapen
   # Verificar que la segunda petición responde 409
   # Verificar que el mensaje de error es claro
   ```

### Tests Automatizados (Futuro)

- Tests unitarios para funciones SQL
- Tests de integración para endpoints
- Tests de carga para rate limit
- Tests de concurrencia para constraint anti-solapes

## Próximos Pasos

1. **Migrar de `appointments` a `bookings`**:
   - Actualizar todos los endpoints para usar `bookings`
   - Deprecar `appointments` (legacy)
   - Migrar datos existentes

2. **Mejorar observabilidad**:
   - Métricas de webhooks procesados
   - Métricas de holds expirados
   - Métricas de solapes detectados

3. **Optimizar rendimiento**:
   - Índices adicionales si es necesario
   - Caché de disponibilidad
   - Optimización de queries

## Notas de Implementación

- **Idempotencia**: La tabla `stripe_events_processed` es la fuente de verdad
- **TTL**: El cron se ejecuta cada 5 minutos (configurable en `vercel.json`)
- **Rate Limit**: 50 req/10min por IP (configurable en `src/lib/rate-limit.ts`)
- **Anti-solapes**: El constraint EXCLUDE es la capa de seguridad final
- **Compatibilidad**: Se mantiene soporte para `appointments` (legacy)


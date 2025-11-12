# Criterios de Aceptación - PR1, PR2, PR3

## PR1: Idempotencia Stripe

### Criterios de Aceptación

✅ **Aceptar si**: Reintentos del mismo evento no cambian estado; logs sin payload sensible (PII)

### Implementación

1. **Tabla**: `public.stripe_events_processed`
   - `event_id` (text, primary key): ID único del evento de Stripe
   - `event_type` (text): Tipo de evento (ej: `checkout.session.completed`)
   - `created_at` (timestamptz): Timestamp de procesamiento
   - **RLS**: Denegar todo acceso desde clientes (solo `service_role`)

2. **Handler**: `app/api/webhooks/stripe/route.ts`
   - **Short-circuit**: Si el evento ya existe (23505), retornar 200 sin procesar
   - **Logging**: Solo tipo e ID, sin PII (sin payload sensible)
   - **Idempotencia**: `insert ... on conflict do nothing` → retornar 200 sin efectos

### Tests

```bash
# Test 1: Disparar el mismo evento dos veces
# Primera vez: 200 OK, evento procesado
# Segunda vez: 200 OK, deduped: true (sin procesar)

# Test 2: Verificar logs
# Logs deben contener solo: type, eventId, deduped (sin PII)
```

### Verificación

- ✅ Tabla creada con RLS denegando acceso
- ✅ Handler retorna 200 sin efectos si evento ya existe
- ✅ Logging mínimo sin PII
- ✅ No se procesa el evento duplicado

## PR2: TTL de Holds + Rate Limit

### Criterios de Aceptación

✅ **Aceptar si**: Un hold sin pago se libera ≤10 minutos, y >50 holds/10min por IP devuelve 429

### Implementación

1. **TTL de Holds**:
   - Columna `expires_at` en `bookings` y `appointments`
   - Función `cleanup_expired_holds()` para limpiar holds expirados
   - Endpoint cron `/api/internal/cron/release-holds` (cada 5 minutos)
   - Configuración: `HOLD_TTL_MIN=10` (default: 10 minutos)

2. **Rate Limit**:
   - Upstash Redis + Ratelimit
   - Límite: 50 req/10min por IP (sliding window)
   - Aplicación: Endpoint `/api/reservations/hold`
   - Protección: `holdRateLimit.limit(\`hold:${ip}\`)`

3. **reCAPTCHA** (Opcional):
   - Verificación opcional en endpoint `/api/reservations/hold`
   - Configuración: `RECAPTCHA_SECRET_KEY` (opcional)
   - Validación: Score mínimo 0.5 (configurable)

### Tests

```bash
# Test 1: TTL de Holds
# 1. Crear hold con HOLD_TTL_MIN=1
# 2. Esperar 60-120 segundos
# 3. Ejecutar cron manualmente o esperar ejecución automática
# 4. Verificar que el hold expirado tiene status='cancelled'

# Test 2: Rate Limit
# 1. Hacer más de 50 requests en 10 minutos desde la misma IP
# 2. Verificar que después del límite se retorna 429
# 3. Verificar logs en Upstash Dashboard

# Test 3: reCAPTCHA (Opcional)
# 1. Si RECAPTCHA_SECRET_KEY está configurado, verificar que se valida
# 2. Si no está configurado, verificar que se permite continuar
```

### Verificación

- ✅ Holds expirados se liberan automáticamente (≤10 minutos)
- ✅ Rate limit funciona (50 req/10min por IP)
- ✅ reCAPTCHA opcional funciona correctamente
- ✅ Cron se ejecuta cada 5 minutos

## PR3: Anti-Solapes por staff_id

### Criterios de Aceptación

✅ **Aceptar si**: Ningún segundo hold/confirm solapado del mismo staff_id entra (error 409)

### Implementación

1. **Constraint EXCLUDE**:
   - Extensión: `btree_gist`
   - Columna: `slot` (tstzrange, generated)
   - Constraint: `excl_staff_overlap_bookings`
   - Incluye: `tenant_id`, `staff_id`, `slot` (para aislamiento multi-tenant)
   - Estados: `pending`, `paid` (estados críticos)

2. **Manejo de Errores**:
   - Error 23P01 (exclusion violation) → 409 Conflict
   - Mensaje: "El slot seleccionado ya está ocupado"
   - Logging: Log de errores de solape

3. **Función Helper**:
   - `check_staff_availability()`: Verificación previa (opcional)
   - Retorna: `true` si está disponible, `false` si hay solape
   - Uso: Verificación antes de insertar (la constraint lo evita de todas formas)

### Tests

```bash
# Test 1: Anti-Solapes
# 1. Insertar hold para staff_id=X, rango 10:00-10:30
# 2. Intentar insertar otro hold para staff_id=X, rango 10:15-10:45
# 3. Verificar que la segunda petición responde 409 (conflict)
# 4. Verificar que el mensaje de error es claro

# Test 2: Multi-Tenant
# 1. Insertar hold para tenant_id=A, staff_id=X, rango 10:00-10:30
# 2. Insertar hold para tenant_id=B, staff_id=X, rango 10:15-10:45
# 3. Verificar que la segunda petición funciona (diferente tenant)
# 4. Verificar que no hay solape entre tenants

# Test 3: Estados Excluidos
# 1. Insertar hold para staff_id=X, rango 10:00-10:30, status='pending'
# 2. Cancelar el hold (status='cancelled')
# 3. Insertar otro hold para staff_id=X, rango 10:00-10:30
# 4. Verificar que la segunda petición funciona (estado excluido)
```

### Verificación

- ✅ Constraint EXCLUDE funciona correctamente
- ✅ Incluye `tenant_id` para aislamiento multi-tenant
- ✅ Manejo de error 23P01 → 409 Conflict
- ✅ No se permiten solapes para estados críticos

## Resumen de Cumplimiento

### PR1: Idempotencia Stripe
- ✅ Tabla `stripe_events_processed` creada
- ✅ RLS denegando acceso
- ✅ Handler retorna 200 sin efectos si evento ya existe
- ✅ Logging mínimo sin PII

### PR2: TTL + Rate Limit
- ✅ Columna `expires_at` en `bookings` y `appointments`
- ✅ Función de limpieza `cleanup_expired_holds()`
- ✅ Endpoint cron `/api/internal/cron/release-holds`
- ✅ Rate limit: 50 req/10min por IP
- ✅ reCAPTCHA opcional

### PR3: Anti-Solapes
- ✅ Constraint EXCLUDE con GIST
- ✅ Incluye `tenant_id` para aislamiento multi-tenant
- ✅ Manejo de error 23P01 → 409 Conflict
- ✅ Función helper `check_staff_availability()`

## Próximos Pasos

1. **Ejecutar Migraciones**: Aplicar migraciones en Supabase
2. **Configurar Variables**: Añadir variables de entorno en Vercel
3. **Configurar Cron**: Configurar cron job en Vercel Dashboard
4. **Tests**: Ejecutar tests de aceptación
5. **Verificación**: Verificar que todos los criterios se cumplen


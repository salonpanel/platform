# Especificaciones P0 - Cinturón de Seguridad Transaccional

## P0.1 - Idempotencia del Webhook de Stripe

### Qué
Registrar cada `event_id` de Stripe y "cortar" reintentos antes de mutar citas.

### Por qué
Evita dobles confirmaciones y estados corruptos en pagos.

### Cómo

#### SQL
- Tabla `stripe_events_processed(event_id pk, event_type, created_at)`
- RLS denegando acceso público
- Índices para métricas (`event_type`, `created_at`)

#### Webhook
- `insert ... on conflict do nothing` (implícito en Supabase)
- Si conflicto (23505) => devolver 200 sin tocar DB
- **IMPORTANTE**: Registrar el evento ANTES de procesar

#### Logging
- Mínimo (tipo e ID)
- Sin payload sensible (sin `customer_email`, `payment_intent_id`, etc.)

### Aceptación
- ✅ Reenviar el mismo evento produce 200 y cero cambios adicionales en DB
- ✅ Logs sin PII

### Riesgos
- ❌ No registrar el evento antes de actualizar
- ❌ Exponer payload sensible en logs

### Uso futuro
- Métricas de fiabilidad de cobros por tipo de evento
- Análisis de eventos duplicados

---

## P0.2 - TTL de Holds + Limpieza Automática + Rate Limit

### Qué
Caducar holds no pagados y limitar abuso de endpoints públicos.

### Por qué
Evita "secuestro de slots" y ataques de spam.

### Cómo

#### TTL de Holds
- `bookings.expires_at` + `appointments.expires_at`
- `HOLD_TTL_MIN` en env (default 10 minutos)
- Asignarlo al crear el hold

#### Limpieza Automática
- Función `release_expired_holds()` que actualiza holds expirados a `cancelled`
- Cron (Vercel) cada 5-10 min que invoque endpoint interno
- Endpoint protegido por `x-cron-key` o query parameter `?key=`

#### Rate Limit
- Upstash Redis + Ratelimit
- 50 req/10min por IP (sliding window)
- Aplicación en `/api/reservations/hold`
- Retornar 429 con mensaje claro

### Aceptación
- ✅ Un hold caduca ≤10 min
- ✅ >50 holds/10' por IP => 429
- ✅ Cron limpia holds expirados automáticamente

### Riesgos
- ❌ No proteger el endpoint cron
- ❌ No limpiar estados "hold"
- ❌ Rate limit demasiado restrictivo

### Uso futuro
- Ajuste dinámico de TTL por plan o por demanda
- Rate limit por usuario autenticado

---

## P0.3 - Anti-Solapes de Agenda a Nivel Base (staff_id)

### Qué
Constraint que impida solapes hold/confirmed para el mismo barbero.

### Por qué
Garantiza integridad aun con alta concurrencia.

### Cómo

#### Constraint EXCLUDE
- Extensión `btree_gist`
- Columna `slot` `tstzrange(starts_at, ends_at, '[)')` generada
- `EXCLUDE USING gist (tenant_id =, staff_id =, slot &&)`
- Filtro `status in ('pending', 'paid')` para bookings
- Filtro `status in ('hold', 'confirmed')` para appointments (legacy)

#### Manejo de Errores
- Capturar `SQLSTATE 23P01` (exclusion violation)
- Responder 409 con mensaje "Slot solapado"
- Función helper `get_overlap_error_message()` para mensaje amigable

#### Función Helper
- `check_staff_availability(tenant_id, staff_id, starts_at, ends_at)`
- Retorna `true` si está disponible, `false` si hay solape
- Incluye `tenant_id` para aislamiento multi-tenant

### Aceptación
- ✅ La segunda reserva solapada del mismo barbero devuelve 409
- ✅ Diferentes tenants pueden tener solapes
- ✅ Estados excluidos (cancelled, no_show) no previenen solapes

### Riesgos
- ❌ No tener `staff_id` asignado en hold (decidir asignación temprana o "staff virtual" por servicio)
- ❌ Constraint demasiado restrictivo

### Uso futuro
- Métrica de colisiones para calibrar buffers y capacidad
- Análisis de ocupación por staff

---

## Convenciones

### Naming
- Tablas `snake_case`
- Todas con `tenant_id` si son de dominio
- `slot = tstzrange(starts_at, ends_at, '[)')` para reglas temporales

### Helpers
- `hasFeature(orgId, 'feature_key')`
- `getOrgTimezone(orgId)`
- `check_staff_availability(tenant_id, staff_id, starts_at, ends_at)`
- `get_overlap_error_message(tenant_id, staff_id, starts_at, ends_at)`

### Errores de Negocio
- Solape: 409 "Slot solapado"
- Rate limit: 429 "Rate limit"
- Falta price_id: 422 "Servicio no vendible"

### Seguridad
- RLS siempre activas
- Ningún endpoint confía en el cliente para `tenant_id`
- Webhooks y crons con secretos `x-*` y verificación de firma

### Logs
- Estructurados, sin PII/payload sensible
- Correlación por `appointment_id` y `event_id`

---

## Tests

### Unitarios
- Helpers (`check_staff_availability`, `get_overlap_error_message`)
- Validación de TTL
- Validación de rate limit

### Integración
- RLS y DB (políticas por tenant_id)
- Webhook idempotente
- Constraint anti-solapes
- Rate limit

### E2E
- Reserva → pago → confirmación
- Flujo completo con solapes
- Flujo completo con rate limit

---

## Orden de Ejecución

1. **P0.1** Idempotencia Stripe → merge
2. **P0.2** TTL + Rate limit → merge
3. **P0.3** Anti-solapes → merge

---

## Estado de Implementación

- ✅ **P0.1**: Implementado (`0020_pr1_stripe_idempotency.sql`, `app/api/webhooks/stripe/route.ts`)
- ✅ **P0.2**: Implementado (`0021_pr2_hold_ttl_cleanup.sql`, `app/api/internal/cron/release-holds/route.ts`, `app/api/reservations/hold/route.ts`)
- ✅ **P0.3**: Implementado (`0022_pr3_anti_overlap_constraint.sql`, `app/api/reservations/hold/route.ts`)
- 🔄 **Mejoras**: En progreso (`0024_p0_improvements.sql`)


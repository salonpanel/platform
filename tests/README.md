# Tests - Guía de Testing

## Estado Actual

Los tests están estructurados pero requieren configuración de Jest y Supabase local para ejecutarse completamente.

## Tests Implementados

### 1. RLS Tests (`tests/rls.test.ts`)
- **Aislamiento multi-tenant**: Verifica que los usuarios solo pueden acceder a datos de su tenant
- **Roles y permisos**: Verifica que los roles funcionan correctamente
- **Lectura pública**: Verifica que los endpoints públicos funcionan

### 2. Webhook Idempotency Tests (`tests/webhook-idempotency.test.ts`)
- **Evento único**: Verifica que un evento nuevo se procesa correctamente
- **Evento duplicado**: Verifica que un evento duplicado no se procesa dos veces
- **Logging sin PII**: Verifica que los logs no contienen información sensible

### 3. Overlap Constraint Tests (`tests/overlap-constraint.test.ts`)
- **Solape de staff_id**: Verifica que el constraint previene solapes
- **Multi-tenant**: Verifica que diferentes tenants pueden tener solapes
- **Estados excluidos**: Verifica que los estados excluidos no previenen solapes

### 4. Rate Limit Tests (`tests/rate-limit.test.ts`)
- **Límite de 50 req/10min**: Verifica que el límite funciona correctamente
- **Sliding window**: Verifica que el sliding window funciona
- **Diferentes IPs**: Verifica que diferentes IPs tienen límites independientes

## Ejecutar Tests

### Prerrequisitos

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Configurar variables de entorno**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
   SUPABASE_SERVICE_ROLE_KEY=test-service-role-key
   ```

3. **Iniciar Supabase local** (opcional):
   ```bash
   supabase start
   ```

### Ejecutar Tests con Jest

```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests en modo watch
npm run test:watch

# Ejecutar tests con cobertura
npm run test:coverage
```

### Ejecutar Tests Manualmente

Los tests también se pueden ejecutar manualmente usando los endpoints o scripts SQL.

## Tests Manuales

### PR1: Idempotencia Stripe

```bash
# Test 1: Disparar el mismo evento dos veces
curl -X POST http://localhost:3000/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -H "stripe-signature: test" \
  -d '{"id":"evt_test_123","type":"checkout.session.completed"}'

# Primera vez: 200 OK, evento procesado
# Segunda vez: 200 OK, deduped: true (sin procesar)
```

### PR2: TTL + Rate Limit

```bash
# Test 1: TTL de Holds
# 1. Crear hold con HOLD_TTL_MIN=1
# 2. Esperar 60-120 segundos
# 3. Ejecutar cron manualmente
curl -X POST http://localhost:3000/api/internal/cron/release-holds?key=test-cron-key

# 4. Verificar que el hold expirado tiene status='cancelled'

# Test 2: Rate Limit
# 1. Hacer más de 50 requests en 10 minutos desde la misma IP
for i in {1..51}; do
  curl -X POST http://localhost:3000/api/reservations/hold \
    -H "Content-Type: application/json" \
    -d '{"org_id":"test","service_id":"test","starts_at":"2024-01-15T10:00:00Z"}'
done

# 2. Verificar que después del límite se retorna 429
```

### PR3: Anti-Solapes

```bash
# Test 1: Anti-Solapes
# 1. Insertar hold para staff_id=X, rango 10:00-10:30
curl -X POST http://localhost:3000/api/reservations/hold \
  -H "Content-Type: application/json" \
  -d '{"org_id":"test","service_id":"test","staff_id":"test","starts_at":"2024-01-15T10:00:00Z"}'

# 2. Intentar insertar otro hold para staff_id=X, rango 10:15-10:45
curl -X POST http://localhost:3000/api/reservations/hold \
  -H "Content-Type: application/json" \
  -d '{"org_id":"test","service_id":"test","staff_id":"test","starts_at":"2024-01-15T10:15:00Z"}'

# 3. Verificar que la segunda petición responde 409 (conflict)
```

## Tests SQL Directos

### RLS Tests

```sql
-- Test 1: Usuario de tenant1 solo puede leer tenant1
SET ROLE authenticated;
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

SELECT id FROM public.tenants WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- Debe retornar el tenant

SELECT id FROM public.tenants WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
-- Debe retornar vacío (diferente tenant)
```

### Anti-Solapes Tests

```sql
-- Test 1: Insertar booking solapado (debe fallar con 23P01)
INSERT INTO public.bookings (
  tenant_id, customer_id, staff_id, service_id,
  starts_at, ends_at, status
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '2024-01-15T10:00:00Z',
  '2024-01-15T10:30:00Z',
  'pending'
);

-- Intentar insertar booking solapado (debe fallar)
INSERT INTO public.bookings (
  tenant_id, customer_id, staff_id, service_id,
  starts_at, ends_at, status
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '2024-01-15T10:15:00Z',
  '2024-01-15T10:45:00Z',
  'pending'
);
-- Debe fallar con error 23P01 (exclusion violation)
```

## Criterios de Aceptación

### PR1: Idempotencia Stripe
- ✅ Reintentos del mismo evento no cambian estado
- ✅ Logs sin payload sensible (PII)

### PR2: TTL + Rate Limit
- ✅ Un hold sin pago se libera ≤10 minutos
- ✅ >50 holds/10min por IP devuelve 429

### PR3: Anti-Solapes
- ✅ Ningún segundo hold/confirm solapado del mismo staff_id entra (error 409)

## Próximos Pasos

1. **Configurar Jest**: Instalar y configurar Jest para ejecutar tests automatizados
2. **Tests de Integración**: Crear tests de integración end-to-end
3. **Tests de Carga**: Crear tests de carga para rate limit
4. **Tests de Concurrencia**: Crear tests de concurrencia para constraint anti-solapes


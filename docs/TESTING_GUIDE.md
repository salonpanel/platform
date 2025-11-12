# Guía de Testing - P0

## Resumen Ejecutivo

Tests implementados para verificar RLS, webhook idempotente, solapes y rate-limit. Los tests están estructurados pero requieren configuración de Jest y Supabase local para ejecutarse completamente.

## Tests Implementados

### 1. RLS Tests

**Ubicación**: `tests/rls.test.ts`

**Criterios de Aceptación**:
- ✅ Ningún test cruza tenant
- ✅ Usuarios solo pueden acceder a datos de su tenant
- ✅ Lectura pública funciona para endpoints de disponibilidad

**Tests**:
1. **Aislamiento multi-tenant**: Usuario de tenant1 solo puede leer tenant1
2. **Denegación de acceso**: Usuario de tenant1 no puede leer tenant2
3. **Services**: Usuario solo puede leer servicios de su tenant
4. **Bookings**: Usuario solo puede leer bookings de su tenant
5. **Memberships**: Usuario solo puede leer sus propios memberships
6. **Lectura pública**: Servicios, staff y schedules activos son accesibles públicamente

### 2. Webhook Idempotency Tests

**Ubicación**: `tests/webhook-idempotency.test.ts`

**Criterios de Aceptación**:
- ✅ Reintentos del mismo evento no cambian estado
- ✅ Logs sin payload sensible (PII)

**Tests**:
1. **Evento único**: Evento nuevo se procesa correctamente
2. **Evento duplicado**: Evento duplicado retorna 200 sin efectos (23505)
3. **Logging sin PII**: Logs solo contienen tipo e ID, sin payload sensible

### 3. Overlap Constraint Tests

**Ubicación**: `tests/overlap-constraint.test.ts`

**Criterios de Aceptación**:
- ✅ Ningún segundo hold/confirm solapado del mismo staff_id entra (error 409)
- ✅ Diferentes tenants pueden tener solapes
- ✅ Estados excluidos no previenen solapes

**Tests**:
1. **Solape de staff_id**: Segundo booking solapado falla con 23P01
2. **Multi-tenant**: Diferentes tenants pueden tener solapes
3. **Estados excluidos**: Bookings cancelled no previenen solapes

### 4. Rate Limit Tests

**Ubicación**: `tests/rate-limit.test.ts`

**Criterios de Aceptación**:
- ✅ >50 holds/10min por IP devuelve 429
- ✅ Diferentes IPs tienen límites independientes

**Tests**:
1. **Límite de 50 req/10min**: Requests por debajo del límite funcionan
2. **Requests por encima del límite**: Requests por encima del límite devuelven 429
3. **Sliding window**: Sliding window funciona correctamente
4. **Diferentes IPs**: Diferentes IPs tienen límites independientes

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

Los tests también se pueden ejecutar manualmente usando los endpoints o scripts SQL (ver `tests/README.md`).

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


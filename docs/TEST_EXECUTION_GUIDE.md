# Guía de Ejecución de Tests

## Resumen

Guía completa para ejecutar todos los tests del proyecto, incluyendo RLS, concurrencia, rate-limit y webhook idempotency.

## Tests Disponibles

### 1. Tests RLS (`tests/rls-executable.test.ts`)

**Descripción**: Valida que las políticas RLS funcionan correctamente por rol y tenant_id.

**Ejecutar**:
```bash
npm test -- tests/rls-executable.test.ts
```

**Prerrequisitos**:
- Supabase local o remoto configurado
- Usuarios de prueba en `auth.users` (opcional, los tests pueden usar `service_role`)

### 2. Tests de Concurrencia - Solapes (`tests/concurrency-overlap.test.ts`)

**Descripción**: Valida que el constraint EXCLUDE previene solapes en condiciones de alta concurrencia.

**Ejecutar**:
```bash
npm test -- tests/concurrency-overlap.test.ts
```

**Prerrequisitos**:
- Supabase local o remoto configurado
- Extensión `btree_gist` instalada
- Constraint `excl_staff_overlap_bookings` activo

### 3. Tests de Concurrencia - Rate Limit (`tests/concurrency-rate-limit.test.ts`)

**Descripción**: Valida que el rate limit funciona correctamente bajo carga.

**Ejecutar**:
```bash
npm test -- tests/concurrency-rate-limit.test.ts
```

**Prerrequisitos**:
- Upstash Redis configurado (`UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`)
- Rate limit configurado en el endpoint

### 4. Tests SQL Directos (`tests/rls-sql-test.sql`)

**Descripción**: Script SQL ejecutable en Supabase SQL Editor para validar políticas RLS.

**Ejecutar**:
```bash
# Copiar contenido de tests/rls-sql-test.sql
# Ejecutar en Supabase SQL Editor
# O usar Supabase CLI:
supabase db execute --file tests/rls-sql-test.sql
```

### 5. Script de Validación RLS (`tests/rls-validation.ts`)

**Descripción**: Valida que RLS está habilitado, las funciones helper existen y las políticas RLS están correctamente configuradas.

**Ejecutar**:
```bash
npm run test:rls
# o
ts-node tests/rls-validation.ts
```

## Ejecutar Todos los Tests

### Con Jest

```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests en modo watch
npm run test:watch

# Ejecutar tests con cobertura
npm run test:coverage
```

### Tests Específicos

```bash
# Tests RLS
npm test -- tests/rls-executable.test.ts

# Tests de concurrencia
npm run test:concurrency

# Tests de rate-limit
npm test -- tests/concurrency-rate-limit.test.ts

# Tests de solapes
npm test -- tests/concurrency-overlap.test.ts
```

## Configuración de Entorno

### Variables de Entorno Requeridas

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
SUPABASE_SERVICE_ROLE_KEY=test-service-role-key

# Upstash Redis (para tests de rate-limit)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Stripe (para tests de webhook)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Instalar Dependencias

```bash
npm install
```

### Configurar Jest

El archivo `jest.config.js` está configurado para:
- Usar `ts-jest` para TypeScript
- Buscar tests en `tests/`
- Mapear imports `@/` a la raíz del proyecto
- Timeout de 30 segundos por test

## Tests Manuales

### Test 1: RLS - Aislamiento Multi-Tenant

```sql
-- Crear usuario de prueba
INSERT INTO public.memberships (tenant_id, user_id, role)
VALUES ('tenant-1-id', 'user-1-id', 'owner');

-- Autenticar como usuario
SET ROLE authenticated;
SET request.jwt.claim.sub = 'user-1-id';

-- Verificar que puede leer su tenant
SELECT id FROM public.tenants WHERE id = 'tenant-1-id';
-- Debe retornar el tenant

-- Verificar que NO puede leer otro tenant
SELECT id FROM public.tenants WHERE id = 'tenant-2-id';
-- Debe retornar vacío
```

### Test 2: Concurrencia - Solapes

```bash
# Crear hold para staff_id=X, rango 10:00-10:30
curl -X POST http://localhost:3000/api/reservations/hold \
  -H "Content-Type: application/json" \
  -d '{"org_id":"test","service_id":"test","staff_id":"test","starts_at":"2024-01-15T10:00:00Z"}'

# Intentar insertar otro hold para staff_id=X, rango 10:15-10:45
curl -X POST http://localhost:3000/api/reservations/hold \
  -H "Content-Type: application/json" \
  -d '{"org_id":"test","service_id":"test","staff_id":"test","starts_at":"2024-01-15T10:15:00Z"}'

# Verificar que la segunda petición responde 409 (conflict)
```

### Test 3: Rate Limit

```bash
# Hacer más de 50 requests en 10 minutos desde la misma IP
for i in {1..51}; do
  curl -X POST http://localhost:3000/api/reservations/hold \
    -H "Content-Type: application/json" \
    -d '{"org_id":"test","service_id":"test","starts_at":"2024-01-15T10:00:00Z"}'
done

# Verificar que después del límite se retorna 429
```

## Verificación de Resultados

### Tests RLS

- ✅ Owner puede gestionar todo en su tenant
- ✅ Owner NO puede acceder a datos de otro tenant
- ✅ Admin puede gestionar todo en su tenant
- ✅ Manager puede gestionar bookings y customers
- ✅ Staff solo puede leer bookings y customers
- ✅ Lectura pública funciona para servicios activos

### Tests de Concurrencia

- ✅ Múltiples requests simultáneos con solape retornan 409 (23P01)
- ✅ Solo uno de los requests concurrentes se procesa correctamente
- ✅ Métricas de p99 para tiempos de respuesta

### Tests de Rate Limit

- ✅ 50 req/10min por IP bloquea correctamente
- ✅ Sliding window funciona correctamente
- ✅ Diferentes IPs tienen límites independientes

## Troubleshooting

### Error: "RLS no está habilitado"

```sql
-- Verificar que RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND rowsecurity = true;

-- Habilitar RLS si es necesario
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
```

### Error: "Constraint no existe"

```sql
-- Verificar que el constraint existe
SELECT conname 
FROM pg_constraint 
WHERE conname = 'excl_staff_overlap_bookings';

-- Crear constraint si es necesario
-- Ver supabase/migrations/0022_pr3_anti_overlap_constraint.sql
```

### Error: "Rate limit no funciona"

```bash
# Verificar que Upstash Redis está configurado
echo $UPSTASH_REDIS_REST_URL
echo $UPSTASH_REDIS_REST_TOKEN

# Verificar que el rate limit está habilitado en el endpoint
# Ver app/api/reservations/hold/route.ts
```

## Estado

- ✅ Tests RLS ejecutables creados
- ✅ Tests de concurrencia creados
- ✅ Tests de rate-limit creados
- ✅ Tests SQL directos creados
- ✅ Script de validación creado
- ✅ Documentación completada

## Próximos Pasos

- [ ] Crear usuarios de prueba en auth.users para tests automatizados
- [ ] Ejecutar tests en entorno de staging
- [ ] Añadir tests de integración end-to-end
- [ ] Añadir tests de rendimiento
- [ ] Añadir métricas de uso


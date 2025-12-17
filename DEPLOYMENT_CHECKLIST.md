# Checklist de Despliegue - P1 Completado

## Resumen de Cambios

### P1.2: Timezone por Tenant
- ✅ Migración SQL: `0028_p1_timezone_ui_complete.sql`
- ✅ Endpoints API: `/api/tenants/[tenantId]/timezone`, `/api/admin/tenants/[orgId]/timezone`
- ✅ UI actualizada: Agenda, BookingWidget, ReserveClient, Admin Panel
- ✅ Validación de slots pasados en frontend

### P1: RLS Tests Suite Completa
- ✅ Tests ejecutables: `tests/rls-executable.test.ts`
- ✅ Tests SQL directos: `tests/rls-sql-test.sql`
- ✅ Script de validación: `tests/rls-validation.ts`
- ✅ Configuración Jest: `jest.config.js`, `tests/setup.ts`
- ✅ Scripts de ejecución: `scripts/test-rls.sh`, `scripts/test-rls.ps1`
- ✅ Documentación: `docs/P1_RLS_TESTS_COMPLETE.md`, `docs/TEST_EXECUTION_GUIDE.md`

## Pasos para Desplegar

### 1. Git - Subir Cambios a GitHub

```bash
# Inicializar git (si no está inicializado)
git init

# Añadir todos los archivos
git add -A

# Hacer commit
git commit -m "feat: P1 completado - Timezone por tenant y RLS tests suite completa

- P1.2: Timezone por tenant completo
  - Migración SQL para timezone en tenants
  - Endpoints API para obtener/actualizar timezone
  - UI actualizada (agenda, booking widget, reserve client, admin panel)
  - Validación de slots pasados en frontend
  - Gestión de timezone desde admin panel

- P1: RLS tests suite completa
  - Tests ejecutables con Jest (rls-executable.test.ts)
  - Tests SQL directos (rls-sql-test.sql)
  - Script de validación RLS (rls-validation.ts)
  - Configuración Jest y setup
  - Scripts de ejecución (bash y PowerShell)
  - Documentación completa

- Mejoras adicionales
  - ReserveClient actualizado para usar tenant_id
  - ReservePage actualizado para resolver tenant por UUID o slug
  - Admin panel con gestión de timezone
  - Scripts npm para ejecutar tests
  - Documentación de tests y ejecución"

# Añadir remote (si no está añadido)
git remote add origin <URL_DEL_REPOSITORIO>

# Subir cambios
git push -u origin main
```

### 2. Supabase - Aplicar Migraciones

#### Opción A: Usando Supabase CLI (Recomendado)

```bash
# Verificar que estás conectado a tu proyecto
supabase link --project-ref <PROJECT_REF>

# Aplicar migraciones pendientes
supabase db push

# O aplicar migraciones específicas
supabase migration up
```

#### Opción B: Desde Supabase Dashboard

1. Ir a **Database** → **Migrations**
2. Verificar que las migraciones están listadas:
   - `0028_p1_timezone_ui_complete.sql`
3. Aplicar migraciones pendientes manualmente
4. Verificar que las migraciones se aplicaron correctamente

#### Opción C: Ejecutar SQL Directamente

1. Ir a **SQL Editor** en Supabase Dashboard
2. Copiar el contenido de `supabase/migrations/0028_p1_timezone_ui_complete.sql`
3. Ejecutar el SQL
4. Verificar que no hay errores

### 3. Verificar Migraciones Aplicadas

```sql
-- Verificar que timezone existe en tenants
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tenants'
  AND column_name = 'timezone';

-- Verificar que las funciones helper existen
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema IN ('app', 'public')
  AND routine_name IN ('get_tenant_timezone', 'is_slot_in_past', 'to_tenant_timezone', 'get_tenant_info');

-- Verificar que las políticas RLS existen
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('tenants', 'customers', 'staff', 'services', 'schedules', 'bookings', 'memberships');
```

### 4. Instalar Dependencias de Node.js

```bash
# Instalar dependencias (incluye ts-node para tests)
npm install

# Verificar que ts-node está instalado
npm list ts-node
```

### 5. Configurar Variables de Entorno

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>

# Upstash Redis (para rate limit)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Vercel Cron (opcional)
INTERNAL_CRON_KEY=your-secret-key
```

### 6. Ejecutar Tests (Opcional)

```bash
# Ejecutar tests RLS
npm run test:rls

# Ejecutar tests de concurrencia
npm run test:concurrency

# Ejecutar todos los tests
npm test
```

### 7. Desplegar a Vercel

```bash
# Si usas Vercel CLI
vercel deploy

# O desde GitHub, Vercel detectará automáticamente los cambios
# Asegúrate de que las variables de entorno están configuradas en Vercel
```

## Migraciones a Aplicar

### Migraciones Pendientes

1. **0028_p1_timezone_ui_complete.sql**
   - Añade timezone a tenants
   - Crea funciones helper para timezone
   - Mejora validación de timezone
   - Crea índice para timezone

### Migraciones Ya Aplicadas (Verificar)

- ✅ 0020_pr1_stripe_idempotency.sql
- ✅ 0021_pr2_hold_ttl_cleanup.sql
- ✅ 0022_pr3_anti_overlap_constraint.sql
- ✅ 0024_p0_improvements.sql
- ✅ 0025_p1_rls_complete.sql
- ✅ 0026_p1_timezone_complete.sql
- ✅ 0027_p1_stripe_sync.sql

## Verificación Post-Despliegue

### 1. Verificar Timezone

```sql
-- Verificar que timezone existe en tenants
SELECT id, name, timezone
FROM public.tenants
LIMIT 10;

-- Verificar que timezone tiene valor por defecto
SELECT id, name, timezone
FROM public.tenants
WHERE timezone IS NULL;
-- No debe retornar resultados
```

### 2. Verificar Funciones Helper

```sql
-- Probar función get_tenant_timezone
SELECT app.get_tenant_timezone('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
-- Debe retornar 'Europe/Madrid' o el timezone configurado

-- Probar función is_slot_in_past
SELECT public.is_slot_in_past(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '2024-01-01T10:00:00Z'
);
-- Debe retornar true o false
```

### 3. Verificar Endpoints API

```bash
# Probar endpoint de timezone
curl http://localhost:3000/api/tenants/<TENANT_ID>/timezone

# Probar endpoint de admin timezone (requiere autenticación)
curl -X PUT http://localhost:3000/api/admin/tenants/<ORG_ID>/timezone \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d '{"timezone": "America/New_York"}'
```

### 4. Verificar UI

1. Ir a `/panel/agenda` y verificar que las horas se muestran correctamente
2. Ir a `/r/[orgId]` y verificar que los slots se muestran correctamente
3. Ir a `/admin/[orgId]` y verificar que se puede gestionar el timezone

## Troubleshooting

### Error: "timezone column does not exist"

```sql
-- Aplicar migración manualmente
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Madrid';

-- Actualizar tenants existentes
UPDATE public.tenants 
SET timezone = 'Europe/Madrid' 
WHERE timezone IS NULL OR timezone = '';

-- Asegurar que timezone no puede ser null
ALTER TABLE public.tenants 
  ALTER COLUMN timezone SET DEFAULT 'Europe/Madrid',
  ALTER COLUMN timezone SET NOT NULL;
```

### Error: "function app.get_tenant_timezone does not exist"

```sql
-- Aplicar función manualmente
-- Ver contenido de 0028_p1_timezone_ui_complete.sql
```

### Error: "RLS policies do not exist"

```sql
-- Verificar que RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND rowsecurity = true;

-- Si no está habilitado, aplicar migración 0025_p1_rls_complete.sql
```

## Archivos Nuevos Creados

### Migraciones SQL
- `supabase/migrations/0028_p1_timezone_ui_complete.sql`

### Endpoints API
- `app/api/tenants/[tenantId]/timezone/route.ts`
- `app/api/admin/tenants/[orgId]/timezone/route.ts`

### Tests
- `tests/rls-executable.test.ts`
- `tests/rls-sql-test.sql`
- `tests/rls-validation.ts`
- `tests/setup.ts`

### Scripts
- `scripts/test-rls.sh`
- `scripts/test-rls.ps1`

### Documentación
- `docs/P1_RLS_TESTS_COMPLETE.md`
- `docs/P1_TIMEZONE_COMPLETE_FINAL.md`
- `docs/TEST_EXECUTION_GUIDE.md`
- `DEPLOYMENT_CHECKLIST.md` (este archivo)

### Configuración
- `jest.config.js` (actualizado)
- `package.json` (actualizado con scripts y ts-node)

## Estado Final

- ✅ P1.2: Timezone por tenant - COMPLETADO
- ✅ P1: RLS tests suite completa - COMPLETADO
- ✅ Documentación completa - COMPLETADO
- ✅ Scripts de ejecución - COMPLETADO
- ✅ Configuración Jest - COMPLETADO

## Próximos Pasos

1. **Git**: Inicializar repositorio y subir cambios
2. **Supabase**: Aplicar migración `0028_p1_timezone_ui_complete.sql`
3. **Vercel**: Desplegar cambios (si aplica)
4. **Tests**: Ejecutar tests para verificar que todo funciona
5. **Verificación**: Verificar que timezone funciona correctamente en UI


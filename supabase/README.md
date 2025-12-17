# 📘 BookFast Pro - Workflow de Migraciones de Base de Datos

## 🎯 Objetivo

Este documento define el workflow profesional para gestionar migraciones de base de datos en BookFast Pro, asegurando que el entorno local refleje fielmente el estado de producción.

### Flujo oficial para seed BookFast (demo comercial)
1. `seed_bookfast_demo.sql`
2. `seed_bookfast_assign_users.sql` (falla si `staff.user_id` en owners queda NULL)
3. `seed_bookfast_bookings.sql`
4. `seed_bookfast_validate.sql` + validaciones comerciales

## 🏗️ Arquitectura de Base de Datos

### Multi-Tenancy con RLS
- **Schema `app`**: Funciones de contexto multi-tenant (`current_tenant_id()`)
- **Schema `public`**: Todas las tablas de negocio con RLS habilitado
- **Schema `auth`**: Gestión de usuarios (Supabase Auth)
- **Schema `storage`**: Almacenamiento de archivos (Supabase Storage)

### Tablas Críticas
- `tenants`: Organizaciones/barberías
- `memberships`: Relación usuarios-tenants con roles
- `profiles`: Perfiles de usuario
- `staff`: Personal que atiende
- `services`: Servicios ofrecidos
- `bookings`: Reservas/citas
- `customers`: Clientes
- Y más (ver [0000_baseline.sql](./migrations/0000_baseline.sql))

## 📂 Estructura de Archivos

```
/supabase
├── migrations/
│   ├── 0000_baseline.sql         ← SCHEMA COMPLETO de producción
│   ├── 20241212_feature.sql      ← Migraciones incrementales
│   └── backup_old_migrations/    ← Backups de archivos antiguos
├── seed.sql                      ← Datos de desarrollo (usuarios, tenant demo)
└── config.toml                   ← Configuración de Supabase local
```

## ✅ Baseline Actual (2024-12-12)

### ¿Qué Contiene?
El archivo `0000_baseline.sql` (11,614 líneas) incluye:

✔ **Schemas completos**: `auth`, `public`, `storage`, `app`  
✔ **31 tablas públicas**: tenants, memberships, staff, services, bookings, etc.  
✔ **Funciones críticas**:
  - `app.current_tenant_id()` ← **NUEVA** (agregada en baseline)
  - `user_has_role_for_tenant()`
  - Funciones de métricas, auditoría, etc.
✔ **Policies RLS completas**: Multi-tenant por tabla  
✔ **Triggers**: Auditoría, actualización de timestamps  
✔ **Índices optimizados**: Para queries frecuentes  
✔ **Constraints**: FK, checks, unique  
✔ **Extensions**: pgcrypto, uuid-ossp, pg_trgm, etc.

### Correcciones Aplicadas
1. **Agregado schema `app`** (faltaba en producción)
2. **Función `app.current_tenant_id()`** implementada correctamente
3. **Eliminados comandos `SET`** innecesarios de pg_dump
4. **Policies corregidas**: Referencia a `app.current_tenant_id()` funcional

## 🚀 Comandos Básicos

### 1. Iniciar Supabase Local
```bash
npm run supabase:start
# o directamente:
supabase start
```

### 2. Reset Completo (Baseline + Seed)
```bash
npm run supabase:reset
# o directamente:
supabase db reset
```

Esto ejecuta:
1. Drop todas las tablas
2. Aplica `0000_baseline.sql`
3. Aplica `seed.sql` (usuarios y tenant demo)

### 3. Crear Nueva Migración
```bash
supabase migration new nombre_descriptivo
```

Ejemplo:
```bash
supabase migration new add_notifications_table
```

### 4. Aplicar Migraciones Pendientes
```bash
npm run supabase:migrate
# o directamente:
supabase db push
```

### 5. Verificar Estado de Migraciones
```bash
supabase migration list
```

## 🔄 Workflow de Desarrollo

### Caso 1: Agregar una Nueva Tabla

```bash
# 1. Crear migración
supabase migration new add_notifications

# 2. Editar /supabase/migrations/20241212_add_notifications.sql
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  message text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

-- Índices
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_tenant ON public.notifications(tenant_id);

# 3. Aplicar localmente
supabase db push

# 4. Verificar en Next.js
npm run dev

# 5. Commit
git add supabase/migrations/20241212_add_notifications.sql
git commit -m "feat: add notifications table"

# 6. Deploy a producción (Supabase Dashboard o CLI)
supabase db push --linked
```

### Caso 2: Modificar Schema Existente

**⚠️ NUNCA modificar `0000_baseline.sql` directamente**

Crear una nueva migración:

```bash
supabase migration new alter_bookings_add_notes

# Editar archivo:
ALTER TABLE public.bookings
  ADD COLUMN internal_notes text;

COMMENT ON COLUMN public.bookings.internal_notes IS 'Notas internas para el staff';

# Aplicar
supabase db push
```

### Caso 3: Sincronizar desde Producción (Re-baseline)

Si realizaste cambios en producción via SQL Editor y quieres actualizar local:

```bash
# 1. Exportar schema completo de producción
supabase db dump --schema public --schema auth --schema storage --data-only=false > new_baseline.sql

# 2. Comparar con baseline actual
diff supabase/migrations/0000_baseline.sql new_baseline.sql

# 3. Opción A: Crear migración incremental con los cambios
supabase migration new sync_from_production
# (copiar solo los cambios relevantes)

# 3. Opción B: Reemplazar baseline completo (solo si es necesario)
mv new_baseline.sql supabase/migrations/0000_baseline.sql
supabase db reset
```

## 🧪 Testing Local

### Datos de Seed Incluidos

```javascript
// Usuario Owner
email: 'owner@bookfast.local'
password: 'password123'  // ⚠️ Solo desarrollo

// Usuario Staff
email: 'staff@bookfast.local'
password: 'password123'  // ⚠️ Solo desarrollo

// Tenant
name: 'BookFast Demo'
slug: 'bookfast-demo'
id: '10000000-0000-0000-0000-000000000001'
```

### Probar RLS Multi-Tenant

```sql
-- Como owner@bookfast.local (con auth.uid())
SELECT * FROM public.tenants;
-- ✔ Debe retornar el tenant demo

SELECT * FROM public.bookings;
-- ✔ Solo bookings del tenant demo

-- Intentar acceder a otro tenant
SELECT * FROM public.bookings WHERE tenant_id = 'otro-uuid';
-- ✔ Debe retornar vacío (RLS bloqueado)
```

### Verificar Función app.current_tenant_id()

```sql
SELECT app.current_tenant_id();
-- ✔ Debe retornar: 10000000-0000-0000-0000-000000000001
```

## 🚨 Errores Comunes y Soluciones

### Error: `relation "tenants" does not exist`
**Solución**:
```bash
supabase db reset
```

### Error: `function app.current_tenant_id() does not exist`
**Solución**:
El baseline está desactualizado. Asegúrate de usar `0000_baseline.sql` reciente que incluye el schema `app`.

```bash
git pull origin main  # Si está en el repo
supabase db reset
```

### Error: `permission denied for schema app`
**Solución**:
Falta grant. Agregar al final del baseline o migración:

```sql
GRANT USAGE ON SCHEMA "app" TO "anon", "authenticated", "service_role";
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "app" TO "anon", "authenticated", "service_role";
```

### Migraciones pendientes en producción pero no local
**Solución**:
```bash
supabase db pull  # Descargar cambios de prod
supabase db reset  # Aplicar localmente
```

## 🎨 Buenas Prácticas

### ✅ DO
- Usar `supabase migration new` para TODOS los cambios
- Agregar comentarios SQL descriptivos
- Testear localmente antes de push a producción
- Hacer commit de archivos de migración
- Usar RLS en todas las tablas multi-tenant
- Agregar índices para queries frecuentes

### ❌ DON'T
- Ejecutar SQL manual en SQL Editor de producción sin crear migración
- Modificar `0000_baseline.sql` directamente (excepto re-baseline completo)
- Mezclar cambios de schema con datos en una migración
- Olvidar agregar policies RLS en nuevas tablas
- Hardcodear UUIDs o emails en migraciones (usar seed.sql)

## 📊 Próximos Pasos

### Fase 1: Consolidación (Completado ✅)
- [x] Baseline oficial con schema completo
- [x] Schema `app` con `current_tenant_id()`
- [x] Seed data para desarrollo
- [x] Documentación de workflow

### Fase 2: Mejoras Pendientes
- [ ] Tests automatizados de RLS
- [ ] CI/CD para migraciones
- [ ] Rollback automático en caso de error
- [ ] Versionado de schema en package.json

### Fase 3: Monitoreo
- [ ] Logs de migraciones aplicadas
- [ ] Alertas de divergencia local vs producción
- [ ] Backup automático antes de cada reset

## 📞 Soporte

Si encuentras algún problema:

1. Revisa este README
2. Verifica errores en consola: `supabase status`
3. Logs de PostgreSQL: `supabase db logs`
4. Resetea entorno: `supabase db reset`
5. Si persiste: Abre un issue en el repo

---

**Última actualización**: 2024-12-12  
**Versión del baseline**: 0000 (11,614 líneas)  
**Autor**: BookFast Pro Team

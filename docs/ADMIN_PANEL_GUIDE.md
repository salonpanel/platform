# Guía de Uso del Panel de Administración (/admin)

## 📋 Descripción

El panel de administración (`/admin`) es el centro de control de la plataforma PIA. Permite gestionar tenants (barberías), planes, features, timezones y realizar impersonación para soporte.

## 🔐 Acceso y Permisos

### Requisitos

- Usuario autenticado en Supabase
- Usuario registrado en `platform.platform_users` con `active = true`
- Rol: `admin`, `support` o `viewer`

### Roles y Permisos

| Rol | Lectura | Modificación | Impersonación |
|-----|---------|--------------|---------------|
| **admin** | ✅ Todo | ✅ Todo | ✅ Sí |
| **support** | ✅ Todo | ✅ Todo | ✅ Sí |
| **viewer** | ✅ Todo | ❌ No | ❌ No |

**Nota**: Los usuarios con rol `viewer` pueden ver información pero no realizar cambios.

## 🏠 Página Principal (`/admin`)

### Funcionalidades

1. **Lista de Tenants**
   - Muestra todas las barberías registradas en la plataforma
   - Información mostrada:
     - Nombre y slug
     - Plan actual (con estado de billing)
     - Features activos
     - KPIs (reservas totales, reservas hoy, servicios activos, staff activo)
     - Fecha de creación
   - Botón "Gestionar" para acceder al detalle de cada tenant

2. **Acciones Rápidas**
   - **+ Nueva Barbería**: Abre el wizard de onboarding
   - **Platform Users**: Gestiona usuarios administradores de la plataforma

### KPIs Mostrados

Los KPIs se obtienen de `org_metrics_daily` (último día disponible) con fallback a consultas directas:

- **Reservas totales**: Total de bookings del tenant
- **Reservas hoy**: Bookings confirmados del día actual
- **Servicios activos**: Número de servicios con `active = true`
- **Staff activo**: Número de staff con `active = true`

**Nota**: Si no hay métricas disponibles, se muestra "Sin métricas" y se puede consultar directamente desde la base de datos.

## 📊 Detalle de Tenant (`/admin/[orgId]`)

### Secciones Disponibles

#### 1. Plan Actual

**Funcionalidad**:
- Ver plan actual del tenant
- Cambiar plan del tenant
- Ver estado de billing (active, suspended, cancelled, trial)

**Uso**:
1. Selecciona un plan del dropdown
2. El cambio se aplica automáticamente
3. Se registra en `platform.audit_logs` con acción `plan_changed`

**Permisos**: Requiere rol `admin` o `support`

---

#### 2. Timezone

**Funcionalidad**:
- Ver timezone actual del tenant
- Actualizar timezone del tenant

**Uso**:
1. Introduce el timezone en formato `Continent/City` (ej: `Europe/Madrid`, `America/New_York`)
2. Haz clic en "Actualizar"
3. El cambio se aplica inmediatamente y se registra en auditoría

**Formatos válidos**:
- `Europe/Madrid`
- `America/New_York`
- `America/Los_Angeles`
- `UTC`
- Cualquier timezone válido de PostgreSQL

**Permisos**: Requiere rol `admin` o `support`

---

#### 3. Métricas Diarias

**Funcionalidad**:
- Ver métricas históricas del tenant
- Resumen de últimos 7 días
- Tabla detallada de últimos 14 días

**Métricas mostradas**:
- **Reservas (7d)**: Total de reservas en últimos 7 días
- **Ingresos (7d)**: Ingresos totales en últimos 7 días (en euros)
- **Ocupación (7d)**: Tasa de ocupación promedio en últimos 7 días
- **Servicios Activos**: Número actual de servicios activos

**Tabla de métricas**:
- Fecha
- Reservas totales
- Confirmadas (verde)
- Canceladas (rojo)
- No Show (naranja)
- Ingresos (en euros)
- Ocupación (porcentaje)

**Nota**: Las métricas se calculan automáticamente cada día a las 2:00 AM UTC mediante el cron job `calculate-metrics`.

**Botón "Actualizar"**: Recarga las métricas manualmente (últimos 30 días)

---

#### 4. Features

**Funcionalidad**:
- Ver todas las features disponibles
- Activar/desactivar features para el tenant (override)
- Ver si hay overrides activos

**Uso**:
1. Toggle el switch para activar/desactivar una feature
2. El override se crea/elimina automáticamente
3. Se registra en `platform.audit_logs` con acción `feature_toggled`

**Comportamiento**:
- Si la feature está activada: se crea un override en `platform.org_feature_overrides`
- Si la feature está desactivada: se elimina el override (vuelve al comportamiento del plan)

**Permisos**: Requiere rol `admin` o `support`

---

#### 5. Impersonación

**Funcionalidad**:
- Impersonar un tenant para soporte técnico
- Ver el panel del tenant como si fueras el owner
- Trazabilidad completa en auditoría

**Uso**:
1. Haz clic en el botón "Impersonar"
2. Introduce un motivo (obligatorio)
3. Se crea un registro en `platform.impersonations`
4. Se redirige a `/panel?impersonate=[orgId]`

**Seguridad**:
- Solo usuarios con rol `admin` o `support` pueden impersonar
- El motivo se registra en auditoría
- La impersonación expira después de 8 horas (configurable)
- Se puede terminar manualmente desde el panel

**Permisos**: Requiere rol `admin` o `support`

---

## 🆕 Crear Nueva Barbería (`/admin/new-tenant`)

### Wizard de Onboarding

El wizard consta de 4 pasos:

#### Paso 1: Datos Generales
- **Nombre**: Nombre de la barbería
- **Slug**: URL única (solo letras minúsculas, números y guiones)
- **Timezone**: Zona horaria (default: `Europe/Madrid`)

#### Paso 2: Usuario Owner
- **Email**: Email del owner (se crea usuario si no existe)
- **Nombre**: Nombre del owner (opcional)

#### Paso 3: Plan
- Seleccionar plan inicial (opcional, se puede asignar después)

#### Paso 4: Confirmar
- Revisar todos los datos
- Crear tenant

**Resultado**:
- Se crea el tenant en `public.tenants`
- Se crea o encuentra el usuario owner en `auth.users`
- Se crea membership con role `owner` en `public.memberships`
- Se asigna plan si se especificó
- Se envía magic link al email del owner (si es usuario nuevo)
- Se registra en auditoría

---

## 🔍 Verificación de Seguridad

### Endpoints Protegidos

Todos los endpoints de `/api/admin/*` verifican:

1. **Autenticación**: Usuario debe estar autenticado
2. **Platform Admin**: Usuario debe estar en `platform.platform_users` con `active = true`
3. **Permisos de Modificación**: Para operaciones de escritura, requiere rol `admin` o `support`

### Middleware

El middleware (`middleware.ts`) protege todas las rutas `/admin/*`:

- Redirige a `/login` si no hay sesión
- Verifica platform admin usando `check_platform_admin` RPC
- Redirige a `/login?error=unauthorized` si no es platform admin

---

## 📝 Auditoría

Todas las acciones se registran en `platform.audit_logs`:

| Acción | Target Type | Metadata |
|--------|-------------|----------|
| `tenant_created` | `tenant` | name, slug, timezone, owner_email |
| `plan_changed` | `plan` | plan_key, billing_state |
| `feature_toggled` | `feature` | feature_key, enabled, reason |
| `timezone_updated` | `tenant` | timezone |
| `impersonation_started` | `impersonation` | reason, expires_at |
| `impersonation_ended` | `impersonation` | - |

### Consultar Auditoría

```sql
-- Ver todas las acciones de un tenant
SELECT * FROM platform.audit_logs
WHERE org_id = 'uuid-del-tenant'
ORDER BY created_at DESC
LIMIT 50;

-- Ver acciones de un platform admin
SELECT * FROM platform.audit_logs
WHERE actor_id = 'uuid-del-admin'
ORDER BY created_at DESC
LIMIT 50;
```

---

## ⚠️ Troubleshooting

### Error: "No autorizado"

**Causa**: Usuario no es platform admin o no tiene permisos de modificación.

**Solución**:
1. Verificar que el usuario existe en `platform.platform_users`
2. Verificar que `active = true`
3. Verificar que el rol es `admin` o `support` (no `viewer`)

### Error: "Tenant no encontrado"

**Causa**: El tenant no existe o el usuario no tiene permisos.

**Solución**:
1. Verificar que el tenant existe en `public.tenants`
2. Verificar que el usuario es platform admin

### Métricas no se muestran

**Causa**: No hay métricas calculadas aún o el cron job no se ha ejecutado.

**Solución**:
1. Verificar que el cron job `calculate-metrics` se ejecuta correctamente
2. Verificar que hay datos en `org_metrics_daily` para el tenant
3. Usar el botón "Actualizar" para forzar recarga
4. Si no hay métricas, se mostrará "Sin métricas" y se usarán consultas directas como fallback

### Error al cambiar plan/features

**Causa**: Usuario no tiene permisos de modificación (es `viewer`).

**Solución**:
1. Verificar rol del usuario en `platform.platform_users`
2. Cambiar rol a `admin` o `support` si es necesario

---

## 🎯 Casos de Uso Comunes

### 1. Crear una nueva barbería

1. Ir a `/admin`
2. Clic en "+ Nueva Barbería"
3. Completar wizard de onboarding
4. Verificar que el tenant aparece en la lista

### 2. Cambiar plan de una barbería

1. Ir a `/admin/[orgId]`
2. Sección "Plan Actual"
3. Seleccionar nuevo plan del dropdown
4. Verificar cambio en la lista

### 3. Activar feature para un tenant específico

1. Ir a `/admin/[orgId]`
2. Sección "Features"
3. Toggle el switch de la feature deseada
4. Verificar que aparece como "Override activo"

### 4. Impersonar tenant para soporte

1. Ir a `/admin/[orgId]`
2. Clic en "Impersonar"
3. Introducir motivo (ej: "Soporte técnico - problema con reservas")
4. Se redirige a `/panel?impersonate=[orgId]`
5. Ver panel del tenant como si fueras el owner

### 5. Ver salud de una barbería

1. Ir a `/admin/[orgId]`
2. Revisar sección "Métricas Diarias"
3. Verificar KPIs (reservas, ingresos, ocupación)
4. Revisar tabla de métricas históricas

---

## 📚 Referencias

- **Variables de entorno**: Ver `docs/ENV_SETUP.md`
- **Cron jobs**: Ver `docs/CRON_JOBS.md`
- **Backups**: Ver `docs/BACKUPS_AND_RESTORE.md`
- **RLS**: Ver `docs/P1_RLS_COMPLETE.md`

---

## 🔄 Mejoras Futuras

- [ ] Exportar métricas a CSV/Excel
- [ ] Gráficos de tendencias (reservas, ingresos)
- [ ] Filtros avanzados en lista de tenants
- [ ] Búsqueda de tenants por nombre/slug
- [ ] Notificaciones cuando un tenant tiene problemas
- [ ] Dashboard de métricas globales de la plataforma









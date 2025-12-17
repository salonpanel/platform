# 📋 Esquema Completo de Páginas - PIA Platform

**Fecha**: 2024-11-13  
**Versión**: 2.0 (Refinado con mejoras de seguridad)

---

## 🗺️ Índice de Navegación

### 🔓 Páginas Públicas (Sin Autenticación)

| Ruta | Propósito | Acceso |
|------|-----------|--------|
| `/` | Página de inicio / Landing | Público |
| `/login` | Página de login (Magic Link) | Público |
| `/r/[slug]` | Portal público de reservas del tenant | Público (slug legible, resuelto a tenant_id en servidor) |

---

### 🔐 Páginas Autenticadas (Requieren Sesión)

| Ruta | Propósito | Acceso | Roles con Escritura |
|------|-----------|--------|---------------------|
| `/panel` | Dashboard principal del panel de barbería | Usuarios del tenant | Todos (solo lectura) |
| `/panel/agenda` | Vista de agenda diaria con reservas | Usuarios del tenant | owner/admin/manager (acciones: cambiar estado, marcar no_show) |
| `/panel/clientes` | Gestión de clientes (CRUD) | Usuarios del tenant | owner/admin/manager |
| `/panel/servicios` | Gestión de servicios (CRUD) | Usuarios del tenant | owner/admin/manager |
| `/panel/staff` | Gestión de staff (CRUD) | Usuarios del tenant | owner/admin |
| `/panel/ajustes` | Configuración del tenant (nombre, timezone) | Usuarios del tenant | owner/admin |
| `/panel/config/payments` | Configuración de pagos (sincronización con Stripe) | Usuarios del tenant | owner/admin |
| `/logout` | Cerrar sesión | Cualquier usuario autenticado | - |

---

### 👑 Panel de Administración (Requiere Platform Admin)

| Ruta | Propósito | Acceso |
|------|-----------|--------|
| `/admin` | Lista de todos los tenants con KPIs | Platform Admin |
| `/admin/new-tenant` | Wizard de creación de nueva barbería | Platform Admin (admin/support) |
| `/admin/[orgId]` | Vista detallada de un tenant específico | Platform Admin |
| `/admin/platform-users` | Gestión de usuarios de plataforma | Platform Admin |

---

### 🔄 Páginas de Autenticación (Internas)

| Ruta | Propósito | Acceso |
|------|-----------|--------|
| `/auth/callback` | Callback de autenticación de Supabase | Automático (redirect) |
| `/auth/magic-link-handler` | Handler cliente para magic links | Automático (redirect) |

---

## 📄 Descripción Detallada de Páginas

### 🔓 PÁGINAS PÚBLICAS

#### `/` - Página de Inicio
- **Ruta**: `/`
- **Archivo**: `app/page.tsx` o `src/app/page.tsx`
- **Propósito**: Landing page / página de inicio de la plataforma
- **Estado**: Placeholder básico
- **Acceso**: Público (sin autenticación)
- **Nota**: Actualmente muestra "Platform OK ✓", puede mejorarse como landing page

---

#### `/login` - Página de Login
- **Ruta**: `/login`
- **Archivo**: `src/app/login/page.tsx` o `app/login/page.tsx`
- **Propósito**: 
  - Autenticación mediante Magic Link de Supabase
  - Auto-login en desarrollo para email específico (`u0136986872@gmail.com`)
- **Funcionalidades**:
  - Formulario de email
  - Envío de magic link
  - Redirección a `/panel` o URL especificada en `?redirect=`
- **Acceso**: Público
- **Redirección**: Si ya está autenticado, redirige a `/panel`

---

#### `/r/[slug]` - Portal Público de Reservas
- **Ruta**: `/r/[slug]` (donde `slug` es el identificador legible del tenant, ej: `banana-barbers`, `fade-collective`)
- **Archivo**: `app/r/[orgId]/page.tsx` (compatibilidad: acepta slug o UUID, pero se recomienda usar slug)
- **Propósito**: 
  - Portal público donde los clientes pueden hacer reservas
  - Widget de reservas visible públicamente
- **Funcionalidades**:
  - Muestra servicios disponibles del tenant
  - Permite seleccionar servicio, fecha, hora y staff
  - Proceso de checkout (hold → pago → confirmación)
- **Acceso**: Público (no requiere autenticación)
- **Resolución**: El slug se resuelve a `tenant_id` en el servidor (no se confía en el cliente)
- **Nota**: Esta es la página que los clientes finales verán para reservar. El UUID es interno; hacia el exterior se usa slug legible.

---

### 🔐 PANEL DE BARBERÍA (`/panel`)

**Layout Base**: `src/app/panel/layout.tsx`
- Sidebar con navegación
- Header con nombre del tenant, timezone y rol
- Banner de impersonación (si está activo)
- Botón "Terminar Impersonación"

---

#### `/panel` - Dashboard Principal
- **Ruta**: `/panel`
- **Archivo**: `src/app/panel/page.tsx`
- **Propósito**: Dashboard con estadísticas rápidas del tenant
- **Funcionalidades**:
  - Reservas de hoy
  - Servicios activos
  - Staff activo
  - Accesos rápidos a otras secciones
- **Acceso**: Usuarios autenticados del tenant
- **Protección**: Middleware verifica sesión

---

#### `/panel/agenda` - Agenda Diaria
- **Ruta**: `/panel/agenda`
- **Archivo**: `src/app/panel/agenda/page.tsx`
- **Propósito**: Vista de reservas del día
- **Funcionalidades**:
  - Selector de fecha
  - Filtro por barbero/staff
  - Lista de reservas con detalles:
    - Horario (formateado según timezone del tenant)
    - Cliente (nombre, email, teléfono)
    - Servicio (nombre, duración, precio)
    - Staff asignado
    - Estado (hold, confirmed, paid, cancelled, no_show)
  - Actualización en tiempo real (subscription)
- **Acceso**: Usuarios autenticados del tenant
- **Permisos**: 
  - **Lectura**: Todos los usuarios del tenant
  - **Escritura/Acciones**: owner/admin/manager (cambiar estado, marcar no_show, cancelar)
- **Timezone**: Usa timezone del tenant para formatear fechas
- **Roadmap**: Vista semanal planificada (`/panel/agenda/semanal` o toggle día/semana)

---

#### `/panel/clientes` - Gestión de Clientes
- **Ruta**: `/panel/clientes`
- **Archivo**: `src/app/panel/clientes/page.tsx`
- **Propósito**: CRUD completo de clientes
- **Funcionalidades**:
  - Lista de clientes con búsqueda (nombre, email, teléfono)
  - Crear nuevo cliente (nombre, email, teléfono)
  - Editar cliente (edición inline)
  - Ver conteo de reservas por cliente
  - Actualización en tiempo real
- **Acceso**: Usuarios autenticados del tenant
- **Permisos**: RLS permite lectura a todos, escritura a owner/admin/manager

---

#### `/panel/servicios` - Gestión de Servicios
- **Ruta**: `/panel/servicios`
- **Archivo**: `src/app/panel/servicios/page.tsx`
- **Propósito**: CRUD completo de servicios
- **Funcionalidades**:
  - Lista de servicios con estado (activo/inactivo)
  - Crear nuevo servicio (nombre, duración en minutos, precio en céntimos)
  - Editar servicio (edición inline)
  - Activar/desactivar servicios
  - Ver Stripe IDs (price_id, product_id) si están sincronizados
  - Actualización en tiempo real
- **Acceso**: Usuarios autenticados del tenant
- **Permisos**: RLS permite lectura a todos, escritura a owner/admin/manager
- **Nota**: Los servicios se crean sin sincronizar con Stripe. Para sincronizar, usar `/panel/config/payments`

---

#### `/panel/staff` - Gestión de Staff
- **Ruta**: `/panel/staff`
- **Archivo**: `src/app/panel/staff/page.tsx`
- **Propósito**: CRUD completo de miembros del staff
- **Funcionalidades**:
  - Lista de staff con estado (activo/inactivo)
  - Búsqueda por nombre o habilidades
  - Crear nuevo staff (nombre, habilidades separadas por comas)
  - Editar staff (edición inline)
  - Activar/desactivar staff
  - Ver conteo de reservas por staff
  - Actualización en tiempo real
- **Acceso**: Usuarios autenticados del tenant
- **Permisos**: RLS permite lectura a todos, escritura a owner/admin

---

#### `/panel/ajustes` - Configuración
- **Ruta**: `/panel/ajustes`
- **Archivo**: `src/app/panel/ajustes/page.tsx`
- **Propósito**: Configuración general del tenant
- **Funcionalidades**:
  - Editar nombre de la barbería
  - Cambiar timezone (selector con timezones comunes)
  - Ver información del sistema (tenant ID)
- **Acceso**: Usuarios autenticados del tenant
- **Permisos**: RLS permite lectura a todos, escritura a owner/admin

---

#### `/panel/config/payments` - Configuración de Pagos
- **Ruta**: `/panel/config/payments`
- **Archivo**: `src/app/panel/config/payments/page.tsx`
- **Propósito**: Sincronización de servicios con Stripe
- **Funcionalidades**:
  - Lista de servicios sin sincronizar
  - Sincronizar servicio individual con Stripe
  - Sincronizar todos los servicios
  - Ver estado de sincronización (product_id, price_id)
- **Acceso**: Usuarios autenticados del tenant
- **Permisos**: Requiere rol owner o admin
- **Nota**: Esta página permite crear productos y precios en Stripe para los servicios

---

### 👑 PANEL DE ADMINISTRACIÓN (`/admin`)

**Protección**: Middleware verifica que el usuario sea Platform Admin

---

#### `/admin` - Lista de Tenants
- **Ruta**: `/admin`
- **Archivo**: `src/app/admin/page.tsx`
- **Propósito**: Vista general de todos los tenants
- **Funcionalidades**:
  - Lista de todos los tenants con:
    - Nombre y slug
    - Plan actual
    - Features activos
    - KPIs básicos (reservas totales, reservas hoy, servicios activos, staff activo)
    - Fecha de creación
  - Botón "Nueva Barbería" (link a `/admin/new-tenant`)
  - Link a vista detallada de cada tenant
- **Acceso**: Platform Admin únicamente
- **Protección**: Middleware verifica `check_platform_admin` RPC

---

#### `/admin/new-tenant` - Wizard de Creación de Barbería
- **Ruta**: `/admin/new-tenant`
- **Archivo**: `src/app/admin/new-tenant/page.tsx`
- **Propósito**: Wizard multi-paso para crear nuevos tenants
- **Funcionalidades**:
  - **Paso 1**: Datos generales
    - Nombre de la barbería
    - Slug (generado automáticamente desde nombre)
    - Timezone
  - **Paso 2**: Usuario owner
    - Email del propietario
    - Nombre del propietario (opcional)
  - **Paso 3**: Plan (opcional)
    - Selección de plan inicial
  - **Paso 4**: Confirmación
    - Resumen de datos
    - Creación final
- **Resultado**:
  - Crea tenant en `public.tenants`
  - Crea o encuentra usuario en `auth.users`
  - Crea membership con rol `owner`
  - Asigna plan si se especificó
  - Envía magic link al owner
  - Registra en `platform.audit_logs`
- **Acceso**: Platform Admin con permisos de modificación (admin/support)
- **Tiempo estimado**: < 1 minuto

---

#### `/admin/[orgId]` - Vista Detallada de Tenant
- **Ruta**: `/admin/[orgId]` (donde `orgId` es el UUID del tenant)
- **Archivo**: `src/app/admin/[orgId]/page.tsx`
- **Propósito**: Panel de control completo para un tenant específico
- **Funcionalidades**:

  **1. Información General**
  - Nombre, slug, timezone
  - Fecha de creación
  - ID del tenant

  **2. Cambio de Plan**
  - Selector de plan (Free, Pro, Enterprise)
  - Estado de facturación
  - Aplicación inmediata de features del plan

  **3. Gestión de Features**
  - Lista de todas las features disponibles
  - Toggle individual para activar/desactivar
  - Visualización de overrides
  - Enforcement en backend

  **4. Cambio de Timezone**
  - Selector de timezone
  - Actualización inmediata

  **5. Métricas Diarias**
  - Resumen de últimos 7 días (cards):
    - Total reservas
    - Ingresos
    - Ocupación promedio
    - Servicios activos
  - Tabla de últimos 14 días con:
    - Fecha
    - Reservas (total, confirmadas, canceladas, no show)
    - Ingresos
    - Ocupación
  - Botón de actualización manual

  **6. Impersonación**
  - Modal para iniciar impersonación
  - Campo de motivo (obligatorio)
  - Expiración automática (8 horas por defecto)
  - Redirección a `/panel?impersonate=[orgId]`
  - Registro en `platform.impersonations` y `platform.audit_logs`

- **Acceso**: Platform Admin únicamente
- **Auditoría**: Todas las acciones se registran en `platform.audit_logs`

---

#### `/admin/platform-users` - Gestión de Platform Users
- **Ruta**: `/admin/platform-users`
- **Archivo**: `src/app/admin/platform-users/page.tsx`
- **Propósito**: Gestión de usuarios de plataforma (super-admins)
- **Funcionalidades**:
  - Lista de platform users
  - Crear nuevo platform user
  - Ver roles (admin, support, viewer)
  - Activar/desactivar usuarios
- **Acceso**: Platform Admin únicamente
- **Nota**: Estos son los usuarios que pueden acceder a `/admin`

---

### 🔄 PÁGINAS DE AUTENTICACIÓN (Internas)

#### `/auth/callback` - Callback de Autenticación
- **Ruta**: `/auth/callback`
- **Archivo**: `app/auth/callback/route.ts` o `src/app/auth/callback/route.ts`
- **Propósito**: Maneja el callback de Supabase después del login
- **Funcionalidades**:
  - Intercambia código por sesión
  - Registra login en `auth_logs`
  - Redirige a `/panel` o URL especificada en `?redirect=`
- **Acceso**: Automático (redirect desde magic link)
- **Nota**: Esta es una API Route (no página visible)

---

#### `/auth/magic-link-handler` - Handler de Magic Link
- **Ruta**: `/auth/magic-link-handler`
- **Archivo**: `app/auth/magic-link-handler/page.tsx`
- **Propósito**: Handler cliente para procesar magic links
- **Funcionalidades**:
  - Extrae `access_token` y `refresh_token` del hash de la URL
  - Establece sesión usando `supabase.auth.setSession()`
  - Redirige a `/panel` o URL especificada
- **Acceso**: Automático (redirect desde magic link)
- **Nota**: Necesario porque el hash no está disponible en el servidor

---

#### `/logout` - Cerrar Sesión
- **Ruta**: `/logout`
- **Archivo**: `src/app/logout/page.tsx` o `src/app/api/logout/route.ts`
- **Propósito**: Cerrar sesión del usuario
- **Funcionalidades**:
  - Cierra sesión de Supabase
  - Limpia cookies
  - Redirige a `/login`
- **Acceso**: Cualquier usuario autenticado

---

## 🔌 API Routes (Endpoints Backend)

### 🔐 Admin API (`/api/admin/*`)

| Endpoint | Método | Propósito | Protección |
|----------|--------|-----------|-------------|
| `/api/admin/tenants` | GET | Lista todos los tenants con KPIs | Platform Admin |
| `/api/admin/tenants` | POST | Crea nuevo tenant (wizard) | Platform Admin (admin/support) |
| `/api/admin/tenants/[orgId]` | GET | Obtiene detalles de un tenant | Platform Admin |
| `/api/admin/tenants/[orgId]/plan` | PUT | Cambia plan del tenant | Platform Admin (admin/support) |
| `/api/admin/tenants/[orgId]/features` | GET | Obtiene features del tenant | Platform Admin |
| `/api/admin/tenants/[orgId]/features` | PUT | Actualiza features (toggles) | Platform Admin (admin/support) |
| `/api/admin/tenants/[orgId]/timezone` | PUT | Actualiza timezone del tenant | Platform Admin (admin/support) |
| `/api/admin/tenants/[orgId]/impersonate` | POST | Inicia impersonación | Platform Admin (admin/support) |
| `/api/admin/tenants/[orgId]/impersonate` | DELETE | Termina impersonación | Platform Admin (admin/support) |
| `/api/admin/plans` | GET | Lista todos los planes | Platform Admin |
| `/api/admin/features` | GET | Lista todas las features | Platform Admin |
| `/api/admin/platform-users` | GET | Lista platform users | Platform Admin |
| `/api/admin/platform-users` | POST | Crea platform user | Platform Admin (admin) |

---

### 📅 Panel API (`/api/*`)

| Endpoint | Método | Propósito | Protección |
|----------|--------|-----------|-------------|
| `/api/services` | POST | Crea nuevo servicio | Usuario del tenant (owner/admin/manager) |
| `/api/services/[id]` | PATCH | Actualiza servicio | Usuario del tenant (owner/admin/manager) |
| `/api/payments/services/sync` | POST | Sincroniza servicio con Stripe | Usuario del tenant (owner/admin) |

---

### 🛒 Checkout API (`/api/checkout/*`)

| Endpoint | Método | Propósito | Protección |
|----------|--------|-----------|-------------|
| `/api/checkout/intent` | POST | Crea payment intent para reserva | Público sin sesión, pero protegido (rate limit + validaciones estrictas) |
| `/api/checkout/confirm` | POST | Confirma pago y crea booking | Público sin sesión, pero protegido (rate limit + validaciones estrictas) |
| `/api/reservations/hold` | POST | Crea hold temporal de reserva | Público sin sesión, pero protegido (rate limit + reCAPTCHA + validaciones estrictas) |

**🔒 Seguridad de Endpoints Públicos de Checkout**:
- **Rate Limiting**: 50 req/10min por IP (Upstash)
- **Validación Estricta**: `tenant_id` se deriva del `service_id` o `payment_intent_id`, nunca del cliente
- **No se acepta `tenant_id` del body**: Previene manipulación
- **reCAPTCHA**: Opcional, preparado para activación (`/api/reservations/hold` ya lo tiene)

---

### 🌐 Público API (`/api/*`)

| Endpoint | Método | Propósito | Protección |
|----------|--------|-----------|-------------|
| `/api/availability` | GET | Obtiene slots disponibles | Público sin sesión, pero protegido (rate limit + validaciones estrictas) |
| `/api/webhooks/stripe` | POST | Webhook de Stripe | Stripe signature |

**🔒 Seguridad de `/api/availability`**:
- **Rate Limiting**: 100 req/10min por IP (Upstash)
- **Validación Estricta**: `tenant_id` se resuelve desde `slug` o `UUID` en servidor, nunca del cliente

---

### ⚙️ Internal API (`/api/internal/*`)

| Endpoint | Método | Propósito | Protección |
|----------|--------|-----------|-------------|
| `/api/internal/cron/release-holds` | POST | Libera holds expirados | `INTERNAL_CRON_KEY` |
| `/api/internal/cron/calculate-metrics` | POST | Calcula métricas diarias | `INTERNAL_CRON_KEY` |

---

### 🏥 Health API (`/api/health/*`)

| Endpoint | Método | Propósito | Protección |
|----------|--------|-----------|-------------|
| `/api/health` | GET | Health check general (estado agregado) | Público (solo retorna ok/degraded/down) |
| `/api/health/db` | GET | Health check de base de datos (detalles) | Interno (INTERNAL_HEALTH_KEY) o Platform Admin |
| `/api/health/payments` | GET | Health check de Stripe (detalles) | Interno (INTERNAL_HEALTH_KEY) o Platform Admin |
| `/api/health/cron` | GET | Health check de cron jobs (métricas) | Interno (INTERNAL_HEALTH_KEY) o Platform Admin |
| `/api/health/webhooks` | GET | Health check de webhooks (métricas) | Interno (INTERNAL_HEALTH_KEY) o Platform Admin |

**🔒 Seguridad de Health Endpoints**:
- **`/api/health`**: Público, retorna solo estado general (ok/degraded/down) sin detalles sensibles
- **Endpoints específicos** (`/db`, `/payments`, `/cron`, `/webhooks`): Protegidos con:
  - Query param: `?key=INTERNAL_HEALTH_KEY`
  - O autenticación de Platform Admin
- **Razón**: Los endpoints específicos revelan información sensible (tiempos de respuesta, métricas internas, etc.)

---

### 🔧 Dev API (`/api/auth/*`)

| Endpoint | Método | Propósito | Protección |
|----------|--------|-----------|-------------|
| `/api/auth/dev-login` | POST | Auto-login en desarrollo | ⚠️ **SOLO DESARROLLO** (NODE_ENV === 'development') |

**⚠️ SEGURIDAD CRÍTICA - Dev Login**:
- **NO SE DEPLOYA EN PRODUCCIÓN**: Verificación estricta `NODE_ENV === 'development'`
- **Bloqueo doble**: Si `NODE_ENV === 'production'`, rechaza incluso si pasa la primera verificación
- **Email específico**: Solo permite `u0136986872@gmail.com` (configurado)
- **Logging**: Registra intentos de acceso en producción
- **Nota**: Este endpoint no debe estar activo en producción. Nunca se usa en tests que puedan correr en prod.

---

## 🛡️ Protección de Rutas

### Middleware (`middleware.ts`)

Protege las siguientes rutas:
- `/panel/*` - Requiere sesión autenticada
- `/admin/*` - Requiere sesión + Platform Admin

**Comportamiento**:
- Si no hay sesión → redirige a `/login?redirect=[ruta]`
- Si no es Platform Admin → redirige a `/login?error=unauthorized`

---

## 📊 Resumen de Accesos

### Por Tipo de Usuario

| Tipo de Usuario | Páginas Accesibles |
|-----------------|-------------------|
| **Público (sin sesión)** | `/`, `/login`, `/r/[slug]` |
| **Usuario del Tenant** | `/panel/*` (todas las secciones) |
| **Platform Admin** | `/admin/*` (todas las secciones) + `/panel/*` (con impersonación) |

---

## 🔗 Flujos de Navegación

### Flujo de Login
```
/login → Magic Link → /auth/magic-link-handler → /panel
```

### Flujo de Impersonación
```
/admin/[orgId] → Modal Impersonación → /panel?impersonate=[orgId]
```

### Flujo de Reserva Pública
```
/r/[slug] → Seleccionar servicio → Checkout → Pago → Confirmación
```

### Flujo de Creación de Tenant
```
/admin → /admin/new-tenant → Wizard (4 pasos) → Tenant creado → Magic link al owner
```

---

## 📝 Notas Importantes

1. **Timezone**: Todas las páginas del panel respetan el timezone del tenant
2. **RLS**: Todas las queries están protegidas por Row Level Security
3. **Impersonación**: Solo visible para Platform Admins, con banner y botón de salida
4. **Actualización en Tiempo Real**: Clientes, Servicios y Staff tienen subscriptions activas
5. **Auditoría**: Todas las acciones en `/admin` se registran en `platform.audit_logs`
6. **Seguridad de Endpoints Públicos**: Todos los endpoints públicos de checkout/availability tienen rate limiting y validaciones estrictas. El `tenant_id` nunca se acepta del cliente, siempre se deriva en el servidor.
7. **Naming**: Hacia el exterior se usa `slug` legible (ej: `banana-barbers`). El UUID es interno.
8. **Health Endpoints**: Solo `/api/health` es público. Los endpoints específicos requieren `INTERNAL_HEALTH_KEY` o Platform Admin.

---

## 🔐 Resumen de Mejoras de Seguridad (v2.0)

### Endpoints Públicos Endurecidos
- ✅ `/api/checkout/intent`: Rate limiting + `tenant_id` derivado de `service_id`
- ✅ `/api/checkout/confirm`: Rate limiting + `tenant_id` derivado de `payment_intent_id`
- ✅ `/api/reservations/hold`: Rate limiting + reCAPTCHA + validaciones estrictas
- ✅ `/api/availability`: Rate limiting + `tenant_id` resuelto desde slug/UUID en servidor

### Health Endpoints Protegidos
- ✅ `/api/health`: Público (solo estado general)
- ✅ `/api/health/db`, `/payments`, `/cron`, `/webhooks`: Protegidos con `INTERNAL_HEALTH_KEY` o Platform Admin

### Dev Login Endurecido
- ✅ Verificación estricta: `NODE_ENV === 'development'`
- ✅ Bloqueo doble para producción
- ✅ Logging de intentos en producción

### Naming y Estándares
- ✅ Portal público: `/r/[slug]` (slug legible, no UUID)
- ✅ Permisos documentados explícitamente por rol en `/panel/*`

---

**Última actualización**: 2024-11-13 (v2.0 - Refinado con mejoras de seguridad)


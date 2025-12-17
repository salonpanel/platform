# 📊 Informe Completo: Estructura de Enlaces y Routing - PIA Platform

**Fecha de Análisis**: 2024-12-19  
**Versión de la Plataforma**: Actual  
**Framework**: Next.js 14+ (App Router)

---

## 📋 Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura de Routing](#arquitectura-de-routing)
3. [Estructura de Directorios](#estructura-de-directorios)
4. [Jerarquía de Enlaces](#jerarquía-de-enlaces)
5. [Sistema de Protección de Rutas](#sistema-de-protección-de-rutas)
6. [Rutas Dinámicas](#rutas-dinámicas)
7. [API Routes](#api-routes)
8. [Flujos de Navegación](#flujos-de-navegación)
9. [Componentes de Navegación](#componentes-de-navegación)
10. [Análisis de Duplicación](#análisis-de-duplicación)
11. [Recomendaciones](#recomendaciones)

---

## 🎯 Resumen Ejecutivo

La plataforma PIA utiliza **Next.js App Router** con una estructura de routing basada en el sistema de archivos. La aplicación está organizada en tres áreas principales:

- **Páginas Públicas**: Accesibles sin autenticación
- **Panel de Barbería (`/panel`)**: Requiere autenticación y membership en un tenant
- **Panel de Administración (`/admin`)**: Requiere autenticación + rol de Platform Admin

**Total de Rutas Identificadas**:
- **Páginas Públicas**: 3 rutas principales
- **Panel de Barbería**: 8+ rutas principales + subrutas
- **Panel de Administración**: 4 rutas principales
- **API Routes**: 35+ endpoints
- **Rutas de Autenticación**: 3 rutas internas

---

## 🏗️ Arquitectura de Routing

### Framework y Configuración

- **Framework**: Next.js 14+ con App Router
- **Sistema de Routing**: Basado en estructura de archivos (File-based routing)
- **Middleware**: `middleware.ts` en la raíz del proyecto
- **Layouts**: Layouts anidados para `/panel` y `/admin`

### Estructura Dual Detectada

⚠️ **IMPORTANTE**: Se detectó una estructura dual de directorios:

1. **`app/`** (raíz): Contiene algunas rutas y API routes
2. **`src/app/`**: Contiene la mayoría de las páginas activas del panel y admin

**Estado Actual**: Parece que `src/app/` es la estructura principal activa, pero hay duplicación que requiere revisión.

---

## 📁 Estructura de Directorios

### Directorio Principal: `src/app/`

```
src/app/
├── layout.tsx                    # Layout raíz de la aplicación
├── page.tsx                       # Página de inicio (/)
├── globals.css                    # Estilos globales
├── supabase-provider.tsx         # Provider de Supabase
│
├── login/
│   └── page.tsx                   # /login
│
├── logout/
│   └── page.tsx                   # /logout
│
├── auth/
│   └── callback/
│       └── route.ts              # /auth/callback (API route)
│
├── panel/                         # Panel de Barbería
│   ├── layout.tsx                # Layout del panel (sidebar, topbar)
│   ├── page.tsx                  # /panel (Dashboard)
│   │
│   ├── agenda/
│   │   └── page.tsx              # /panel/agenda
│   │
│   ├── clientes/
│   │   ├── page.tsx              # /panel/clientes
│   │   └── [id]/
│   │       └── page.tsx         # /panel/clientes/[id]
│   │
│   ├── servicios/
│   │   ├── page.tsx              # /panel/servicios
│   │   └── components/           # Componentes específicos
│   │
│   ├── staff/
│   │   └── page.tsx              # /panel/staff
│   │
│   ├── ajustes/
│   │   └── page.tsx              # /panel/ajustes
│   │
│   └── config/
│       └── payments/
│           └── page.tsx          # /panel/config/payments
│
└── admin/                         # Panel de Administración
    ├── page.tsx                  # /admin
    ├── new-tenant/
    │   └── page.tsx              # /admin/new-tenant
    ├── [orgId]/
    │   └── page.tsx              # /admin/[orgId]
    └── platform-users/
        └── page.tsx              # /admin/platform-users
```

### Directorio Secundario: `app/`

```
app/
├── layout.tsx                     # Layout raíz alternativo
├── page.tsx                       # Página de inicio alternativa
│
├── login/
│   └── page.tsx                   # /login (duplicado)
│
├── auth/
│   ├── callback/
│   │   └── route.ts              # /auth/callback
│   ├── magic-link/
│   │   └── route.ts              # /auth/magic-link
│   └── magic-link-handler/
│       └── page.tsx              # /auth/magic-link-handler
│
├── panel/                         # Panel (estructura alternativa)
│   ├── layout.tsx                # Layout alternativo
│   ├── page.tsx                  # /panel
│   ├── agenda/
│   │   ├── page.tsx
│   │   ├── page-old.tsx
│   │   └── page-refactored.tsx
│   ├── clientes/
│   │   ├── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   ├── servicios/
│   │   └── page.tsx
│   ├── staff/
│   │   └── page.tsx
│   ├── chat/
│   │   └── page.tsx              # /panel/chat
│   ├── marketing/
│   │   └── page.tsx              # /panel/marketing
│   ├── ajustes/
│   │   ├── page.tsx
│   │   ├── calendario/
│   │   │   └── page.tsx          # /panel/ajustes/calendario
│   │   └── no-show/
│   │       └── page.tsx          # /panel/ajustes/no-show
│   └── config/
│       └── payments/
│           └── page.tsx
│
├── r/                             # Portal Público de Reservas
│   └── [orgId]/
│       ├── page.tsx              # /r/[orgId]
│       └── ReserveClient.tsx
│
├── legal/
│   └── privacidad/
│       └── page.tsx              # /legal/privacidad
│
└── api/                           # API Routes (ver sección API Routes)
```

---

## 🔗 Jerarquía de Enlaces

### 1. Páginas Públicas (Sin Autenticación)

| Ruta | Archivo | Propósito | Estado |
|------|---------|-----------|--------|
| `/` | `src/app/page.tsx` o `app/page.tsx` | Landing page / Página de inicio | ✅ Activo |
| `/login` | `src/app/login/page.tsx` | Página de login (Magic Link) | ✅ Activo |
| `/r/[orgId]` | `app/r/[orgId]/page.tsx` | Portal público de reservas | ✅ Activo |
| `/legal/privacidad` | `app/legal/privacidad/page.tsx` | Política de privacidad | ✅ Activo |

**Características**:
- No requieren autenticación
- Accesibles desde cualquier navegador
- El portal `/r/[orgId]` acepta slug legible o UUID del tenant

---

### 2. Panel de Barbería (`/panel/*`)

**Layout Base**: `src/app/panel/layout.tsx` o `app/panel/layout.tsx`

Este layout incluye:
- Sidebar de navegación (`SidebarNav`)
- TopBar con información del tenant
- Banner de impersonación (si está activo)
- Sistema de permisos basado en roles

#### Rutas Principales del Panel

| Ruta | Archivo Principal | Propósito | Roles Lectura | Roles Escritura |
|------|-------------------|-----------|---------------|-----------------|
| `/panel` | `src/app/panel/page.tsx` | Dashboard principal | Todos | Solo lectura |
| `/panel/agenda` | `src/app/panel/agenda/page.tsx` | Vista de agenda diaria | Todos | owner/admin/manager |
| `/panel/clientes` | `src/app/panel/clientes/page.tsx` | Gestión de clientes (CRUD) | Todos | owner/admin/manager |
| `/panel/servicios` | `src/app/panel/servicios/page.tsx` | Gestión de servicios (CRUD) | Todos | owner/admin/manager |
| `/panel/staff` | `src/app/panel/staff/page.tsx` | Gestión de staff (CRUD) | Todos | owner/admin |
| `/panel/chat` | `app/panel/chat/page.tsx` | Sistema de chat interno | Todos | Todos |
| `/panel/ajustes` | `src/app/panel/ajustes/page.tsx` | Configuración del tenant | Todos | owner/admin |
| `/panel/config/payments` | `src/app/panel/config/payments/page.tsx` | Configuración de pagos Stripe | Todos | owner/admin |

#### Subrutas del Panel

| Ruta | Archivo | Propósito |
|------|---------|-----------|
| `/panel/clientes/[id]` | `src/app/panel/clientes/[id]/page.tsx` | Detalle de cliente |
| `/panel/ajustes/calendario` | `app/panel/ajustes/calendario/page.tsx` | Configuración de calendario |
| `/panel/ajustes/no-show` | `app/panel/ajustes/no-show/page.tsx` | Configuración de no-show |

#### Navegación del Panel

Los enlaces del panel están definidos en el componente `SidebarNav`:

```typescript
const navItems = [
  { href: "/panel", label: "Dashboard", icon: LayoutDashboard },
  { href: "/panel/agenda", label: "Agenda", icon: Calendar },
  { href: "/panel/clientes", label: "Clientes", icon: Users },
  { href: "/panel/servicios", label: "Servicios", icon: Scissors },
  { href: "/panel/staff", label: "Staff", icon: User },
  { href: "/panel/chat", label: "Chats", icon: MessageSquare },
  { href: "/panel/ajustes", label: "Ajustes", icon: Settings },
];
```

**Filtrado por Roles**:
- `/panel/staff` y `/panel/ajustes` solo visibles para `owner` y `admin`
- El resto de rutas son visibles para todos los usuarios del tenant

---

### 3. Panel de Administración (`/admin/*`)

**Protección**: Middleware verifica sesión + rol Platform Admin

#### Rutas del Admin

| Ruta | Archivo | Propósito | Permisos |
|------|---------|-----------|----------|
| `/admin` | `src/app/admin/page.tsx` | Lista de todos los tenants | Platform Admin |
| `/admin/new-tenant` | `src/app/admin/new-tenant/page.tsx` | Wizard de creación de tenant | Platform Admin (admin/support) |
| `/admin/[orgId]` | `src/app/admin/[orgId]/page.tsx` | Vista detallada de tenant | Platform Admin |
| `/admin/platform-users` | `src/app/admin/platform-users/page.tsx` | Gestión de platform users | Platform Admin |

**Características**:
- Todas requieren autenticación + verificación de Platform Admin
- El middleware redirige a `/login?error=unauthorized` si no se cumple
- Permite impersonación de tenants desde `/admin/[orgId]`

---

### 4. Rutas de Autenticación (Internas)

| Ruta | Archivo | Propósito | Tipo |
|------|---------|-----------|------|
| `/auth/callback` | `app/auth/callback/route.ts` | Callback de Supabase | API Route |
| `/auth/magic-link` | `app/auth/magic-link/route.ts` | Envío de magic link | API Route |
| `/auth/magic-link-handler` | `app/auth/magic-link-handler/page.tsx` | Handler cliente para magic links | Página |
| `/logout` | `src/app/logout/page.tsx` | Cerrar sesión | Página |

**Flujo de Autenticación**:
```
/login → Magic Link → /auth/magic-link-handler → /panel
```

---

## 🛡️ Sistema de Protección de Rutas

### Middleware (`middleware.ts`)

El middleware protege las rutas en tiempo de ejecución:

```typescript
export const config = { 
  matcher: ["/panel/:path*", "/admin/:path*"] 
};
```

#### Protección de `/panel/*`

**Requisitos**:
- Sesión autenticada de Supabase
- Membership válido en un tenant (verificado en el layout)

**Comportamiento**:
- Si no hay sesión → Redirige a `/login?redirect=[ruta]`
- Si hay sesión pero no membership → Muestra error en el layout
- Si hay sesión y membership → Permite acceso

#### Protección de `/admin/*`

**Requisitos**:
- Sesión autenticada de Supabase
- Rol de Platform Admin (verificado con RPC `check_platform_admin`)

**Comportamiento**:
- Si no hay sesión → Redirige a `/login?redirect=[ruta]`
- Si hay sesión pero no es Platform Admin → Redirige a `/login?error=unauthorized`
- Si cumple requisitos → Permite acceso

### Protección en Layouts

Además del middleware, los layouts realizan verificaciones adicionales:

**`src/app/panel/layout.tsx`**:
- Verifica sesión de usuario
- Carga membership del usuario
- Carga información del tenant
- Maneja impersonación (si `?impersonate=[orgId]` está presente)
- Filtra navegación según roles

**Estados del Layout**:
- `loading`: Cargando datos del tenant
- `UNAUTHENTICATED`: No hay sesión → Redirige a login
- `NO_MEMBERSHIP`: No tiene membership → Muestra mensaje
- `ERROR`: Error al cargar → Muestra error
- `OK`: Todo correcto → Renderiza contenido

---

## 🔄 Rutas Dinámicas

### 1. Portal Público: `/r/[orgId]`

**Archivo**: `app/r/[orgId]/page.tsx`

**Parámetro**: `orgId` (puede ser slug legible o UUID)

**Resolución**:
- El servidor resuelve el `orgId` a `tenant_id` real
- No se confía en el valor del cliente
- Soporta tanto slug (`banana-barbers`) como UUID

**Uso**:
- Portal público donde los clientes hacen reservas
- No requiere autenticación
- Muestra servicios disponibles del tenant

### 2. Admin Tenant: `/admin/[orgId]`

**Archivo**: `src/app/admin/[orgId]/page.tsx`

**Parámetro**: `orgId` (UUID del tenant)

**Funcionalidades**:
- Vista detallada del tenant
- Cambio de plan
- Gestión de features
- Cambio de timezone
- Métricas diarias
- Impersonación

### 3. Cliente Detalle: `/panel/clientes/[id]`

**Archivo**: `src/app/panel/clientes/[id]/page.tsx`

**Parámetro**: `id` (UUID del cliente)

**Funcionalidades**:
- Detalle completo del cliente
- Historial de reservas
- Información de contacto

---

## 🔌 API Routes

### Estructura de API Routes

Todas las API routes están en `app/api/` (no en `src/app/api/`)

### Categorías de API Routes

#### 1. Admin API (`/api/admin/*`)

| Endpoint | Método | Propósito | Protección |
|----------|--------|-----------|------------|
| `/api/admin/tenants` | GET | Lista todos los tenants | Platform Admin |
| `/api/admin/tenants` | POST | Crea nuevo tenant | Platform Admin (admin/support) |
| `/api/admin/tenants/[orgId]` | GET | Detalles de tenant | Platform Admin |
| `/api/admin/tenants/[orgId]/plan` | PUT | Cambia plan | Platform Admin (admin/support) |
| `/api/admin/tenants/[orgId]/features` | GET | Obtiene features | Platform Admin |
| `/api/admin/tenants/[orgId]/features` | PUT | Actualiza features | Platform Admin (admin/support) |
| `/api/admin/tenants/[orgId]/timezone` | PUT | Actualiza timezone | Platform Admin (admin/support) |
| `/api/admin/tenants/[orgId]/impersonate` | POST | Inicia impersonación | Platform Admin (admin/support) |
| `/api/admin/tenants/[orgId]/impersonate` | DELETE | Termina impersonación | Platform Admin (admin/support) |
| `/api/admin/plans` | GET | Lista planes | Platform Admin |
| `/api/admin/features` | GET | Lista features | Platform Admin |
| `/api/admin/platform-users` | GET | Lista platform users | Platform Admin |
| `/api/admin/platform-users` | POST | Crea platform user | Platform Admin (admin) |

#### 2. Panel API (`/api/*`)

| Endpoint | Método | Propósito | Protección |
|----------|--------|-----------|------------|
| `/api/services` | POST | Crea servicio | Usuario tenant (owner/admin/manager) |
| `/api/services/[id]` | PATCH | Actualiza servicio | Usuario tenant (owner/admin/manager) |
| `/api/services/[id]/sync` | POST | Sincroniza con Stripe | Usuario tenant (owner/admin) |
| `/api/services/migrate` | POST | Migración de servicios | Usuario tenant |
| `/api/payments/services/sync` | POST | Sincroniza servicio con Stripe | Usuario tenant (owner/admin) |
| `/api/panel/customers/export` | GET | Exporta clientes | Usuario tenant |
| `/api/tenants/[tenantId]/timezone` | PUT | Actualiza timezone | Usuario tenant (owner/admin) |

#### 3. Checkout API (`/api/checkout/*`)

| Endpoint | Método | Propósito | Protección |
|----------|--------|-----------|------------|
| `/api/checkout/intent` | POST | Crea payment intent | Público (rate limit) |
| `/api/checkout/confirm` | POST | Confirma pago | Público (rate limit) |
| `/api/checkout` | GET/POST | Endpoint genérico | Público |

**Seguridad**:
- Rate limiting: 50 req/10min por IP (Upstash)
- `tenant_id` se deriva de `service_id` o `payment_intent_id`, nunca del cliente
- Validaciones estrictas en servidor

#### 4. Reservations API (`/api/reservations/*`)

| Endpoint | Método | Propósito | Protección |
|----------|--------|-----------|------------|
| `/api/reservations/hold` | POST | Crea hold temporal | Público (rate limit + reCAPTCHA) |

**Seguridad**:
- Rate limiting: 50 req/10min por IP
- reCAPTCHA opcional (preparado)
- Validaciones estrictas

#### 5. Availability API (`/api/availability/*`)

| Endpoint | Método | Propósito | Protección |
|----------|--------|-----------|------------|
| `/api/availability` | GET | Obtiene slots disponibles | Público (rate limit) |
| `/api/availability/combined` | GET | Disponibilidad combinada | Público (rate limit) |

**Seguridad**:
- Rate limiting: 100 req/10min por IP
- `tenant_id` resuelto desde slug/UUID en servidor

#### 6. Health API (`/api/health/*`)

| Endpoint | Método | Propósito | Protección |
|----------|--------|-----------|------------|
| `/api/health` | GET | Health check general | Público (solo estado) |
| `/api/health/db` | GET | Health check DB | `INTERNAL_HEALTH_KEY` o Platform Admin |
| `/api/health/payments` | GET | Health check Stripe | `INTERNAL_HEALTH_KEY` o Platform Admin |
| `/api/health/cron` | GET | Health check cron | `INTERNAL_HEALTH_KEY` o Platform Admin |
| `/api/health/webhooks` | GET | Health check webhooks | `INTERNAL_HEALTH_KEY` o Platform Admin |

#### 7. Internal API (`/api/internal/*`)

| Endpoint | Método | Propósito | Protección |
|----------|--------|-----------|------------|
| `/api/internal/cron/release-holds` | POST | Libera holds expirados | `INTERNAL_CRON_KEY` |
| `/api/internal/cron/calculate-metrics` | POST | Calcula métricas diarias | `INTERNAL_CRON_KEY` |

#### 8. Webhooks API (`/api/webhooks/*`)

| Endpoint | Método | Propósito | Protección |
|----------|--------|-----------|------------|
| `/api/webhooks/stripe` | POST | Webhook de Stripe | Stripe signature |

#### 9. Auth API (`/api/auth/*`)

| Endpoint | Método | Propósito | Protección |
|----------|--------|-----------|------------|
| `/api/auth/dev-login` | POST | Auto-login desarrollo | ⚠️ SOLO DESARROLLO |

**⚠️ CRÍTICO**: Solo funciona en `NODE_ENV === 'development'`

#### 10. Logout API (`/api/logout`)

| Endpoint | Método | Propósito | Protección |
|----------|--------|-----------|------------|
| `/api/logout` | POST | Cierra sesión | Cualquier usuario autenticado |

---

## 🔄 Flujos de Navegación

### Flujo de Login

```
1. Usuario visita /login
2. Ingresa email
3. Sistema envía magic link (o auto-login en desarrollo)
4. Usuario hace clic en magic link
5. Redirige a /auth/magic-link-handler
6. Handler procesa tokens y establece sesión
7. Redirige a /panel (o URL en ?redirect=)
```

### Flujo de Impersonación

```
1. Platform Admin accede a /admin/[orgId]
2. Hace clic en "Impersonar"
3. Ingresa motivo (obligatorio)
4. Sistema crea registro en platform.impersonations
5. Redirige a /panel?impersonate=[orgId]
6. Layout detecta parámetro y carga tenant objetivo
7. Banner de impersonación visible
8. Admin puede terminar impersonación → /admin
```

### Flujo de Reserva Pública

```
1. Cliente visita /r/[slug]
2. Selecciona servicio, fecha, hora, staff
3. Sistema crea hold temporal (/api/reservations/hold)
4. Cliente ingresa datos de pago
5. Sistema crea payment intent (/api/checkout/intent)
6. Cliente completa pago en Stripe
7. Sistema confirma pago (/api/checkout/confirm)
8. Reserva confirmada
```

### Flujo de Creación de Tenant

```
1. Platform Admin accede a /admin
2. Hace clic en "Nueva Barbería"
3. Redirige a /admin/new-tenant
4. Wizard de 4 pasos:
   - Paso 1: Datos generales (nombre, slug, timezone)
   - Paso 2: Usuario owner (email, nombre)
   - Paso 3: Plan (opcional)
   - Paso 4: Confirmación
5. Sistema crea tenant, membership, plan
6. Envía magic link al owner
7. Redirige a /admin con mensaje de éxito
```

---

## 🧩 Componentes de Navegación

### 1. SidebarNav (`src/components/panel/SidebarNav.tsx`)

**Propósito**: Navegación lateral del panel

**Características**:
- Responsive (colapsable en móvil, expandible en desktop)
- Iconos dinámicos según ruta
- Indicador de ruta activa
- Filtrado por roles
- Auto-colapso opcional al hacer clic

**Enlaces Definidos**:
```typescript
const navItems = [
  { href: "/panel", label: "Dashboard", icon: LayoutDashboard },
  { href: "/panel/agenda", label: "Agenda", icon: Calendar },
  { href: "/panel/clientes", label: "Clientes", icon: Users },
  { href: "/panel/servicios", label: "Servicios", icon: Scissors },
  { href: "/panel/staff", label: "Staff", icon: User },
  { href: "/panel/chat", label: "Chats", icon: MessageSquare },
  { href: "/panel/ajustes", label: "Ajustes", icon: Settings },
];
```

### 2. TopBar (`src/components/panel/TopBar.tsx`)

**Propósito**: Barra superior del panel

**Información Mostrada**:
- Título de la página actual
- Nombre del tenant
- Rol del usuario
- Timezone del tenant
- Botón de menú (móvil)

### 3. ImpersonationBanner (`src/components/panel/ImpersonationBanner.tsx`)

**Propósito**: Banner visible durante impersonación

**Funcionalidades**:
- Muestra mensaje de impersonación
- Botón para terminar impersonación
- Visible solo para Platform Admins

---

## ⚠️ Análisis de Duplicación

### Duplicación Detectada

Se identificó duplicación entre `app/` y `src/app/`:

#### Páginas Duplicadas

| Ruta | `app/` | `src/app/` | Estado |
|------|--------|------------|--------|
| `/` | ✅ `app/page.tsx` | ✅ `src/app/page.tsx` | ⚠️ Duplicado |
| `/login` | ✅ `app/login/page.tsx` | ✅ `src/app/login/page.tsx` | ⚠️ Duplicado |
| `/panel` | ✅ `app/panel/page.tsx` | ✅ `src/app/panel/page.tsx` | ⚠️ Duplicado |
| `/panel/layout.tsx` | ✅ `app/panel/layout.tsx` | ✅ `src/app/panel/layout.tsx` | ⚠️ Duplicado |
| `/panel/agenda` | ✅ `app/panel/agenda/page.tsx` | ✅ `src/app/panel/agenda/page.tsx` | ⚠️ Duplicado |
| `/panel/clientes` | ✅ `app/panel/clientes/page.tsx` | ✅ `src/app/panel/clientes/page.tsx` | ⚠️ Duplicado |
| `/panel/servicios` | ✅ `app/panel/servicios/page.tsx` | ✅ `src/app/panel/servicios/page.tsx` | ⚠️ Duplicado |
| `/panel/staff` | ✅ `app/panel/staff/page.tsx` | ✅ `src/app/panel/staff/page.tsx` | ⚠️ Duplicado |
| `/panel/ajustes` | ✅ `app/panel/ajustes/page.tsx` | ✅ `src/app/panel/ajustes/page.tsx` | ⚠️ Duplicado |
| `/panel/config/payments` | ✅ `app/panel/config/payments/page.tsx` | ✅ `src/app/panel/config/payments/page.tsx` | ⚠️ Duplicado |

#### Rutas Únicas en `app/`

| Ruta | Archivo | Nota |
|------|---------|------|
| `/panel/chat` | `app/panel/chat/page.tsx` | No existe en `src/app/` |
| `/panel/marketing` | `app/panel/marketing/page.tsx` | No existe en `src/app/` |
| `/panel/ajustes/calendario` | `app/panel/ajustes/calendario/page.tsx` | No existe en `src/app/` |
| `/panel/ajustes/no-show` | `app/panel/ajustes/no-show/page.tsx` | No existe en `src/app/` |
| `/r/[orgId]` | `app/r/[orgId]/page.tsx` | Portal público |
| `/legal/privacidad` | `app/legal/privacidad/page.tsx` | Página legal |
| `/auth/magic-link-handler` | `app/auth/magic-link-handler/page.tsx` | Handler de magic link |

#### API Routes

Todas las API routes están en `app/api/` (no hay duplicación en `src/app/api/`)

### Impacto de la Duplicación

1. **Confusión**: No está claro cuál estructura es la activa
2. **Mantenimiento**: Cambios deben hacerse en ambos lugares o se pierden
3. **Riesgo**: Next.js podría estar usando una u otra estructura de forma inconsistente
4. **Tamaño**: Duplicación innecesaria de código

### Recomendación Inmediata

⚠️ **URGENTE**: Determinar cuál estructura es la activa y consolidar:

1. Si `src/app/` es la activa:
   - Mover rutas únicas de `app/` a `src/app/`
   - Eliminar duplicados de `app/`
   - Mantener `app/api/` (API routes)

2. Si `app/` es la activa:
   - Mover mejoras de `src/app/` a `app/`
   - Eliminar `src/app/`
   - Consolidar todo en `app/`

---

## 📊 Resumen de Rutas por Categoría

### Páginas Públicas
- Total: **4 rutas**
- Sin autenticación
- Accesibles desde cualquier navegador

### Panel de Barbería
- Total: **8+ rutas principales** + subrutas
- Requiere autenticación + membership
- Protegido por middleware + layout

### Panel de Administración
- Total: **4 rutas principales**
- Requiere autenticación + Platform Admin
- Protegido por middleware

### API Routes
- Total: **35+ endpoints**
- Organizados por funcionalidad
- Protección variada (público, autenticado, keys internas)

### Rutas de Autenticación
- Total: **4 rutas**
- Internas (redirects automáticos)

---

## 🎯 Recomendaciones

### 1. Consolidación de Estructura (PRIORIDAD ALTA)

**Problema**: Duplicación entre `app/` y `src/app/`

**Acción**:
- Determinar estructura activa
- Consolidar en una sola ubicación
- Eliminar duplicados
- Documentar decisión

### 2. Documentación de Rutas

**Acción**:
- Mantener este informe actualizado
- Documentar nuevas rutas al crearlas
- Incluir diagramas de flujo

### 3. Validación de Rutas

**Acción**:
- Crear tests de routing
- Validar que todas las rutas funcionan
- Verificar protección de rutas

### 4. Optimización de Navegación

**Acción**:
- Revisar estructura de navegación del panel
- Considerar agrupación lógica
- Mejorar UX de navegación

### 5. Seguridad

**Acción**:
- Revisar protección de todas las rutas
- Validar rate limiting en endpoints públicos
- Auditar permisos por rol

---

## 📝 Notas Técnicas

### Next.js App Router

- Las rutas se definen por estructura de archivos
- `page.tsx` = ruta accesible
- `layout.tsx` = layout compartido
- `route.ts` = API endpoint
- `[param]` = ruta dinámica

### Middleware

- Se ejecuta antes de renderizar
- Puede redirigir o modificar request
- Solo se ejecuta en rutas matching el matcher

### Layouts Anidados

- Layouts se anidan automáticamente
- `/panel/layout.tsx` envuelve todas las rutas `/panel/*`
- Layout raíz envuelve toda la aplicación

---

## 🔍 Archivos Clave para Revisión

1. **`middleware.ts`**: Protección de rutas
2. **`src/app/panel/layout.tsx`**: Layout del panel
3. **`src/components/panel/SidebarNav.tsx`**: Navegación del panel
4. **`app/r/[orgId]/page.tsx`**: Portal público
5. **`src/app/admin/[orgId]/page.tsx`**: Admin de tenant

---

---

## 🧪 Pruebas Locales Recomendadas (sin DNS real)

Para probar la arquitectura multi-dominio en local sin necesidad de configurar DNS real, puedes usar el archivo `hosts` del sistema operativo para simular los subdominios.

### Configuración del archivo hosts

Añade estas líneas a tu archivo `hosts` (ubicación según SO):

**Windows**: `C:\Windows\System32\drivers\etc\hosts`  
**macOS/Linux**: `/etc/hosts`

```
127.0.0.1  pro.bookfast.local
127.0.0.1  admin.bookfast.local
127.0.0.1  barberstudio.bookfast.local
```

**Nota**: Si usas `localtest.me`, no necesitas modificar el archivo hosts. Puedes acceder directamente a:
- `http://pro.bookfast.es.localtest.me:3000`
- `http://admin.bookfast.es.localtest.me:3000`
- `http://barberstudio.bookfast.es.localtest.me:3000`

### Escenarios de Prueba

#### 1. localhost:3000 (Desarrollo por defecto)

| Ruta | Comportamiento Esperado |
|------|------------------------|
| `http://localhost:3000/login` | Muestra página de login |
| `http://localhost:3000/panel` | Requiere autenticación, redirige a `/login` si no hay sesión |
| `http://localhost:3000/admin` | Requiere autenticación + Platform Admin, redirige a `/login` si no cumple |
| `http://localhost:3000/r/[orgId]` | Muestra portal público de reservas (si el tenant existe) |

#### 2. pro.bookfast.local (o pro.bookfast.es.localtest.me:3000)

| Ruta | Comportamiento Esperado |
|------|------------------------|
| `http://pro.bookfast.local/` | → Redirige 302 a `/panel` |
| `http://pro.bookfast.local/panel` | Muestra panel (requiere autenticación) |
| `http://pro.bookfast.local/panel/agenda` | Muestra agenda del tenant |
| `http://pro.bookfast.local/admin` | → Redirige 301 a `https://admin.bookfast.es/admin` |
| `http://pro.bookfast.local/r/[orgId]` | → Redirige a `https://bookfast.es` |

#### 3. admin.bookfast.local (o admin.bookfast.es.localtest.me:3000)

| Ruta | Comportamiento Esperado |
|------|------------------------|
| `http://admin.bookfast.local/` | → Redirige 302 a `/admin` |
| `http://admin.bookfast.local/admin` | Muestra consola admin (requiere Platform Admin) |
| `http://admin.bookfast.local/admin/[orgId]` | Muestra detalles del tenant |
| `http://admin.bookfast.local/panel` | → Redirige 301 a `https://pro.bookfast.es/panel` |
| `http://admin.bookfast.local/r/[orgId]` | → Redirige a `https://bookfast.es` |

#### 4. barberstudio.bookfast.local (o barberstudio.bookfast.es.localtest.me:3000)

**Prerequisito**: Debe existir un tenant con `slug = "barberstudio"` en la base de datos.

| Ruta | Comportamiento Esperado |
|------|------------------------|
| `http://barberstudio.bookfast.local/` | → Rewrite interno a `/r/[tenant.id]` (muestra portal de reservas) |
| `http://barberstudio.bookfast.local/panel` | → Redirige 301 a `https://pro.bookfast.es/panel` |
| `http://barberstudio.bookfast.local/admin` | → Redirige 301 a `https://admin.bookfast.es/admin` |

#### 5. Subdominio Inexistente

| Host | Comportamiento Esperado |
|------|------------------------|
| `http://invalido.bookfast.local/` | → Redirige a `http://localhost:3000?reason=unknown-tenant` (en desarrollo) o `https://bookfast.es?reason=unknown-tenant` (producción) |
| `http://api.bookfast.local/` | → Redirige a marketing (subdominio reservado) |

#### 6. Normalización de Protocolo y Host (Solo en Producción)

En producción (`NODE_ENV === "production"`):

| Request | Comportamiento Esperado |
|---------|------------------------|
| `http://bookfast.es/` | → Redirige 301 a `https://bookfast.es/` |
| `http://www.bookfast.es/` | → Redirige 301 a `https://bookfast.es/` |
| `https://www.bookfast.es/` | → Redirige 301 a `https://bookfast.es/` |
| `https://bookfast.es/panel` | → Redirige 301 a `https://pro.bookfast.es/panel` |
| `https://bookfast.es/admin` | → Redirige 301 a `https://admin.bookfast.es/admin` |

### Checklist de Validación

Antes de considerar las pruebas completas, verifica:

- [ ] `localhost:3000` funciona para todas las rutas básicas
- [ ] `pro.bookfast.local` redirige `/` a `/panel`
- [ ] `admin.bookfast.local` redirige `/` a `/admin`
- [ ] `barberstudio.bookfast.local` hace rewrite a `/r/[tenant.id]`
- [ ] Subdominio inexistente redirige a marketing con query param
- [ ] Subdominio reservado (ej: `api`) redirige a marketing
- [ ] Rutas cruzadas (`/panel` en admin, `/admin` en pro) redirigen correctamente
- [ ] APIs internas bloqueadas desde dominios de tenant (403)
- [ ] Autenticación funciona en todos los contextos
- [ ] Portal público muestra 404 elegante cuando tenant no existe

### Herramientas Útiles

- **curl**: Para probar redirecciones sin navegador
  ```bash
  curl -I http://pro.bookfast.local/
  # Debería mostrar: Location: /panel
  ```

- **DevTools Network Tab**: Para ver redirecciones y rewrites en el navegador

- **localtest.me**: Alternativa a modificar hosts (ya configurado en el código)

---

**Última actualización**: 2024-12-19  
**Versión del Informe**: 2.0 (Fase 2 - Endurecimiento completado)  
**Autor**: Análisis Automatizado de Código


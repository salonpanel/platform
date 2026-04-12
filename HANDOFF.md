# BookFast Pro - Contexto del Proyecto

## Que es BookFast Pro

BookFast Pro es una plataforma SaaS multi-tenant de gestion de reservas para salones de belleza, barberias y centros de estetica. Permite a los negocios gestionar citas, clientes, pagos, staff y marketing desde un panel centralizado.

## Arquitectura - 3 Repos, 1 Supabase

El proyecto tiene 3 repositorios separados, todos desplegados en Vercel con auto-deploy en push a `main`:

### 1. Platform (PRIORIDAD MAXIMA)
- **Repo GitHub:** `salonpanel/platform`
- **Vercel project:** `prj_vG0zOFljwtJZk51pW2mL6akd367M` (team: `team_dtECUOcwxhIcvVVBeGdH57nl`)
- **Stack:** Next.js 16.0.8 + React 19 + Turbopack + Tailwind 4
- **Es:** El panel de gestion que usan los salones (el producto core)
- **URL:** pro.bookfast.pro
- **Carpeta:** `/mnt/platform`

### 2. Admin
- **Repo GitHub:** `piademo/admin`
- **Vercel project:** mismo team de Vercel
- **Stack:** Next.js 16.0.4 + React 19 + Turbopack
- **Es:** Panel interno de administracion de la plataforma (gestion de tenants, soporte, reports)
- **Carpeta:** `/mnt/admin`
- **Estado actual:** Build en Vercel roto por errores TypeScript de tipos `never` en queries Supabase. Se estan aplicando casts `as any` para desbloquear. Hay un fix pendiente en `src/types/supabase.ts` (cambiar `Record<string, unknown>` a `any` en los catch-all) que deberia resolver todos los errores de golpe. Prioridad baja ahora.

### 3. Marketing
- **Repo GitHub:** en Vercel tambien
- **Stack:** Next.js 15 + Framer Motion + next-intl
- **Es:** Web publica de marketing (landing, pricing, blog, paginas por sector)
- **Carpeta:** `/mnt/marketing`
- **Estado:** Estructura completa, necesita contenido y pulido. Prioridad baja.

### Base de datos compartida
- **Supabase** con PostgreSQL + RLS
- Las 3 apps comparten la misma instancia de Supabase
- Schemas: `public` (datos de negocio), `app` (funciones helper), `platform` (admin)
- Extensions: pg_cron, pg_trgm, pgcrypto, uuid-ossp, btree_gist
- Migraciones en `/mnt/platform/supabase/migrations/`

## Stack tecnico detallado de Platform

- **Framework:** Next.js 16.0.8 (App Router, Server Components)
- **Auth:** Supabase Auth con magic links (OTP por email)
- **DB:** Supabase con RLS por tenant_id
- **Pagos:** Stripe (checkout, webhooks, idempotency)
- **Email:** Resend
- **Rate limiting:** Upstash Redis
- **Validacion:** Zod
- **UI:** Tailwind 4 + componentes Glass (glassmorphism) + Framer Motion
- **Multi-tenancy:** Basado en subdominios + tenant_id en RLS

## Estructura de Platform

```
app/
  api/                    # Route handlers
    auth/                 # Login OTP
    availability/         # Slots disponibles
    checkout/             # Stripe checkout
    payments/             # Procesamiento pagos
    reservations/         # CRUD reservas
    services/             # CRUD servicios
    staff/                # CRUD staff
    webhooks/             # Stripe webhooks
    panel/                # APIs internas del panel
      marketing/          # Campanas email
  panel/                  # Paginas del panel de gestion
    agenda/               # Calendario de citas
    clientes/             # Gestion de clientes
    servicios/            # Configuracion servicios
    staff/                # Gestion de empleados
    chat/                 # Chat de equipo
    monedero/             # Wallet/pagos
    marketing/            # Campanas de email
    ajustes/              # Settings (calendario, no-shows)
    config/payments/      # Config de pagos Stripe
    pagos/                # Gestion de pagos
  admin/                  # Admin de plataforma
    new-tenant/           # Wizard crear tenant
    platform-users/       # Gestion usuarios plataforma
  login/                  # Login
  auth/                   # Callbacks auth

src/
  lib/
    supabase/             # Clientes Supabase (browser, server, admin)
    availability/         # Logica de slots
    booking-conflicts.ts  # Deteccion conflictos
    booking-status-transitions.ts  # Maquina de estados
    agenda-data.ts        # Fetch datos calendario
    permissions/          # RBAC (owner/admin/manager/staff)
    stripe-handlers/      # Handlers webhooks Stripe
    rate-limit.ts         # Rate limiting
  components/
    agenda/               # Grid calendario, slots, citas
    calendar/             # Modales reserva, busqueda
    customers/            # Lista clientes, filtros
    ui/glass/             # Design system glassmorphism
    panel/                # Nav, layout
  hooks/                  # Custom hooks (useAgendaData, useSession, etc.)
  modules/bookings/       # Modales crear/detalle reserva
  types/                  # TypeScript types
```

## Features implementadas en Platform

**Completas:**
- Login con magic link + multi-tenant
- Dashboard con metricas reales de Supabase
- Agenda (calendario con slots, conflictos, staff)
- Gestion de clientes (CRUD, busqueda, historial, notas)
- Servicios (CRUD, precios)
- Staff (CRUD, horarios)
- Wallet/Monedero (Stripe, transacciones, payouts)
- Marketing por email (campanas, templates, segmentacion)
- Chat de equipo
- Settings (calendario, no-shows)
- Pagos (Stripe checkout, webhooks)
- Admin: crear tenants, gestionar usuarios plataforma

**Incompletas / TODO:**
- Chat: falta paginacion/infinite scroll para mensajes antiguos
- Staff: flujo UI de horarios incompleto
- Timezone: hardcoded "Europe/Madrid" en BookingDetailModal, deberia venir del tenant
- Verificacion platform admin: stub en platform-admin.ts
- Sync precios Stripe desde panel config
- Portal publico de reservas (referenciado pero no completo)
- Colores por staff member

## Problema recurrente: TypeScript `never` types

El tipo `Database` generado para Supabase no tiene definiciones completas de relaciones ni de todas las tablas. Esto causa que queries como:

```typescript
const { data } = await supabase.from('bookings').select('*, customer:customers(name)')
```

Devuelvan `data` tipado como `never[]`, y acceder a `data[0].customer` da error en build.

**Fix aplicado:** Cast con `as any[]` en el return de funciones que hacen queries, o `(client.from('table') as any)` para .update()/.insert(). En admin se arreglo cambiando los catch-all en `src/types/supabase.ts` de `Record<string, unknown>` a `any`.

**Fix definitivo (pendiente):** Regenerar tipos con `supabase gen types typescript` para tener tipos completos.

## Vercel

- **Team:** `team_dtECUOcwxhIcvVVBeGdH57nl` (Book Fast)
- Los 3 repos hacen auto-deploy a Vercel en push a main
- Para ver builds: usar `list_deployments` y `get_deployment_build_logs` de las herramientas Vercel MCP
- Platform build: actualmente GREEN
- Admin build: actualmente con errores (fix pendiente de push)

## Supabase

- Tienes acceso a las herramientas MCP de Supabase para: ejecutar SQL, listar tablas, aplicar migraciones, crear branches, deploy edge functions, etc.
- La migration baseline esta en `/mnt/platform/supabase/migrations/0000_full_baseline.sql` (370KB)
- Tablas principales: tenants, memberships, profiles, services, staff, appointments, bookings, customers, transactions, marketing_campaigns

## Prioridades

1. **AHORA: Platform** - Acabar features incompletas, pulir UI, resolver TODOs
2. **DESPUES: Marketing** - Contenido, copy, SEO
3. **DESPUES: Admin** - Resolver builds, anadir features

## Notas importantes

- El usuario se llama Josep, habla en espanol (castellano)
- Los commits van a `main` directamente (no hay branches de feature)
- Desde el sandbox no se puede hacer git push (proxy bloqueado), Josep hace push desde su maquina local
- El flujo es: Claude edita archivos -> Josep hace git add/commit/push -> Vercel auto-deploy -> verificar build con herramientas Vercel MCP
- Cuidado con que los commits de Josep no sobreescriban los fixes aplicados aqui (ha pasado varias veces)

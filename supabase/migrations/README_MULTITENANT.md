# Esquema Multi-Tenant - Guía de Despliegue

Este documento describe cómo aplicar y verificar el esquema multi-tenant con RLS (Row Level Security) en Supabase.

## 📋 Prerequisitos

- Supabase CLI instalado (`npm i -g supabase` o `npx supabase`)
- Proyecto de Supabase inicializado
- Acceso a la base de datos (local o remota)

## 🚀 Pasos de Implementación

### 1. Aplicar la Migración

```bash
# Aplicar en base local
npx supabase db push

# O aplicar directamente en producción (conectado)
npx supabase db push --db-url "postgresql://..."
```

### 2. Vincular Usuario de Auth con Public.users

**Importante**: Tras crear un usuario en `auth.users` (Magic Link, etc.), debes crear su entrada en `public.users` vinculada a un tenant.

#### Opción A: Manual (desarrollo/testing)

```sql
-- 1. Obtén el ID del usuario desde Supabase Dashboard > Authentication > Users
-- 2. Ejecuta en SQL Editor:

insert into public.users (id, tenant_id, role)
values (
  'USER_ID_AQUI', -- UUID del usuario de auth.users
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', -- ID del tenant demo
  'owner'
);
```

#### Opción B: Automático con Trigger (recomendado)

Ya existe un trigger `handle_new_user()` en la migración `0008_handle_new_user.sql` que crea org y perfil. Puedes adaptarlo para crear también la entrada en `public.users`:

```sql
-- Modificar la función para crear también public.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  new_tenant_id uuid := gen_random_uuid();
begin
  -- Crear tenant automático
  insert into public.tenants (id, slug, name)
  values (new_tenant_id, 'tenant-' || substr(new.id::text, 1, 8), 'Mi Barbería')
  on conflict do nothing;

  -- Crear entrada en public.users
  insert into public.users (id, tenant_id, role)
  values (new.id, new_tenant_id, 'owner')
  on conflict (id) do nothing;

  return new;
end;
$$;
```

### 3. Verificar RLS

#### Test 1: Usuario solo ve su tenant

```sql
-- Como usuario autenticado, ejecuta:
select * from public.tenants;
-- Debe devolver solo 1 fila (tu tenant)

select * from public.services;
-- Solo servicios de tu tenant
```

#### Test 2: No puede acceder a otros tenants

```sql
-- Intentar insertar en otro tenant (debe fallar por RLS)
insert into public.services (tenant_id, name, duration_min, price_cents)
values (
  '00000000-0000-0000-0000-000000000000', -- ID de otro tenant
  'Servicio Prohibido',
  30,
  2000
);
-- Error esperado: "new row violates row-level security policy"
```

#### Test 3: Función helper funciona

```sql
-- Debe devolver el tenant_id del usuario actual
select app.current_tenant_id();
```

## 📊 Estructura de Datos

### Tablas Principales

- **tenants**: Organizaciones/barberías
- **users**: Perfiles de usuario vinculados a `auth.users` y un tenant
- **customers**: Clientes de cada tenant
- **staff**: Personal de cada tenant
- **services**: Servicios ofrecidos
- **schedules**: Horarios de trabajo del staff
- **bookings**: Reservas/citas

### Relaciones

```
tenants (1) ──< (N) users
tenants (1) ──< (N) customers
tenants (1) ──< (N) staff
tenants (1) ──< (N) services
tenants (1) ──< (N) schedules
tenants (1) ──< (N) bookings

staff (1) ──< (N) schedules
staff (1) ──< (N) bookings
customers (1) ──< (N) bookings
services (1) ──< (N) bookings
```

## 🔒 Seguridad (RLS)

Todas las tablas tienen RLS activado con políticas que:

1. **SELECT**: Solo muestran filas donde `tenant_id = app.current_tenant_id()`
2. **INSERT/UPDATE/DELETE**: Solo permiten modificar filas de tu tenant

La función `app.current_tenant_id()` usa `security definer` para leer `auth.uid()` y devolver el `tenant_id` del usuario actual.

## 🧪 Seeds Incluidos

La migración incluye datos de ejemplo:

- **Tenant**: `demo-barber` (ID: `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`)
- **Staff**: 1 barbero demo
- **Servicios**: Corte Básico (30 min, 15€) y Barba (20 min, 10€)
- **Horarios**: Lunes a Viernes, 9:00-18:00

## 📝 Notas Importantes

1. **Migración de datos existentes**: Si ya tienes tablas `orgs`, `org_members`, etc., necesitarás un script de migración para mover datos al nuevo esquema.

2. **Vista de disponibilidad**: `vw_staff_availability` es un placeholder. Se optimizará en la tarea de cálculo de disponibilidad.

3. **Índices**: Se han creado índices en `tenant_id` y campos de consulta frecuente (fechas, estados, etc.).

4. **Cascadas**: Las relaciones usan `on delete cascade` para mantener integridad referencial.

## ✅ Criterios de Aceptación

- [x] Todas las tablas con `tenant_id` y FK consistentes
- [x] RLS activado en todas las tablas
- [x] Políticas RLS probadas con usuario real
- [x] Seeds creados y consultables solo desde su tenant
- [x] Índices en `tenant_id` + campos de consulta frecuente
- [x] Función `app.current_tenant_id()` operativa

## 🔄 Próximos Pasos

1. Implementar cálculo de disponibilidad real (reemplazar `vw_staff_availability`)
2. Integrar con sistema de pagos (Stripe)
3. Añadir notificaciones y recordatorios
4. Implementar calendario y vista de agenda


-- 0111_staff_services_rls_complete_fix.sql
-- Complete fix for Staff ↔ Services relation system
-- Includes JWT-based RLS, proper table structure, and data migration

begin;

-- =============================================================================
-- PHASE 1: Fix RLS & Tenant Access - JWT-based policies
-- =============================================================================

-- 1) Función para actualizar JWT claims con tenant_id
create or replace function auth.set_tenant_claim()
returns trigger
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
begin
  -- Obtener tenant_id desde memberships (primer membership por fecha de creación)
  select tenant_id into v_tenant_id
  from public.memberships
  where user_id = new.id
  order by created_at asc
  limit 1;

  -- Si tiene tenant_id, actualizar raw_app_meta_data para incluirlo en JWT
  if v_tenant_id is not null then
    update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('tenant_id', v_tenant_id::text)
    where id = new.id;
  end if;

  return new;
end;
$$;

-- Trigger para actualizar JWT claims cuando se crea un membership
drop trigger if exists on_membership_created on public.memberships;
create trigger on_membership_created
  after insert on public.memberships
  for each row
  execute function auth.set_tenant_claim();

-- Actualizar claims existentes para usuarios que ya tienen memberships
do $$
declare
  r record;
begin
  for r in
    select distinct m.user_id, m.tenant_id
    from public.memberships m
    join auth.users u on u.id = m.user_id
    where u.raw_app_meta_data->>'tenant_id' is null
       or u.raw_app_meta_data->>'tenant_id' != m.tenant_id::text
    order by m.user_id, m.created_at asc
  loop
    update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('tenant_id', r.tenant_id::text)
    where id = r.user_id;
  end loop;
end $$;

-- 2) Actualizar políticas RLS para usar JWT tenant_id

-- Staff table
drop policy if exists "tenant_read_staff" on public.staff;
drop policy if exists "tenant_crud_staff" on public.staff;
drop policy if exists "tenant_read_staff_members" on public.staff;
drop policy if exists "tenant_manage_staff" on public.staff;

create policy "tenant_read_staff"
  on public.staff
  for select
  using (tenant_id::text = auth.jwt()->>'tenant_id');

create policy "tenant_manage_staff"
  on public.staff
  for all
  using (tenant_id::text = auth.jwt()->>'tenant_id')
  with check (tenant_id::text = auth.jwt()->>'tenant_id');

-- Services table
drop policy if exists "tenant_read_services" on public.services;
drop policy if exists "tenant_crud_services" on public.services;

create policy "tenant_read_services"
  on public.services
  for select
  using (tenant_id::text = auth.jwt()->>'tenant_id');

create policy "tenant_manage_services"
  on public.services
  for all
  using (tenant_id::text = auth.jwt()->>'tenant_id')
  with check (tenant_id::text = auth.jwt()->>'tenant_id');

-- Appointments/Bookings table
drop policy if exists "tenant_read_bookings" on public.bookings;
drop policy if exists "tenant_crud_bookings" on public.bookings;

create policy "tenant_read_bookings"
  on public.bookings
  for select
  using (tenant_id::text = auth.jwt()->>'tenant_id');

create policy "tenant_manage_bookings"
  on public.bookings
  for all
  using (tenant_id::text = auth.jwt()->>'tenant_id')
  with check (tenant_id::text = auth.jwt()->>'tenant_id');

-- =============================================================================
-- PHASE 2: Consolidate staff_provides_services table
-- =============================================================================

-- 1) Crear tabla canónica staff_provides_services
create table if not exists public.staff_provides_services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, staff_id, service_id)
);

-- 2) Índices para performance
create index if not exists idx_staff_provides_services_tenant_staff
  on public.staff_provides_services(tenant_id, staff_id);

create index if not exists idx_staff_provides_services_tenant_service
  on public.staff_provides_services(tenant_id, service_id);

create index if not exists idx_staff_provides_services_composite
  on public.staff_provides_services(tenant_id, staff_id, service_id);

-- 3) RLS: Solo usuarios autenticados del tenant pueden gestionar relaciones
alter table public.staff_provides_services enable row level security;

drop policy if exists "tenant_read_staff_services" on public.staff_provides_services;
drop policy if exists "tenant_manage_staff_services" on public.staff_provides_services;

create policy "tenant_read_staff_services" on public.staff_provides_services
for select using (tenant_id::text = auth.jwt()->>'tenant_id');

create policy "tenant_manage_staff_services" on public.staff_provides_services
for all using (tenant_id::text = auth.jwt()->>'tenant_id')
with check (tenant_id::text = auth.jwt()->>'tenant_id');

-- 4) Trigger para updated_at
create or replace function update_staff_provides_services_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_staff_provides_services_updated_at on public.staff_provides_services;
create trigger trigger_staff_provides_services_updated_at
  before update on public.staff_provides_services
  for each row execute function update_staff_provides_services_updated_at();

-- 5) Backfill desde services.staff_only_ids existentes
insert into public.staff_provides_services (tenant_id, staff_id, service_id)
select
  s.tenant_id,
  unnest(s.staff_only_ids) as staff_id,
  s.id as service_id
from public.services s
where s.staff_only_ids is not null
  and array_length(s.staff_only_ids, 1) > 0
  and s.tenant_id is not null
on conflict (tenant_id, staff_id, service_id) do nothing;

-- 6) Función helper para mantener staff_only_ids sincronizado
create or replace function sync_staff_only_ids_from_relations()
returns void as $$
begin
  -- Actualizar staff_only_ids basado en relaciones actuales
  update public.services
  set staff_only_ids = coalesce(
    (
      select array_agg(sps.staff_id order by sps.staff_id)
      from public.staff_provides_services sps
      where sps.service_id = services.id
        and sps.tenant_id = services.tenant_id
    ),
    null
  )
  where tenant_id in (
    select distinct tenant_id
    from public.staff_provides_services
  );
end;
$$ language plpgsql;

-- Llamar sincronización inicial
select sync_staff_only_ids_from_relations();

-- =============================================================================
-- PHASE 3 & 4: Comments and final setup
-- =============================================================================

-- Comentarios para documentación
comment on table public.staff_provides_services is
  'Tabla canónica para relaciones staff-servicios. Fuente de verdad única para asignaciones.';

comment on column public.services.staff_only_ids is
  'Campo legacy derivado de staff_provides_services. Mantener sincronizado para compatibilidad con lógica de disponibilidad existente.';

comment on function auth.set_tenant_claim() is
  'Actualiza raw_app_meta_data del usuario con tenant_id para incluirlo en JWT claims';

-- Función helper para debugging JWT claims
create or replace function auth.get_jwt_claims()
returns jsonb
language sql
security definer
stable
as $$
  select auth.jwt();
$$;

comment on function auth.get_jwt_claims() is
  'Helper para debugging: retorna los claims del JWT actual';

commit;

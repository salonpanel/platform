-- 0109_jwt_based_rls_tenant_access.sql
-- Implementa RLS basado en JWT para acceso multi-tenant
-- Reemplaza app.current_tenant_id() con auth.jwt()->>'tenant_id'

begin;

-- 1) Función para actualizar JWT claims con tenant_id
-- Se ejecuta cuando un usuario se autentica para incluir tenant_id en el JWT
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
create or replace trigger on_membership_created
  after insert on public.memberships
  for each row
  execute function auth.set_tenant_claim();

-- También actualizar claims existentes para usuarios que ya tienen memberships
-- (esto es una operación one-time para usuarios existentes)
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

-- Staff_provides_services table (se creará en siguiente migración)
-- Por ahora solo aseguramos que no hay políticas conflictivas
drop policy if exists "tenant_read_staff_services" on public.staff_provides_services;
drop policy if exists "tenant_manage_staff_services" on public.staff_provides_services;

-- 3) Función helper para debugging JWT claims
create or replace function auth.get_jwt_claims()
returns jsonb
language sql
security definer
stable
as $$
  select auth.jwt();
$$;

-- Comentarios
comment on function auth.set_tenant_claim() is
  'Actualiza raw_app_meta_data del usuario con tenant_id para incluirlo en JWT claims';

comment on function auth.get_jwt_claims() is
  'Helper para debugging: retorna los claims del JWT actual';

commit;

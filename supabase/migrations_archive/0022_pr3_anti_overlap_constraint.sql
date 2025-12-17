-- 0022_pr3_anti_overlap_constraint.sql
-- PR3: Constraint anti-solapes por staff_id (capa de hierro)

-- 1) Extensión para GIST (permitida en Supabase)
create extension if not exists btree_gist;

-- 2) Columna de rango almacenada (tstzrange) para bookings
alter table public.bookings 
  add column if not exists slot tstzrange
  generated always as (tstzrange(starts_at, ends_at, '[)')) stored;

-- Índice GIST para búsquedas eficientes de solapes
-- Incluir tenant_id para optimizar búsquedas multi-tenant
create index if not exists idx_bookings_staff_slot_gist
  on public.bookings using gist (tenant_id, staff_id, slot);

-- 3) Constraint EXCLUDE para prohibir solapes por staff_id
-- Solo aplica a estados críticos (pending, paid) donde el slot está ocupado
do $$
begin
  -- Eliminar constraint existente si existe
  if exists (
    select 1 from pg_constraint 
    where conname = 'excl_staff_overlap_bookings'
  ) then
    alter table public.bookings drop constraint excl_staff_overlap_bookings;
  end if;
  
  -- Crear constraint EXCLUDE
  -- Incluir tenant_id para asegurar aislamiento multi-tenant
  alter table public.bookings
    add constraint excl_staff_overlap_bookings
    exclude using gist (
      tenant_id with =,
      staff_id with =,
      slot with &&
    )
    where (status in ('pending', 'paid'));
end $$;

comment on constraint excl_staff_overlap_bookings on public.bookings is 
  'Prohíbe solapes de tiempo para un mismo tenant_id + staff_id en estados pending o paid. Usa EXCLUDE con GIST. Incluye tenant_id para aislamiento multi-tenant.';

-- 4) También aplicar a appointments si existe (legacy)
do $$
begin
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' 
      and table_name = 'appointments'
  ) then
    -- Añadir columna slot a appointments
    alter table public.appointments 
      add column if not exists slot tstzrange
      generated always as (tstzrange(starts_at, ends_at, '[)')) stored;
    
    -- Índice GIST para appointments
    -- Incluir tenant_id para optimizar búsquedas multi-tenant
    create index if not exists idx_appointments_staff_slot_gist
      on public.appointments using gist (tenant_id, staff_id, slot);
    
    -- Constraint EXCLUDE para appointments
    if exists (
      select 1 from pg_constraint 
      where conname = 'excl_staff_overlap_appointments'
    ) then
      alter table public.appointments drop constraint excl_staff_overlap_appointments;
    end if;
    
    -- Crear constraint EXCLUDE para appointments
    -- Incluir tenant_id para asegurar aislamiento multi-tenant
    alter table public.appointments
      add constraint excl_staff_overlap_appointments
      exclude using gist (
        tenant_id with =,
        staff_id with =,
        slot with &&
      )
      where (status in ('hold', 'confirmed'));
    
    comment on constraint excl_staff_overlap_appointments on public.appointments is 
      'Prohíbe solapes de tiempo para un mismo staff_id en estados hold o confirmed (legacy).';
  end if;
end $$;

-- 5) Notas sobre el constraint
-- El constraint EXCLUDE con GIST blinda a nivel de BD; cualquier carrera en alta concurrencia
-- fallará con error 23P01 (exclusion violation) si hay solape.
-- 
-- Estados excluidos del constraint:
-- - cancelled: No ocupa slot
-- - no_show: No ocupa slot
-- - completed: No ocupa slot
--
-- Estados incluidos en el constraint:
-- - pending: Ocupa slot (hold)
-- - paid: Ocupa slot (confirmado)

-- 6) Función helper para verificar disponibilidad antes de insertar
create or replace function public.check_staff_availability(
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_overlap_count integer;
begin
  -- Verificar solapes en bookings
  select count(*) into v_overlap_count
  from public.bookings
  where staff_id = p_staff_id
    and status in ('pending', 'paid')
    and tstzrange(p_starts_at, p_ends_at, '[)') && slot;
  
  if v_overlap_count > 0 then
    return false;
  end if;
  
  -- Verificar solapes en appointments si existe (legacy)
  if exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' 
      and table_name = 'appointments'
  ) then
    select count(*) into v_overlap_count
    from public.appointments
    where staff_id = p_staff_id
      and status in ('hold', 'confirmed')
      and tstzrange(p_starts_at, p_ends_at, '[)') && slot;
    
    if v_overlap_count > 0 then
      return false;
    end if;
  end if;
  
  return true;
end;
$$;

comment on function public.check_staff_availability is 
  'Verifica si un staff está disponible en un rango de tiempo. Retorna true si está disponible, false si hay solape.';


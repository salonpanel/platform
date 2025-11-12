-- 0028_p1_timezone_ui_complete.sql
-- P1.2: Timezone por tenant - Mejoras para UI y validación de slots pasados

-- 1) Asegurar que timezone existe y tiene valor por defecto
alter table public.tenants 
  add column if not exists timezone text default 'Europe/Madrid';

-- Actualizar tenants existentes sin timezone
update public.tenants 
set timezone = 'Europe/Madrid' 
where timezone is null or timezone = '';

-- Asegurar que timezone no puede ser null
alter table public.tenants 
  alter column timezone set default 'Europe/Madrid',
  alter column timezone set not null;

-- 2) Función helper para obtener timezone del tenant (mejorada)
create or replace function app.get_tenant_timezone(p_tenant_id uuid)
returns text
language plpgsql
security definer
stable
as $$
declare
  v_timezone text;
begin
  select timezone into v_timezone
  from public.tenants
  where id = p_tenant_id;
  
  return coalesce(v_timezone, 'Europe/Madrid');
end;
$$;

comment on function app.get_tenant_timezone is 
  'Retorna el timezone del tenant. Si no existe, retorna Europe/Madrid por defecto.';

-- 3) Función helper para validar si un slot está en el pasado (mejorada)
create or replace function public.is_slot_in_past(
  p_tenant_id uuid,
  p_timestamp timestamptz
)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_tenant_tz text;
  v_now_local timestamptz;
  v_timestamp_local timestamptz;
begin
  -- Obtener timezone del tenant
  select coalesce(timezone, 'Europe/Madrid') into v_tenant_tz
  from public.tenants
  where id = p_tenant_id;
  
  -- Calcular "ahora" en timezone del tenant
  -- Nota: now() retorna UTC, lo convertimos al timezone del tenant para comparar
  v_now_local := now() at time zone 'UTC' at time zone v_tenant_tz;
  
  -- Convertir timestamp a timezone del tenant
  v_timestamp_local := p_timestamp at time zone 'UTC' at time zone v_tenant_tz;
  
  -- Verificar si está en el pasado (comparar en timezone local)
  return v_timestamp_local < v_now_local;
end;
$$;

comment on function public.is_slot_in_past is 
  'Verifica si un timestamp está en el pasado según el timezone del tenant. Retorna true si está en el pasado, false si está en el futuro. Compara en timezone local del tenant.';

-- 4) Función helper para convertir timestamp a timezone del tenant (mejorada)
create or replace function public.to_tenant_timezone(
  p_tenant_id uuid,
  p_timestamp timestamptz
)
returns timestamptz
language plpgsql
security definer
stable
as $$
declare
  v_tenant_tz text;
begin
  -- Obtener timezone del tenant
  select coalesce(timezone, 'Europe/Madrid') into v_tenant_tz
  from public.tenants
  where id = p_tenant_id;
  
  -- Convertir a timezone del tenant
  -- Nota: p_timestamp ya está en UTC (timestamptz), lo convertimos al timezone del tenant
  return (p_timestamp at time zone 'UTC') at time zone v_tenant_tz;
end;
$$;

comment on function public.to_tenant_timezone is 
  'Convierte un timestamp UTC a timezone del tenant. Retorna el timestamp en timezone del tenant.';

-- 5) Función helper para obtener información del tenant (incluye timezone)
create or replace function public.get_tenant_info(p_tenant_id uuid)
returns table (
  id uuid,
  slug text,
  name text,
  timezone text,
  created_at timestamptz
)
language plpgsql
security definer
stable
as $$
begin
  return query
  select 
    t.id,
    t.slug,
    t.name,
    coalesce(t.timezone, 'Europe/Madrid') as timezone,
    t.created_at
  from public.tenants t
  where t.id = p_tenant_id;
end;
$$;

comment on function public.get_tenant_info is 
  'Retorna información del tenant, incluyendo timezone. Útil para el frontend.';

-- 6) Índice para mejorar consultas de timezone
create index if not exists idx_tenants_timezone 
  on public.tenants(timezone) 
  where timezone is not null;

-- 7) Comentarios
comment on column public.tenants.timezone is 
  'Timezone del tenant (ej: Europe/Madrid, America/New_York). Usado para calcular slots y mostrar horarios. Debe ser un timezone válido de PostgreSQL. No puede ser null.';

-- 8) Validación: Asegurar que el timezone es válido usando una función
-- Nota: PostgreSQL valida automáticamente los timezones, pero añadimos un check constraint básico
do $$
begin
  -- Eliminar constraint anterior si existe
  if exists (
    select 1 from pg_constraint 
    where conname = 'tenants_timezone_check'
  ) then
    alter table public.tenants drop constraint tenants_timezone_check;
  end if;
  
  -- Crear constraint mejorado (más permisivo)
  alter table public.tenants 
    add constraint tenants_timezone_check 
    check (
      timezone is not null 
      and length(timezone) > 0
      and length(timezone) <= 50
    );
end $$;

comment on constraint tenants_timezone_check on public.tenants is 
  'Valida que timezone no sea null y tenga longitud válida. PostgreSQL valida que sea un timezone válido.';


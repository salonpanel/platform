-- 0026_p1_timezone_complete.sql
-- P1.2: Timezone por organización - Refinamiento completo

-- 1) Asegurar que timezone existe en tenants con constraint
alter table public.tenants 
  add column if not exists timezone text default 'Europe/Madrid';

-- Validar que timezone es válido (timezone de PostgreSQL)
alter table public.tenants 
  add constraint if not exists tenants_timezone_check 
  check (
    timezone is null 
    or timezone ~ '^[A-Za-z_]+/[A-Za-z_]+$' 
    or timezone = 'UTC'
  );

-- Actualizar tenants existentes sin timezone
update public.tenants 
set timezone = 'Europe/Madrid' 
where timezone is null or timezone = '';

-- 2) Función helper para obtener timezone del tenant
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

-- 3) Mejorar función get_available_slots para validar pasado en timezone del tenant
create or replace function public.get_available_slots(
  p_tenant_id uuid,
  p_service_id uuid,
  p_staff_id uuid default null,
  p_date date default current_date,
  p_days_ahead int default 30
)
returns table (
  slot_start timestamptz,
  slot_end timestamptz,
  staff_id uuid,
  staff_name text
)
language plpgsql
stable
as $$
declare
  v_service_duration interval;
  v_tenant_tz text;
  v_date_start date;
  v_date_end date;
begin
  -- Obtener duración del servicio y timezone del tenant
  select s.duration_min, coalesce(t.timezone, 'Europe/Madrid')
  into v_service_duration, v_tenant_tz
  from public.services s
  join public.tenants t on t.id = s.tenant_id
  where s.id = p_service_id
    and s.tenant_id = p_tenant_id
    and s.active = true
  limit 1;

  if v_service_duration is null then
    return; -- Servicio no encontrado o inactivo
  end if;

  v_service_duration := (v_service_duration || ' minutes')::interval;
  v_date_start := p_date;
  v_date_end := p_date + (p_days_ahead || ' days')::interval;

  return query
  with date_series as (
    -- Generar serie de fechas
    select generate_series(
      v_date_start::timestamp,
      v_date_end::timestamp,
      '1 day'::interval
    )::date as day
  ),
  staff_schedules as (
    -- Horarios del staff para los días solicitados
    select 
      s.staff_id,
      s.weekday,
      s.start_time,
      s.end_time,
      st.display_name as staff_name
    from public.schedules s
    join public.staff st on st.id = s.staff_id
    where s.tenant_id = p_tenant_id
      and st.tenant_id = p_tenant_id
      and st.active = true
      and (p_staff_id is null or s.staff_id = p_staff_id)
  ),
  existing_bookings as (
    -- Reservas existentes (pagadas, completadas o pendientes no expiradas)
    select 
      b.staff_id,
      b.starts_at,
      b.ends_at
    from public.bookings b
    where b.tenant_id = p_tenant_id
      and b.status in ('paid', 'completed')
      and b.starts_at >= (v_date_start::timestamp at time zone v_tenant_tz)::timestamptz
      and b.starts_at < (v_date_end::timestamp at time zone v_tenant_tz)::timestamptz
    
    union all
    
    -- Pendientes no expirados (holds)
    select 
      b.staff_id,
      b.starts_at,
      b.ends_at
    from public.bookings b
    where b.tenant_id = p_tenant_id
      and b.status = 'pending'
      and (b.expires_at is null or b.expires_at > now())
      and b.starts_at >= (v_date_start::timestamp at time zone v_tenant_tz)::timestamptz
      and b.starts_at < (v_date_end::timestamp at time zone v_tenant_tz)::timestamptz
  ),
  time_slots as (
    -- Generar slots de tiempo para cada día y staff
    -- Convertir a UTC para almacenamiento
    select 
      ss.staff_id,
      ss.staff_name,
      ((ds.day::timestamp + ss.start_time)::timestamp at time zone v_tenant_tz)::timestamptz as slot_start_tz,
      ((ds.day::timestamp + ss.end_time)::timestamp at time zone v_tenant_tz)::timestamptz as slot_end_tz
    from date_series ds
    cross join staff_schedules ss
    where extract(dow from ds.day) = ss.weekday
  ),
  generated_slots as (
    -- Generar slots de la duración del servicio dentro de cada ventana
    select 
      ts.staff_id,
      ts.staff_name,
      generate_series(
        ts.slot_start_tz,
        ts.slot_end_tz - v_service_duration,
        '15 minutes'::interval -- Intervalo mínimo entre slots (configurable)
      )::timestamptz as slot_start,
      (generate_series(
        ts.slot_start_tz,
        ts.slot_end_tz - v_service_duration,
        '15 minutes'::interval
      ) + v_service_duration)::timestamptz as slot_end
    from time_slots ts
    -- P1.2: Validar que el slot no esté en el pasado (comparar directamente con now() en UTC)
    where ts.slot_start_tz >= now()
  )
  select 
    gs.slot_start,
    gs.slot_end,
    gs.staff_id,
    gs.staff_name
  from generated_slots gs
  where not exists (
    -- Excluir slots que solapan con reservas existentes
    select 1
    from existing_bookings eb
    where eb.staff_id = gs.staff_id
      and (
        (gs.slot_start < eb.ends_at and gs.slot_end > eb.starts_at)
      )
  )
  -- P1.2: Filtrar slots pasados (validación adicional, ambos timestamps en UTC)
  and gs.slot_start >= now()
  order by gs.slot_start, gs.staff_name;
end;
$$;

comment on function public.get_available_slots is 
  'Calcula slots disponibles para un servicio, considerando horarios del staff, reservas existentes y holds no expirados. Respeta timezone del tenant y valida que los slots no estén en el pasado.';

-- 4) Función helper para validar si un timestamp está en el pasado según timezone del tenant
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
  v_now_tz timestamptz;
  v_timestamp_tz timestamptz;
begin
  -- Obtener timezone del tenant
  select coalesce(timezone, 'Europe/Madrid') into v_tenant_tz
  from public.tenants
  where id = p_tenant_id;
  
  -- Calcular "ahora" en timezone del tenant
  v_now_tz := now() at time zone v_tenant_tz;
  
  -- Convertir timestamp a timezone del tenant
  v_timestamp_tz := p_timestamp at time zone v_tenant_tz;
  
  -- Verificar si está en el pasado
  return v_timestamp_tz < v_now_tz;
end;
$$;

comment on function public.is_slot_in_past is 
  'Verifica si un timestamp está en el pasado según el timezone del tenant. Retorna true si está en el pasado, false si está en el futuro.';

-- 5) Función helper para convertir timestamp a timezone del tenant
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
  return (p_timestamp at time zone 'UTC') at time zone v_tenant_tz;
end;
$$;

comment on function public.to_tenant_timezone is 
  'Convierte un timestamp UTC a timezone del tenant. Retorna el timestamp en timezone del tenant.';

-- 6) Índice para mejorar consultas de timezone
create index if not exists idx_tenants_timezone 
  on public.tenants(timezone) 
  where timezone is not null;

-- 7) Comentarios
comment on column public.tenants.timezone is 
  'Timezone del tenant (ej: Europe/Madrid, America/New_York). Usado para calcular slots y mostrar horarios. Debe ser un timezone válido de PostgreSQL.';


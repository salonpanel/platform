-- 0016_availability_engine.sql
-- Motor de disponibilidad real: slots calculados dinámicamente

-- 1) Añadir timezone a tenants
alter table public.tenants 
  add column if not exists timezone text default 'Europe/Madrid';

-- 2) Añadir expires_at a bookings si no existe (para holds con TTL)
alter table public.bookings 
  add column if not exists expires_at timestamptz;

-- 3) Función para calcular slots disponibles

-- Proteger función legacy: solo crear si existe schedules
do $$
begin
  if to_regclass('public.schedules') is not null then
    execute $$
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
      select duration_min, t.timezone
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
      v_tenant_tz := coalesce(v_tenant_tz, 'Europe/Madrid');
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
        join date_series ds on extract(dow from ds.day) = s.weekday
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
        select 
          ss.staff_id,
          ss.staff_name,
          (ds.day::timestamp + ss.start_time)::timestamptz at time zone v_tenant_tz as slot_start_tz,
          (ds.day::timestamp + ss.end_time)::timestamp at time zone v_tenant_tz as slot_end_tz
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
        where ts.slot_start_tz >= now() -- Solo slots futuros
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
      order by gs.slot_start, gs.staff_name;
    end;
    $$;
  end if;
end $$;

-- 4) Índices para mejorar rendimiento de consultas de disponibilidad
create index if not exists idx_bookings_tenant_staff_time 
  on public.bookings(tenant_id, staff_id, starts_at, status) 
  where status in ('paid', 'completed', 'pending');

create index if not exists idx_bookings_hold_expires 
  on public.bookings(tenant_id, starts_at, expires_at) 
  where status = 'pending' and expires_at is not null;

-- 5) Eliminar vista placeholder (reemplazada por función)
drop view if exists public.vw_staff_availability;

-- 6) Comentarios para documentación
comment on function public.get_available_slots is 
  'Calcula slots disponibles para un servicio, considerando horarios del staff, reservas existentes y holds no expirados. Respeta timezone del tenant.';

comment on column public.tenants.timezone is 
  'Timezone del tenant (ej: Europe/Madrid). Usado para calcular slots y mostrar horarios.';


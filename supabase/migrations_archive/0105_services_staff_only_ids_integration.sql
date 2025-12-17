-- 0105_services_staff_only_ids_integration.sql
-- Actualiza la función get_available_slots para respetar staff_only_ids en servicios
-- y conecta la lógica de asignación de staff con el sistema de reservas

begin;

-- Actualizar la función get_available_slots para filtrar por staff_only_ids
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
  v_staff_only_ids uuid[];
begin
  -- Obtener duración del servicio, timezone del tenant y staff_only_ids
  select s.duration_min, coalesce(t.timezone, 'Europe/Madrid'), s.staff_only_ids
  into v_service_duration, v_tenant_tz, v_staff_only_ids
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
    -- FILTRAR por staff_only_ids si existe restricción
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
      and st.provides_services = true
      and (p_staff_id is null or s.staff_id = p_staff_id)
      -- Si staff_only_ids no es NULL y tiene elementos, filtrar por ellos
      and (v_staff_only_ids is null or array_length(v_staff_only_ids, 1) is null or s.staff_id = any(v_staff_only_ids))
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

-- Actualizar comentario de la función
comment on function public.get_available_slots is
  'Calcula slots disponibles para un servicio, considerando horarios del staff, reservas existentes, holds no expirados y restricciones de staff_only_ids. Respeta timezone del tenant y valida que los slots no estén en el pasado.';

commit;

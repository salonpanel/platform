-- 0030_simplify_cron_metrics.sql
-- Simplificar KPIs de cron: eliminar cron_cleanups_total y dejar solo cron_holds_released
-- Ambos estaban midiendo lo mismo, así que simplificamos

-- 1) Eliminar columna cron_cleanups_total (ya no la necesitamos)
alter table public.org_metrics_daily 
  drop column if exists cron_cleanups_total;

-- 2) Actualizar función calculate_org_metrics_daily para simplificar
create or replace function public.calculate_org_metrics_daily(
  p_tenant_id uuid,
  p_metric_date date default current_date
)
returns void
language plpgsql
security definer
as $$
declare
  v_total_bookings int;
  v_confirmed_bookings int;
  v_cancelled_bookings int;
  v_no_show_bookings int;
  v_revenue_cents int;
  v_active_services int;
  v_active_staff int;
  v_slots_booked int;
  v_total_slots_available int;
  v_occupancy_rate numeric;
  v_webhook_events_total int;
  v_webhook_events_failed int;
  v_cron_holds_released int;
  v_date_start timestamptz;
  v_date_end timestamptz;
begin
  -- Calcular rangos de fecha (todo el día en UTC)
  v_date_start := p_metric_date::timestamp at time zone 'UTC';
  v_date_end := (p_metric_date + interval '1 day')::timestamp at time zone 'UTC';

  -- Contar reservas por estado (bookings)
  select 
    count(*) filter (where status in ('pending', 'paid', 'cancelled', 'no_show', 'completed')),
    count(*) filter (where status in ('paid', 'completed')),
    count(*) filter (where status = 'cancelled'),
    count(*) filter (where status = 'no_show')
  into 
    v_total_bookings,
    v_confirmed_bookings,
    v_cancelled_bookings,
    v_no_show_bookings
  from public.bookings
  where tenant_id = p_tenant_id
    and starts_at >= v_date_start
    and starts_at < v_date_end;

  -- Calcular ingresos (solo reservas confirmadas/pagadas)
  select coalesce(sum(
    case 
      when s.price_cents is not null then s.price_cents
      else 0
    end
  ), 0)
  into v_revenue_cents
  from public.bookings b
  left join public.services s on s.id = b.service_id
  where b.tenant_id = p_tenant_id
    and b.status in ('confirmed', 'paid', 'completed')
    and b.starts_at >= v_date_start
    and b.starts_at < v_date_end;

  -- Contar servicios y staff activos
  select 
    count(*) filter (where active = true),
    (select count(*) from public.staff where tenant_id = p_tenant_id and active = true)
  into 
    v_active_services,
    v_active_staff
  from public.services
  where tenant_id = p_tenant_id;

  -- Calcular slots (simplificado: basado en horarios del staff)
  select count(*)
  into v_slots_booked
  from public.bookings
  where tenant_id = p_tenant_id
    and starts_at >= v_date_start
    and starts_at < v_date_end
    and status in ('confirmed', 'paid', 'hold');

  -- Calcular ocupación (simplificado)
  v_total_slots_available := coalesce(v_slots_booked * 2, 0); -- Aproximación
  v_occupancy_rate := case 
    when v_total_slots_available > 0 
    then (v_slots_booked::numeric / v_total_slots_available::numeric * 100)
    else 0
  end;

  -- Métricas de webhooks (últimas 24 horas)
  -- Nota: stripe_events_processed no tiene tenant_id, así que contamos todos los eventos
  -- Por ahora, las métricas de webhooks son globales, no por tenant
  -- En el futuro, podríamos añadir tenant_id a stripe_events_processed
  v_webhook_events_total := 0;
  v_webhook_events_failed := 0;

  -- Métricas de cron (holds liberados)
  -- Aproximación: contamos reservas canceladas en la ventana de tiempo
  -- Nota: Esta es una aproximación. En el futuro, podríamos añadir un campo
  -- 'cancelled_by' o 'cancellation_reason' para identificar mejor los holds liberados por cron
  select count(*)
  into v_cron_holds_released
  from public.bookings
  where tenant_id = p_tenant_id
    and updated_at >= v_date_start
    and updated_at < v_date_end
    and status = 'cancelled'
    and expires_at is null; -- Indica que fue cancelado por el cron (expires_at fue limpiado)

  -- Insertar o actualizar métricas
  insert into public.org_metrics_daily (
    tenant_id,
    metric_date,
    total_bookings,
    confirmed_bookings,
    cancelled_bookings,
    no_show_bookings,
    total_slots_available,
    slots_booked,
    occupancy_rate,
    active_services,
    active_staff,
    revenue_cents,
    webhook_events_total,
    webhook_events_failed,
    cron_holds_released,
    updated_at
  )
  values (
    p_tenant_id,
    p_metric_date,
    v_total_bookings,
    v_confirmed_bookings,
    v_cancelled_bookings,
    v_no_show_bookings,
    v_total_slots_available,
    v_slots_booked,
    v_occupancy_rate,
    v_active_services,
    v_active_staff,
    v_revenue_cents,
    v_webhook_events_total,
    v_webhook_events_failed,
    v_cron_holds_released,
    now()
  )
  on conflict (tenant_id, metric_date) do update set
    total_bookings = excluded.total_bookings,
    confirmed_bookings = excluded.confirmed_bookings,
    cancelled_bookings = excluded.cancelled_bookings,
    no_show_bookings = excluded.no_show_bookings,
    total_slots_available = excluded.total_slots_available,
    slots_booked = excluded.slots_booked,
    occupancy_rate = excluded.occupancy_rate,
    active_services = excluded.active_services,
    active_staff = excluded.active_staff,
    revenue_cents = excluded.revenue_cents,
    webhook_events_total = excluded.webhook_events_total,
    webhook_events_failed = excluded.webhook_events_failed,
    cron_holds_released = excluded.cron_holds_released,
    updated_at = now();
end;
$$;

comment on function public.calculate_org_metrics_daily is 
  'Calcula y almacena métricas diarias para un tenant, incluyendo webhooks y cron. 
   Nota: cron_holds_released es una aproximación basada en reservas canceladas con expires_at null. 
   Las métricas de webhooks son globales (no por tenant) ya que stripe_events_processed no tiene tenant_id.';

-- 3) Eliminar índice de cron_cleanups_total si existe
-- Nota: Verificar primero si el índice existe para evitar errores
do $$
begin
  if exists (
    select 1 from pg_indexes 
    where schemaname = 'public' 
    and tablename = 'org_metrics_daily'
    and indexname = 'idx_org_metrics_cron_cleanups'
  ) then
    drop index if exists public.idx_org_metrics_cron_cleanups;
  end if;
end $$;

-- 4) Añadir columna cron_holds_released si no existe (por si la migración 0023 no se ejecutó)
alter table public.org_metrics_daily
  add column if not exists cron_holds_released int default 0;

-- 5) Actualizar comentario de la columna solo si existe
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'org_metrics_daily'
    and column_name = 'cron_holds_released'
  ) then
    comment on column public.org_metrics_daily.cron_holds_released is 
      'Aproximación del número de holds liberados por el cron job. 
       Se calcula contando reservas canceladas con expires_at null en la ventana de tiempo.';
  end if;
end $$;


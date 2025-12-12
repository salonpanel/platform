-- 0023_org_metrics_enhanced.sql
-- Mejoras a org_metrics_daily: métricas de webhooks, cron y fallos

-- 1) Añadir columnas de métricas de webhooks y cron
alter table public.org_metrics_daily
  add column if not exists webhook_events_total int default 0,
  add column if not exists webhook_events_failed int default 0,
  add column if not exists cron_cleanups_total int default 0,
  add column if not exists cron_holds_released int default 0;

-- 2) Función mejorada para calcular métricas diarias
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
  v_cron_cleanups_total int;
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
    and b.status in ('paid', 'completed')
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
    and status in ('pending', 'paid');

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
  -- Por ahora, establecemos valores por defecto (0) ya que no podemos filtrar por tenant
  v_webhook_events_total := 0;
  v_webhook_events_failed := 0;
  
  -- Si queremos métricas globales, descomentar:
  -- select 
  --   count(*),
  --   count(*) filter (where event_type like '%failed%' or event_type like '%error%')
  -- into 
  --   v_webhook_events_total,
  --   v_webhook_events_failed
  -- from public.stripe_events_processed
  -- where created_at >= v_date_start
  --   and created_at < v_date_end;

  -- Métricas de cron (limpieza de holds)
  -- Contamos holds cancelados que fueron pending y fueron actualizados en el rango de fecha
  -- Nota: Esto es una aproximación, ya que no tenemos un campo que indique explícitamente
  -- que fue cancelado por el cron (podríamos añadir un campo 'cancelled_by' en el futuro)
  select 
    count(*) filter (where status = 'cancelled' and expires_at is null),
    count(*) filter (where status = 'cancelled' and expires_at is null)
  into 
    v_cron_cleanups_total,
    v_cron_holds_released
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
    cron_cleanups_total,
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
    v_cron_cleanups_total,
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
    cron_cleanups_total = excluded.cron_cleanups_total,
    cron_holds_released = excluded.cron_holds_released,
    updated_at = now();
end;
$$;

comment on function public.calculate_org_metrics_daily is 
  'Calcula y almacena métricas diarias para un tenant, incluyendo webhooks y cron. Se puede ejecutar manualmente o vía cron job.';

-- 3) Función para calcular métricas de todos los tenants (para cron ETL)
create or replace function public.calculate_all_org_metrics_daily(
  p_metric_date date default current_date - interval '1 day'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  r record;
  v_total_tenants int := 0;
  v_total_bookings int := 0;
  v_total_revenue_cents int := 0;
  v_results jsonb := '[]'::jsonb;
begin
  -- Calcular métricas para cada tenant
  for r in select id from public.tenants loop
    perform public.calculate_org_metrics_daily(r.id, p_metric_date);
    v_total_tenants := v_total_tenants + 1;
  end loop;
  
  -- Obtener resumen de métricas calculadas
  select 
    count(*),
    coalesce(sum(total_bookings), 0),
    coalesce(sum(revenue_cents), 0)
  into 
    v_total_tenants,
    v_total_bookings,
    v_total_revenue_cents
  from public.org_metrics_daily
  where metric_date = p_metric_date;
  
  -- Retornar resumen en formato JSON
  return jsonb_build_object(
    'metric_date', p_metric_date,
    'tenants_processed', v_total_tenants,
    'total_bookings', v_total_bookings,
    'total_revenue_cents', v_total_revenue_cents
  );
end;
$$;

comment on function public.calculate_all_org_metrics_daily is 
  'Calcula métricas diarias para todos los tenants. Usado por cron ETL nocturno. Retorna resumen en formato JSON.';

-- 4) Índices adicionales para consultas de métricas
create index if not exists idx_org_metrics_webhook_events 
  on public.org_metrics_daily(webhook_events_total, webhook_events_failed);

create index if not exists idx_org_metrics_cron_cleanups 
  on public.org_metrics_daily(cron_cleanups_total, cron_holds_released);


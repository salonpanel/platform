-- 0017_org_metrics_daily.sql
-- Métricas diarias por organización para observabilidad

create table if not exists public.org_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  metric_date date not null,
  
  -- KPIs básicos
  total_bookings int default 0,
  confirmed_bookings int default 0,
  cancelled_bookings int default 0,
  no_show_bookings int default 0,
  
  -- Métricas de ocupación
  total_slots_available int default 0,
  slots_booked int default 0,
  occupancy_rate numeric(5, 2) default 0, -- porcentaje 0-100
  
  -- Métricas de servicios
  active_services int default 0,
  active_staff int default 0,
  
  -- Métricas de ingresos (en centavos)
  revenue_cents int default 0,
  
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(tenant_id, metric_date)
);

create index if not exists idx_org_metrics_tenant_date 
  on public.org_metrics_daily(tenant_id, metric_date desc);

create index if not exists idx_org_metrics_date 
  on public.org_metrics_daily(metric_date desc);

-- Función para calcular métricas de un día para un tenant
create or replace function public.calculate_org_metrics_daily(
  p_tenant_id uuid,
  p_metric_date date default current_date
)
returns void
language plpgsql
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
  v_date_start timestamptz;
  v_date_end timestamptz;
begin
  -- Calcular rangos de fecha (todo el día en UTC)
  v_date_start := p_metric_date::timestamp at time zone 'UTC';
  v_date_end := (p_metric_date + interval '1 day')::timestamp at time zone 'UTC';

  -- Contar reservas por estado
  select 
    count(*) filter (where status in ('confirmed', 'paid', 'hold', 'pending', 'cancelled', 'no_show', 'completed')),
    count(*) filter (where status in ('confirmed', 'paid', 'completed')),
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
  -- Esto es una aproximación, el cálculo real se hace en get_available_slots
  select count(*)
  into v_slots_booked
  from public.bookings
  where tenant_id = p_tenant_id
    and starts_at >= v_date_start
    and starts_at < v_date_end
    and status in ('confirmed', 'paid', 'hold');

  -- Calcular ocupación (simplificado)
  -- En producción, esto debería calcularse basándose en los slots reales disponibles
  v_total_slots_available := coalesce(v_slots_booked * 2, 0); -- Aproximación
  v_occupancy_rate := case 
    when v_total_slots_available > 0 
    then (v_slots_booked::numeric / v_total_slots_available::numeric * 100)
    else 0
  end;

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
    updated_at = now();
end;
$$;

-- Job cron para calcular métricas diarias (ejecuta a las 2 AM UTC)
-- Nota: Requiere extensión pg_cron habilitada
-- select cron.schedule(
--   'calculate_daily_metrics',
--   '0 2 * * *', -- 2 AM UTC diariamente
--   $$
--   do $$
--   declare
--     r record;
--   begin
--     for r in select id from public.tenants loop
--       perform public.calculate_org_metrics_daily(r.id, current_date - interval '1 day');
--     end loop;
--   end $$;
--   $$
-- );

-- Comentarios
comment on table public.org_metrics_daily is 
  'Métricas diarias agregadas por tenant para observabilidad y análisis.';

comment on function public.calculate_org_metrics_daily is 
  'Calcula y almacena métricas diarias para un tenant. Se puede ejecutar manualmente o vía cron job.';










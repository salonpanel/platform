-- Adds aggregate metrics to customers and keeps them in sync with bookings

alter table public.customers
  add column if not exists visits_count integer not null default 0,
  add column if not exists last_booking_at timestamptz,
  add column if not exists total_spent_cents bigint not null default 0,
  add column if not exists no_show_count integer not null default 0,
  add column if not exists last_no_show_at timestamptz;

-- Backfill existing metrics from bookings history
with stats as (
  select
    b.customer_id,
    count(*) filter (where b.status in ('completed', 'confirmed')) as visits_count,
    max(case when b.status in ('completed', 'confirmed') then b.starts_at end) as last_booking_at,
    coalesce(sum(case when b.status in ('completed', 'confirmed') then coalesce(s.price_cents, 0) end), 0) as total_spent_cents,
    count(*) filter (where b.status = 'no_show') as no_show_count,
    max(case when b.status = 'no_show' then b.starts_at end) as last_no_show_at
  from public.bookings b
  left join public.services s on s.id = b.service_id
  where b.customer_id is not null
  group by b.customer_id
)
update public.customers c
set
  visits_count = coalesce(stats.visits_count, 0),
  last_booking_at = stats.last_booking_at,
  total_spent_cents = coalesce(stats.total_spent_cents, 0),
  no_show_count = coalesce(stats.no_show_count, 0),
  last_no_show_at = stats.last_no_show_at
from stats
where c.id = stats.customer_id;

update public.customers c
set
  visits_count = 0,
  last_booking_at = null,
  total_spent_cents = 0,
  no_show_count = 0,
  last_no_show_at = null
where not exists (
  select 1 from public.bookings b where b.customer_id = c.id
);

create or replace function public.refresh_customer_stats(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  stats record;
begin
  select
    count(*) filter (where b.status in ('completed', 'confirmed')) as visits_count,
    max(case when b.status in ('completed', 'confirmed') then b.starts_at end) as last_booking_at,
    coalesce(sum(case when b.status in ('completed', 'confirmed') then coalesce(s.price_cents, 0) end), 0) as total_spent_cents,
    count(*) filter (where b.status = 'no_show') as no_show_count,
    max(case when b.status = 'no_show' then b.starts_at end) as last_no_show_at
  into stats
  from public.bookings b
  left join public.services s on s.id = b.service_id
  where b.customer_id = p_customer_id;

  update public.customers c
  set
    visits_count = coalesce(stats.visits_count, 0),
    last_booking_at = stats.last_booking_at,
    total_spent_cents = coalesce(stats.total_spent_cents, 0),
    no_show_count = coalesce(stats.no_show_count, 0),
    last_no_show_at = stats.last_no_show_at
  where c.id = p_customer_id;
end;
$$;

create or replace function public.handle_booking_customer_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  target := coalesce(new.customer_id, old.customer_id);
  if target is null then
    return null;
  end if;

  perform public.refresh_customer_stats(target);
  return null;
end;
$$;

drop trigger if exists trg_bookings_customer_stats on public.bookings;

create trigger trg_bookings_customer_stats
after insert or update or delete on public.bookings
for each row
execute function public.handle_booking_customer_stats();


-- 0005_hold_ttl.sql

alter table public.appointments
  add column if not exists expires_at timestamptz;

create index if not exists idx_appt_hold_exp
  on public.appointments(expires_at)
  where status = 'hold';

update public.appointments
set expires_at = greatest(now() + interval '10 minutes', expires_at)
where status = 'hold'
  and (expires_at is null or expires_at < now());

create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'release_expired_holds',
  '*/5 * * * *',
  $$
  update public.appointments
  set status = 'cancelled'
  where status = 'hold'
    and expires_at is not null
    and now() >= expires_at;
  $$
);


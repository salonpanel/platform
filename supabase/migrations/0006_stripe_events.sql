-- 0006_stripe_events.sql

create table if not exists public.stripe_events_processed (
  event_id text primary key,
  created_at timestamptz default now()
);


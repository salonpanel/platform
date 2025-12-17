-- 0006_stripe_events.sql
-- Idempotencia de webhooks Stripe

create table if not exists public.stripe_events_processed (
  event_id text primary key,
  type text not null,
  created_at timestamptz default now()
);

create index if not exists idx_stripe_events_type on public.stripe_events_processed(type);
create index if not exists idx_stripe_events_created on public.stripe_events_processed(created_at);


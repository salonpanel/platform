-- 0020_pr1_stripe_idempotency.sql
-- PR1: Idempotencia mejorada para webhooks de Stripe

-- Asegurar que la tabla existe y tiene la estructura correcta
create table if not exists public.stripe_events_processed (
  event_id text primary key,
  event_type text not null,
  created_at timestamptz default now()
);

-- Añadir columnas si no existen (compatibilidad con migraciones anteriores)
do $$
begin
  -- Si existe una columna 'type' en lugar de 'event_type', renombrarla
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
      and table_name = 'stripe_events_processed' 
      and column_name = 'type'
      and not exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' 
          and table_name = 'stripe_events_processed' 
          and column_name = 'event_type'
      )
  ) then
    alter table public.stripe_events_processed rename column type to event_type;
  end if;
  
  -- Si no existe event_type, crearla
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
      and table_name = 'stripe_events_processed' 
      and column_name = 'event_type'
  ) then
    alter table public.stripe_events_processed add column event_type text not null default '';
  end if;
end $$;

-- Asegurar que event_type es NOT NULL
alter table public.stripe_events_processed alter column event_type set not null;

-- Índices para métricas
create index if not exists idx_stripe_events_type on public.stripe_events_processed(event_type);
create index if not exists idx_stripe_events_created on public.stripe_events_processed(created_at desc);

-- RLS: Solo el sistema (service_role) puede escribir
alter table public.stripe_events_processed enable row level security;

-- Política: Denegar todo acceso desde clientes (solo service_role)
drop policy if exists "deny_all_stripe_events_processed" on public.stripe_events_processed;
create policy "deny_all_stripe_events_processed"
on public.stripe_events_processed 
for all
using (false) 
with check (false);

-- Comentarios
comment on table public.stripe_events_processed is 
  'Registro de eventos Stripe procesados para idempotencia. Solo accesible desde service_role.';

comment on column public.stripe_events_processed.event_id is 
  'ID único del evento de Stripe (primary key).';

comment on column public.stripe_events_processed.event_type is 
  'Tipo de evento de Stripe (ej: checkout.session.completed).';

comment on column public.stripe_events_processed.created_at is 
  'Timestamp de cuándo se procesó el evento.';


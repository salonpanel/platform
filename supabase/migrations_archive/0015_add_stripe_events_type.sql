-- 0015_add_stripe_events_type.sql
-- Añadir campo type a stripe_events_processed si no existe

alter table public.stripe_events_processed 
  add column if not exists type text;

-- Hacer type NOT NULL solo si no hay filas o todas tienen type
do $$
begin
  if not exists (select 1 from public.stripe_events_processed where type is null) then
    alter table public.stripe_events_processed alter column type set not null;
  end if;
end $$;

-- Crear índices si no existen
create index if not exists idx_stripe_events_type on public.stripe_events_processed(type);
create index if not exists idx_stripe_events_created on public.stripe_events_processed(created_at);

-- Función helper para insert-or-ignore (idempotencia)
create or replace function public.insert_stripe_event_if_new(
  p_event_id text,
  p_type text
)
returns void
language plpgsql
as $$
begin
  insert into public.stripe_events_processed (event_id, type)
  values (p_event_id, p_type)
  on conflict (event_id) do nothing;
end;
$$;


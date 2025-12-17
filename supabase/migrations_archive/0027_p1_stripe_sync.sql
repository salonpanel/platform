-- 0027_p1_stripe_sync.sql
-- P1.3: Sincronización Stripe desde panel - Mejoras y auditoría

-- 1) Asegurar que services tiene stripe_product_id y stripe_price_id
alter table public.services 
  add column if not exists stripe_product_id text;
  
alter table public.services 
  add column if not exists stripe_price_id text;

-- Índices para mejorar búsquedas de servicios sin price_id
create index if not exists idx_services_stripe_price_id 
  on public.services(stripe_price_id) 
  where stripe_price_id is not null;

create index if not exists idx_services_missing_price_id 
  on public.services(tenant_id, active) 
  where stripe_price_id is null and active = true;

-- 2) Función helper para verificar si un servicio es vendible (tiene price_id)
create or replace function public.is_service_sellable(p_service_id uuid)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_has_price_id boolean;
begin
  select (stripe_price_id is not null and stripe_price_id != '') into v_has_price_id
  from public.services
  where id = p_service_id
    and active = true;
  
  return coalesce(v_has_price_id, false);
end;
$$;

comment on function public.is_service_sellable is 
  'Verifica si un servicio es vendible (tiene stripe_price_id y está activo). Retorna true si es vendible, false en caso contrario.';

-- 3) Función helper para obtener servicios sin price_id de un tenant
create or replace function public.get_services_without_price_id(p_tenant_id uuid)
returns table (
  id uuid,
  name text,
  price_cents int,
  duration_min int,
  active boolean
)
language plpgsql
security definer
stable
as $$
begin
  return query
  select 
    s.id,
    s.name,
    s.price_cents,
    s.duration_min,
    s.active
  from public.services s
  where s.tenant_id = p_tenant_id
    and (s.stripe_price_id is null or s.stripe_price_id = '')
    and s.active = true
  order by s.name;
end;
$$;

comment on function public.get_services_without_price_id is 
  'Retorna servicios activos de un tenant que no tienen stripe_price_id. Útil para identificar servicios que necesitan sincronización con Stripe.';

-- 4) Notas sobre sincronización
-- - Los servicios deben tener stripe_price_id para ser vendibles
-- - Si un servicio no tiene price_id, el checkout debe bloquearse
-- - La sincronización debe crear/actualizar productos y precios en Stripe
-- - Los cambios deben auditarse en audit_logs

comment on column public.services.stripe_product_id is 
  'ID del producto en Stripe. Debe existir para que el servicio sea vendible.';

comment on column public.services.stripe_price_id is 
  'ID del precio en Stripe. Debe existir para que el servicio sea vendible. Si falta, el checkout debe bloquearse.';


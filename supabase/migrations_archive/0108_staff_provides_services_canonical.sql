-- 0108_staff_provides_services_canonical.sql
-- Establece staff_provides_services como tabla canónica para relaciones staff-servicios
-- Fecha: 2025-11-27
-- Propósito: Reemplazar staff_only_ids con una tabla relacional normalizada
--
-- DECISIÓN: staff_provides_services es ahora la fuente canónica de relaciones staff-servicios.
-- services.staff_only_ids se mantiene como campo derivado/legacy para compatibilidad
-- con la lógica de disponibilidad existente. NO se escribe directamente desde UI.

begin;

-- 1) Crear tabla canónica staff_provides_services
create table if not exists public.staff_provides_services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, staff_id, service_id)
);

-- 2) Índices para performance
create index if not exists idx_staff_provides_services_tenant_staff
  on public.staff_provides_services(tenant_id, staff_id);

create index if not exists idx_staff_provides_services_tenant_service
  on public.staff_provides_services(tenant_id, service_id);

create index if not exists idx_staff_provides_services_composite
  on public.staff_provides_services(tenant_id, staff_id, service_id);

-- 3) RLS: Solo usuarios autenticados del tenant pueden gestionar relaciones
alter table public.staff_provides_services enable row level security;

create policy "tenant_read_staff_services" on public.staff_provides_services
for select using (tenant_id = app.current_tenant_id());

create policy "tenant_manage_staff_services" on public.staff_provides_services
for all using (tenant_id = app.current_tenant_id())
with check (tenant_id = app.current_tenant_id());

-- 4) Trigger para updated_at
create or replace function update_staff_provides_services_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_staff_provides_services_updated_at
  before update on public.staff_provides_services
  for each row execute function update_staff_provides_services_updated_at();

-- 5) Backfill desde services.staff_only_ids existentes
-- Solo para tenants que ya tienen datos
insert into public.staff_provides_services (tenant_id, staff_id, service_id)
select
  s.tenant_id,
  unnest(s.staff_only_ids) as staff_id,
  s.id as service_id
from public.services s
where s.staff_only_ids is not null
  and array_length(s.staff_only_ids, 1) > 0
  and s.tenant_id is not null
on conflict (tenant_id, staff_id, service_id) do nothing;

-- 6) Función helper para mantener staff_only_ids sincronizado
-- Se puede llamar desde triggers o manualmente para compatibilidad
create or replace function sync_staff_only_ids_from_relations()
returns void as $$
begin
  -- Actualizar staff_only_ids basado en relaciones actuales
  update public.services
  set staff_only_ids = coalesce(
    (
      select array_agg(sps.staff_id order by sps.staff_id)
      from public.staff_provides_services sps
      where sps.service_id = services.id
        and sps.tenant_id = services.tenant_id
    ),
    null
  )
  where tenant_id in (
    select distinct tenant_id
    from public.staff_provides_services
  );
end;
$$ language plpgsql;

-- Llamar una vez para sincronizar datos existentes
select sync_staff_only_ids_from_relations();

-- 7) Comentarios para documentación
comment on table public.staff_provides_services is
  'Tabla canónica para relaciones staff-servicios. Fuente de verdad única para asignaciones.';

comment on column public.services.staff_only_ids is
  'Campo legacy derivado de staff_provides_services. Mantener sincronizado para compatibilidad con lógica de disponibilidad existente.';

commit;

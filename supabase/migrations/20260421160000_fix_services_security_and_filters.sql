-- Fix Servicios security + filtering correctness
-- - Lock down manage_* RPCs (no anon/PUBLIC execute)
-- - Add explicit authz checks + enforce RLS inside SECURITY DEFINER
-- - Harden RLS policies roles (authenticated only)
-- - Make services.active non-nullable + defaults
-- - Add server-side filtering (price/buffer) to manage_list_services

-- ---------------------------------------------------------------------
-- 1) RLS policies hardening
-- ---------------------------------------------------------------------
drop policy if exists public_read_services_active on public.services;

alter policy services_select_members on public.services
  to authenticated
  using (user_has_role_for_tenant(tenant_id, null::text[]));

alter policy tenant_read_staff_services on public.staff_provides_services
  to authenticated
  using (
    exists (
      select 1 from memberships m
      where m.user_id = auth.uid()
        and m.tenant_id = staff_provides_services.tenant_id
    )
  );

alter policy tenant_manage_staff_services on public.staff_provides_services
  to authenticated
  using (
    exists (
      select 1 from memberships m
      where m.user_id = auth.uid()
        and m.tenant_id = staff_provides_services.tenant_id
        and m.role = any (array['owner'::app_role, 'manager'::app_role])
    )
  );

alter policy tenants_select_members on public.tenants
  to authenticated
  using (user_has_role_for_tenant(id, null::text[]));

-- ---------------------------------------------------------------------
-- 2) Schema fixes for services
-- ---------------------------------------------------------------------
update public.services set active = true where active is null;
alter table public.services alter column active set default true;
alter table public.services alter column active set not null;

update public.services set created_at = now() where created_at is null;
alter table public.services alter column created_at set default now();
alter table public.services alter column created_at set not null;

alter table public.services alter column updated_at set default now();
alter table public.services alter column buffer_min set default 0;

update public.services
set category = 'General'
where category is null or length(trim(category)) = 0;

-- ---------------------------------------------------------------------
-- 3) RPC hardening (grants + authz + row_security)
-- ---------------------------------------------------------------------

-- Revoke dangerous EXECUTE grants (explicit signature list)
revoke execute on function public.manage_list_services(uuid,text,text,text,text,text) from public;
revoke execute on function public.manage_list_services(uuid,text,text,text,text,text) from anon;

revoke execute on function public.manage_create_service(uuid,text,integer,integer,text,integer,text,boolean,jsonb) from public;
revoke execute on function public.manage_create_service(uuid,text,integer,integer,text,integer,text,boolean,jsonb) from anon;

revoke execute on function public.manage_update_service(uuid,uuid,text,integer,integer,text,integer,text,boolean,jsonb) from public;
revoke execute on function public.manage_update_service(uuid,uuid,text,integer,integer,text,integer,text,boolean,jsonb) from anon;

revoke execute on function public.manage_duplicate_service(uuid,uuid) from public;
revoke execute on function public.manage_duplicate_service(uuid,uuid) from anon;

revoke execute on function public.manage_delete_service(uuid,uuid) from public;
revoke execute on function public.manage_delete_service(uuid,uuid) from anon;

-- Replace manage_list_services with server-side filtering + authz
create or replace function public.manage_list_services(
  p_tenant_id uuid,
  p_search_term text default null,
  p_category text default null,
  p_status text default 'active',
  p_sort_by text default 'name',
  p_sort_direction text default 'asc',
  p_min_price_cents integer default null,
  p_max_price_cents integer default null,
  p_buffer_filter text default null -- null|all|no_buffer|with_buffer
)
returns setof public.services
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not user_has_role_for_tenant(p_tenant_id, null::text[]) then
    raise exception 'access_denied' using errcode = '42501';
  end if;

  perform set_config('row_security', 'on', true);

  return query
  select s.*
  from services s
  where s.tenant_id = p_tenant_id
    and (
      p_search_term is null
      or length(trim(p_search_term)) = 0
      or s.name ilike '%' || trim(p_search_term) || '%'
      or coalesce(s.description,'') ilike '%' || trim(p_search_term) || '%'
    )
    and (
      p_category is null
      or p_category = 'all'
      or s.category = p_category
    )
    and (
      p_status = 'all'
      or (p_status = 'active' and s.active = true)
      or (p_status = 'inactive' and s.active = false)
    )
    and (
      p_min_price_cents is null
      or s.price_cents >= p_min_price_cents
    )
    and (
      p_max_price_cents is null
      or s.price_cents <= p_max_price_cents
    )
    and (
      p_buffer_filter is null
      or p_buffer_filter = 'all'
      or (p_buffer_filter = 'no_buffer' and coalesce(s.buffer_min,0) = 0)
      or (p_buffer_filter = 'with_buffer' and coalesce(s.buffer_min,0) > 0)
    )
  order by
    case when p_sort_by = 'price' and p_sort_direction = 'asc' then s.price_cents end asc,
    case when p_sort_by = 'price' and p_sort_direction = 'desc' then s.price_cents end desc,
    case when p_sort_by = 'duration' and p_sort_direction = 'asc' then s.duration_min end asc,
    case when p_sort_by = 'duration' and p_sort_direction = 'desc' then s.duration_min end desc,
    case when p_sort_by = 'name' or p_sort_by is null then s.name end asc;
end;
$$;

-- Harden existing manage_* RPCs with explicit authz checks and row_security on
create or replace function public.manage_create_service(
  p_tenant_id uuid,
  p_name text,
  p_duration_min integer,
  p_price_cents integer,
  p_category text default 'General',
  p_buffer_min integer default 0,
  p_description text default null,
  p_media_url text default null,
  p_active boolean default true,
  p_pricing_levels jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_service_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  if not user_has_role_for_tenant(p_tenant_id, array['owner','admin']) then
    return jsonb_build_object('success', false, 'error', 'access_denied');
  end if;

  perform set_config('row_security', 'on', true);

  if length(trim(p_name)) = 0 then
    return jsonb_build_object('success', false, 'error', 'El nombre es obligatorio');
  end if;
  if p_duration_min < 5 then
    return jsonb_build_object('success', false, 'error', 'La duración mínima es de 5 minutos');
  end if;
  if p_price_cents < 0 then
    return jsonb_build_object('success', false, 'error', 'El precio no puede ser negativo');
  end if;
  if p_buffer_min < 0 then
    return jsonb_build_object('success', false, 'error', 'El buffer no puede ser negativo');
  end if;

  insert into services (
    tenant_id,
    name,
    duration_min,
    price_cents,
    category,
    buffer_min,
    description,
    media_url,
    active,
    pricing_levels,
    created_at,
    updated_at
  ) values (
    p_tenant_id,
    trim(p_name),
    p_duration_min,
    p_price_cents,
    coalesce(nullif(trim(p_category),''), 'General'),
    p_buffer_min,
    p_description,
    nullif(trim(p_media_url), ''),
    p_active,
    p_pricing_levels,
    now(),
    now()
  )
  returning id into v_service_id;

  return jsonb_build_object('success', true, 'service_id', v_service_id);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

create or replace function public.manage_update_service(
  p_service_id uuid,
  p_tenant_id uuid,
  p_name text,
  p_duration_min integer,
  p_price_cents integer,
  p_category text,
  p_buffer_min integer,
  p_description text,
  p_media_url text,
  p_active boolean,
  p_pricing_levels jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  if not user_has_role_for_tenant(p_tenant_id, array['owner','admin']) then
    return jsonb_build_object('success', false, 'error', 'access_denied');
  end if;

  perform set_config('row_security', 'on', true);

  if not exists (select 1 from services where id = p_service_id and tenant_id = p_tenant_id) then
    return jsonb_build_object('success', false, 'error', 'Servicio no encontrado o acceso denegado');
  end if;

  if length(trim(p_name)) = 0 then
    return jsonb_build_object('success', false, 'error', 'El nombre es obligatorio');
  end if;
  if p_duration_min < 5 then
    return jsonb_build_object('success', false, 'error', 'La duración mínima es de 5 minutos');
  end if;
  if p_price_cents < 0 then
    return jsonb_build_object('success', false, 'error', 'El precio no puede ser negativo');
  end if;
  if p_buffer_min < 0 then
    return jsonb_build_object('success', false, 'error', 'El buffer no puede ser negativo');
  end if;

  update services
  set
    name = trim(p_name),
    duration_min = p_duration_min,
    price_cents = p_price_cents,
    category = coalesce(nullif(trim(p_category),''), 'General'),
    buffer_min = p_buffer_min,
    description = p_description,
    media_url = nullif(trim(p_media_url), ''),
    active = p_active,
    pricing_levels = p_pricing_levels,
    updated_at = now()
  where id = p_service_id and tenant_id = p_tenant_id;

  return jsonb_build_object('success', true);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

create or replace function public.manage_duplicate_service(
  p_service_id uuid,
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_original services%rowtype;
  v_new_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  if not user_has_role_for_tenant(p_tenant_id, array['owner','admin']) then
    return jsonb_build_object('success', false, 'error', 'access_denied');
  end if;

  perform set_config('row_security', 'on', true);

  select * into v_original
  from services
  where id = p_service_id and tenant_id = p_tenant_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Servicio original no encontrado');
  end if;

  insert into services (
    tenant_id,
    name,
    duration_min,
    price_cents,
    category,
    buffer_min,
    description,
    active,
    pricing_levels,
    created_at,
    updated_at
  ) values (
    v_original.tenant_id,
    v_original.name || ' (copia)',
    v_original.duration_min,
    v_original.price_cents,
    v_original.category,
    v_original.buffer_min,
    v_original.description,
    false,
    v_original.pricing_levels,
    now(),
    now()
  ) returning id into v_new_id;

  return jsonb_build_object('success', true, 'service_id', v_new_id);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

create or replace function public.manage_delete_service(
  p_service_id uuid,
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  if not user_has_role_for_tenant(p_tenant_id, array['owner','admin']) then
    return jsonb_build_object('success', false, 'error', 'access_denied');
  end if;

  perform set_config('row_security', 'on', true);

  if not exists (select 1 from services where id = p_service_id and tenant_id = p_tenant_id) then
    return jsonb_build_object('success', false, 'error', 'Servicio no encontrado');
  end if;

  delete from services where id = p_service_id and tenant_id = p_tenant_id;

  return jsonb_build_object('success', true);
exception
  when foreign_key_violation then
    return jsonb_build_object('success', false, 'error', 'No se puede eliminar porque tiene citas asociadas. Archívalo en su lugar.');
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

-- Grants: only authenticated/service_role
grant execute on function public.manage_list_services(uuid,text,text,text,text,text,integer,integer,text) to authenticated;
grant execute on function public.manage_list_services(uuid,text,text,text,text,text,integer,integer,text) to service_role;

grant execute on function public.manage_create_service(uuid,text,integer,integer,text,integer,text,text,boolean,jsonb) to authenticated;
grant execute on function public.manage_update_service(uuid,uuid,text,integer,integer,text,integer,text,text,boolean,jsonb) to authenticated;
grant execute on function public.manage_duplicate_service(uuid,uuid) to authenticated;
grant execute on function public.manage_delete_service(uuid,uuid) to authenticated;

grant execute on function public.manage_create_service(uuid,text,integer,integer,text,integer,text,text,boolean,jsonb) to service_role;
grant execute on function public.manage_update_service(uuid,uuid,text,integer,integer,text,integer,text,text,boolean,jsonb) to service_role;
grant execute on function public.manage_duplicate_service(uuid,uuid) to service_role;
grant execute on function public.manage_delete_service(uuid,uuid) to service_role;


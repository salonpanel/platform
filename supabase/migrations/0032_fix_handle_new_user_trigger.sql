-- 0032_fix_handle_new_user_trigger.sql
-- Hacer el trigger handle_new_user más robusto para que no falle si las tablas no existen

-- Deshabilitar el trigger temporalmente
drop trigger if exists on_auth_user_created on auth.users;

-- Crear una versión mejorada del trigger que maneja errores graciosamente
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  new_tenant_id uuid;
begin
  -- Intentar crear tenant/org si la tabla existe
  -- Primero verificar si existe la tabla tenants
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'tenants') then
    begin
      new_tenant_id := gen_random_uuid();
      insert into public.tenants (id, name, slug)
      values (
        new_tenant_id,
        concat('Barbería de ', coalesce(new.raw_user_meta_data->>'name', 'nuevo usuario')),
        'barberia-' || substr(new.id::text, 1, 8)
      )
      on conflict do nothing;
    exception when others then
      -- Si falla, continuar sin crear tenant
      raise notice 'Error al crear tenant para usuario %: %', new.id, sqlerrm;
    end;
  end if;

  -- Intentar crear org si la tabla existe (compatibilidad con esquema antiguo)
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'orgs') then
    begin
      new_org_id := gen_random_uuid();
      insert into public.orgs (id, name)
      values (new_org_id, concat('Barbería de ', coalesce(new.raw_user_meta_data->>'name', 'nuevo usuario')))
      on conflict do nothing;
    exception when others then
      raise notice 'Error al crear org para usuario %: %', new.id, sqlerrm;
    end;
  end if;

  -- Intentar crear membership si la tabla existe y tenemos tenant_id
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'memberships')
     and new_tenant_id is not null then
    begin
      insert into public.memberships (tenant_id, user_id, role)
      values (new_tenant_id, new.id, 'owner')
      on conflict (tenant_id, user_id) do nothing;
    exception when others then
      raise notice 'Error al crear membership para usuario %: %', new.id, sqlerrm;
    end;
  end if;

  -- Intentar crear org_members si la tabla existe (compatibilidad)
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'org_members')
     and new_org_id is not null then
    begin
      insert into public.org_members (org_id, user_id, role)
      values (new_org_id, new.id, 'owner')
      on conflict (org_id, user_id) do nothing;
    exception when others then
      raise notice 'Error al crear org_member para usuario %: %', new.id, sqlerrm;
    end;
  end if;

  -- Intentar crear profile si la tabla existe
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') then
    begin
      insert into public.profiles (user_id, default_org_id)
      values (new.id, coalesce(new_org_id, new_tenant_id))
      on conflict (user_id) do update
      set default_org_id = coalesce(new_org_id, new_tenant_id, profiles.default_org_id);
    exception when others then
      raise notice 'Error al crear profile para usuario %: %', new.id, sqlerrm;
    end;
  end if;

  -- Siempre retornar new, incluso si hubo errores
  return new;
end;
$$;

-- Recrear el trigger
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

comment on function public.handle_new_user is 
  'Trigger mejorado que crea tenant/org y membership/profile para nuevos usuarios. Maneja errores graciosamente y no falla si las tablas no existen.';







-- Security fixes: JWT tenant claim updates and triggers
-- FASE 1: Unificar modelo multi-tenant con JWT tenant claim

-- Actualizar función para manejar cambios en memberships
create or replace function auth.update_tenant_claim()
returns trigger
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
begin
  -- Si se elimina membership, verificar si quedan otros
  if TG_OP = 'DELETE' then
    select tenant_id into v_tenant_id
    from public.memberships
    where user_id = old.user_id
    order by created_at asc
    limit 1;

    -- Si no quedan memberships, remover tenant_id del JWT
    if v_tenant_id is null then
      update auth.users
      set raw_app_meta_data = raw_app_meta_data - 'tenant_id'
      where id = old.user_id;
    else
      -- Si quedan, actualizar al siguiente tenant
      update auth.users
      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('tenant_id', v_tenant_id::text)
      where id = old.user_id;
    end if;

    return old;
  end if;

  -- Para INSERT o UPDATE, obtener el primer tenant_id
  select tenant_id into v_tenant_id
  from public.memberships
  where user_id = new.user_id
  order by created_at asc
  limit 1;

  if v_tenant_id is not null then
    update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('tenant_id', v_tenant_id::text)
    where id = new.user_id;
  end if;

  return new;
end;
$$;

-- Reemplazar trigger para manejar INSERT, UPDATE, DELETE
drop trigger if exists on_membership_created on public.memberships;
create trigger on_membership_change
  after insert or update or delete on public.memberships
  for each row
  execute function auth.update_tenant_claim();

-- Nota: Para forzar reemisión de token cuando cambia tenant,
-- se requiere logout del usuario. Esto debe manejarse en la aplicación.
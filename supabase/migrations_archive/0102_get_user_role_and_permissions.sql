-- RPC: get_user_role_and_permissions
-- Devuelve el rol y los permisos del usuario para un tenant en una sola consulta

create or replace function public.get_user_role_and_permissions(
  p_user_id uuid,
  p_tenant_id uuid
)
returns table (
  role text,
  permissions jsonb
) language sql stable as $$
  select 
    m.role,
    case 
      -- Si es owner o admin, devolver permisos completos
      when m.role in ('owner', 'admin') then 
        '{"dashboard":true,"agenda":true,"clientes":true,"servicios":true,"staff":true,"marketing":true,"reportes":true,"ajustes":true}'::jsonb
      -- Para otros roles, usar permisos de la tabla o permisos por defecto restrictivos
      else
        coalesce(up.permissions, '{"dashboard":true,"agenda":true,"clientes":true,"servicios":false,"staff":false,"marketing":false,"reportes":false,"ajustes":false}'::jsonb)
    end as permissions
  from public.memberships m
  left join public.user_permissions up
    on up.user_id = m.user_id and up.tenant_id = m.tenant_id
  where m.user_id = p_user_id and m.tenant_id = p_tenant_id
  limit 1;
$$;

comment on function public.get_user_role_and_permissions is 'Devuelve el rol y los permisos del usuario para un tenant en una sola consulta.';

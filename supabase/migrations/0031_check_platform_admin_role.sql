-- 0031_check_platform_admin_role.sql
-- Función helper para verificar si un usuario tiene rol admin o support (no solo viewer)

create or replace function public.check_platform_admin_role(
  p_user_id uuid,
  p_allowed_roles text[] default array['admin', 'support']
)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_user_role text;
begin
  select role into v_user_role
  from platform.platform_users
  where id = p_user_id
    and active = true;
  
  if v_user_role is null then
    return false;
  end if;
  
  return v_user_role = any(p_allowed_roles);
end;
$$;

comment on function public.check_platform_admin_role is 
  'Verifica si un usuario platform tiene uno de los roles permitidos (admin o support por defecto). 
   Los viewers no tienen permisos de modificación.';









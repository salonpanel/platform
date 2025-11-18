-- 0012_add_check_platform_admin.sql
-- Función helper para verificar platform admin (accesible desde cliente)

create or replace function public.check_platform_admin(p_user_id uuid)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_is_admin boolean;
begin
  select exists (
    select 1
    from platform.platform_users
    where id = p_user_id
      and active = true
  ) into v_is_admin;
  
  return coalesce(v_is_admin, false);
end;
$$;








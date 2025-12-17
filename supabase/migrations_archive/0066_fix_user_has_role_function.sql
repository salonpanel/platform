-- Evita recursión en memberships al evaluar políticas que usan user_has_role_for_tenant

set check_function_bodies = off;

create or replace function public.user_has_role_for_tenant(target_tenant uuid, allowed_roles text[])
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  has_role boolean;
begin
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = target_tenant
      and (allowed_roles is null or m.role = any(allowed_roles))
  )
  into has_role;

  return has_role;
end;
$$;

grant execute on function public.user_has_role_for_tenant(uuid, text[]) to authenticated, anon;





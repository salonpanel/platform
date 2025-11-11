-- 0008_handle_new_user.sql

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid := gen_random_uuid();
begin
  insert into public.orgs (id, name)
  values (new_org_id, concat('Barbería de ', coalesce(new.raw_user_meta_data->>'name', 'nuevo usuario')));

  insert into public.org_members (org_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  insert into public.profiles (user_id, default_org_id)
  values (new.id, new_org_id)
  on conflict (user_id) do update
  set default_org_id = excluded.default_org_id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();


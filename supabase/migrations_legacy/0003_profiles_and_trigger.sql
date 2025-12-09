-- 0003_profiles_and_trigger.sql

create table if not exists public.profiles (
  user_id uuid primary key,
  default_org_id uuid references public.orgs(id),
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "users can manage own profile"
on public.profiles
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.fn_add_member(p_org uuid, p_user uuid, p_role text)
returns void
language plpgsql
as $$
begin
  insert into public.org_members (org_id, user_id, role)
  values (p_org, p_user, p_role)
  on conflict (org_id, user_id) do update set role = excluded.role;
end;
$$;


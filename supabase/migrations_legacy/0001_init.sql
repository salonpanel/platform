-- 0001_init.sql
create extension if not exists "pgcrypto";

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table public.org_members (
  org_id uuid references public.orgs(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner','admin','manager','staff')),
  primary key (org_id, user_id),
  created_at timestamptz default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text,
  email text,
  phone text,
  created_at timestamptz default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  duration_min int not null check (duration_min > 0),
  price_cents int not null check (price_cents >= 0),
  active boolean default true,
  created_at timestamptz default now()
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  skills text[],
  created_at timestamptz default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  staff_id uuid references public.staff(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  status text not null check (status in ('hold','confirmed','cancelled','noshow')),
  source text default 'web',
  created_by uuid,
  created_at timestamptz default now()
);

alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.customers enable row level security;
alter table public.services enable row level security;
alter table public.staff enable row level security;
alter table public.appointments enable row level security;

create policy "org members can select their orgs"
on public.orgs for select
using (exists (select 1 from public.org_members m where m.org_id = orgs.id and m.user_id = auth.uid()));

create policy "org members read org_members"
on public.org_members for select
using (exists (select 1 from public.org_members m where m.org_id = org_members.org_id and m.user_id = auth.uid()));

create policy "org members manage customers"
on public.customers for all
using (exists (select 1 from public.org_members m where m.org_id = customers.org_id and m.user_id = auth.uid()))
with check (exists (select 1 from public.org_members m where m.org_id = customers.org_id and m.user_id = auth.uid()));

create policy "org members manage services"
on public.services for all
using (exists (select 1 from public.org_members m where m.org_id = services.org_id and m.user_id = auth.uid()))
with check (exists (select 1 from public.org_members m where m.org_id = services.org_id and m.user_id = auth.uid()));

create policy "org members manage staff"
on public.staff for all
using (exists (select 1 from public.org_members m where m.org_id = staff.org_id and m.user_id = auth.uid()))
with check (exists (select 1 from public.org_members m where m.org_id = staff.org_id and m.user_id = auth.uid()));

create policy "org members manage appointments"
on public.appointments for all
using (exists (select 1 from public.org_members m where m.org_id = appointments.org_id and m.user_id = auth.uid()))
with check (exists (select 1 from public.org_members m where m.org_id = appointments.org_id and m.user_id = auth.uid()));

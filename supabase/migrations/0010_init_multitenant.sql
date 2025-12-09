-- 0010_init_multitenant.sql
-- Esquema multi-tenant completo con RLS

-- 0) Migración de transición: renombrar orgs a tenants si es necesario
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'orgs')
     and not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'tenants') then
    alter table public.orgs rename to tenants;
  end if;
end $$;

-- Renombrar org_id a tenant_id si es necesario
do $$
declare
  r record;
begin
  for r in 
    select table_name
    from information_schema.columns
    where table_schema = 'public' 
      and column_name = 'org_id'
      and table_name in ('org_members', 'customers', 'services', 'staff', 'appointments')
  loop
    if not exists (
      select 1 from information_schema.columns c2
      where c2.table_schema = 'public'
        and c2.table_name = r.table_name
        and c2.column_name = 'tenant_id'
    ) then
      execute format('alter table public.%I rename column org_id to tenant_id', r.table_name);
    end if;
  end loop;
end $$;

-- 1) Tenants
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Añadir slug si no existe
alter table public.tenants add column if not exists slug text;

-- Generar slugs únicos para tenants existentes sin slug
do $$
declare
  r record;
  base_slug text;
  final_slug text;
  counter int;
begin
  for r in select id, name from public.tenants where slug is null or slug = '' loop
    base_slug := lower(regexp_replace(r.name, '[^a-z0-9]+', '-', 'g'));
    final_slug := base_slug;
    counter := 0;
    
    while exists (select 1 from public.tenants where slug = final_slug and id != r.id) loop
      counter := counter + 1;
      final_slug := base_slug || '-' || counter;
    end loop;
    
    update public.tenants set slug = final_slug where id = r.id;
  end loop;
end $$;

-- Añadir constraints de slug si no existen
do $$
begin
  -- Eliminar duplicados restantes
  update public.tenants t1
  set slug = slug || '-' || substr(t1.id::text, 1, 8)
  where exists (
    select 1 from public.tenants t2 
    where t2.slug = t1.slug and t2.id != t1.id
  );
  
  -- Añadir constraint unique si no existe
  if not exists (
    select 1 from pg_constraint 
    where conname = 'tenants_slug_key'
  ) then
    alter table public.tenants add constraint tenants_slug_key unique (slug);
  end if;
  
  -- Añadir check constraint si no existe
  if not exists (
    select 1 from pg_constraint 
    where conname = 'tenants_slug_check'
  ) then
    alter table public.tenants add constraint tenants_slug_check 
    check (slug is null or slug ~ '^[a-z0-9-]+$');
  end if;
  
  -- Hacer slug NOT NULL solo si todos los tenants tienen slug
  if not exists (select 1 from public.tenants where slug is null or slug = '') then
    alter table public.tenants alter column slug set not null;
  end if;
end $$;

create index if not exists idx_tenants_slug on public.tenants(slug);

-- 2) Users (perfil app, enlazado a auth.users)
create table if not exists public.users (
  id uuid primary key, -- = auth.users.id
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null check (role in ('owner','manager','staff','viewer')),
  created_at timestamptz default now()
);

create index on public.users(tenant_id);
create index on public.users(id, tenant_id);

-- 3) Customers
-- Si la tabla ya existe, solo añadir columnas/índices que falten
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'customers') then
    create table public.customers (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid not null references public.tenants(id) on delete cascade,
      email text,
      phone text,
      name text not null,
      created_at timestamptz default now()
    );
  end if;
end $$;

-- Añadir índices si no existen
create index if not exists idx_customers_tenant_email on public.customers(tenant_id, email) where email is not null;
create index if not exists idx_customers_tenant_phone on public.customers(tenant_id, phone) where phone is not null;

-- 4) Staff
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  skills text[],
  created_at timestamptz default now()
);

-- Añadir columnas nuevas si no existen
alter table public.staff add column if not exists user_id uuid references public.users(id) on delete set null;
alter table public.staff add column if not exists display_name text;
alter table public.staff add column if not exists active boolean default true;

-- Si display_name no existe pero name sí, copiar name a display_name
update public.staff set display_name = name where display_name is null and name is not null;

-- Hacer display_name NOT NULL si todos tienen valor
do $$
begin
  if not exists (select 1 from public.staff where display_name is null) then
    alter table public.staff alter column display_name set not null;
  end if;
end $$;

create index if not exists idx_staff_tenant_active on public.staff(tenant_id, active);
create index if not exists idx_staff_tenant_user on public.staff(tenant_id, user_id);

-- 5) Services
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  duration_min int not null check (duration_min > 0),
  price_cents int not null check (price_cents >= 0),
  active boolean default true,
  created_at timestamptz default now()
);

create index on public.services(tenant_id, active);

-- 6) Schedules (ventanas de trabajo del staff)
create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz default now(),
  check (start_time < end_time)
);


-- Proteger todas las sentencias sobre public.schedules
do $$
begin
  if to_regclass('public.schedules') is not null then
    create index if not exists on public.schedules(tenant_id, staff_id, weekday);
    alter table public.schedules enable row level security;
    create policy if not exists "tenant_read_schedules" on public.schedules
      for select using (tenant_id = app.current_tenant_id());
    create policy if not exists "tenant_crud_schedules" on public.schedules
      for all using (tenant_id = app.current_tenant_id())
      with check (tenant_id = app.current_tenant_id());
  end if;
end $$;

create index on public.bookings(tenant_id, starts_at, status);
create index on public.bookings(tenant_id, customer_id);
create index on public.bookings(tenant_id, staff_id, starts_at);

-- 8) Helper: función para resolver tenant del usuario logado
create schema if not exists app;

create or replace function app.current_tenant_id()
returns uuid
language sql
security definer
stable
as $$
  select tenant_id
  from public.users
  where id = auth.uid()
  limit 1
$$;

-- 9) Activar RLS
alter table public.tenants enable row level security;
alter table public.users enable row level security;
alter table public.customers enable row level security;
alter table public.staff enable row level security;
alter table public.services enable row level security;
alter table public.bookings enable row level security;

-- 10) Políticas: solo datos de tu tenant

-- Tenants
create policy "tenant_read_tenants" on public.tenants
for select using (id = app.current_tenant_id());

-- Users
create policy "tenant_read_users" on public.users
for select using (tenant_id = app.current_tenant_id());

create policy "tenant_modify_users" on public.users
for all using (tenant_id = app.current_tenant_id()) 
with check (tenant_id = app.current_tenant_id());

-- Customers
create policy "tenant_read_customers" on public.customers
for select using (tenant_id = app.current_tenant_id());

create policy "tenant_crud_customers" on public.customers
for all using (tenant_id = app.current_tenant_id()) 
with check (tenant_id = app.current_tenant_id());

-- Staff
create policy "tenant_read_staff" on public.staff
for select using (tenant_id = app.current_tenant_id());

create policy "tenant_crud_staff" on public.staff
for all using (tenant_id = app.current_tenant_id()) 
with check (tenant_id = app.current_tenant_id());

-- Services
create policy "tenant_read_services" on public.services
for select using (tenant_id = app.current_tenant_id());

create policy "tenant_crud_services" on public.services
for all using (tenant_id = app.current_tenant_id()) 
with check (tenant_id = app.current_tenant_id());

-- Schedules

-- Bookings
create policy "tenant_read_bookings" on public.bookings
for select using (tenant_id = app.current_tenant_id());

create policy "tenant_crud_bookings" on public.bookings
for all using (tenant_id = app.current_tenant_id()) 
with check (tenant_id = app.current_tenant_id());


-- 11) Vista de disponibilidad (solo si existe schedules)
do $$
begin
  if to_regclass('public.schedules') is not null then
    execute $$
      create or replace view public.vw_staff_availability as
      select 
        s.tenant_id, 
        s.id as staff_id,
        s.display_name,
        sch.weekday, 
        sch.start_time, 
        sch.end_time
      from public.staff s
      join public.schedules sch on sch.staff_id = s.id and sch.tenant_id = s.tenant_id
      where s.active = true;
    $$;
  end if;
end $$;

-- 12) Seeds mínimos (tenant demo + datos de ejemplo)
-- Nota: El usuario debe crearse manualmente vinculando auth.users.id con public.users.id

-- Tenant demo
insert into public.tenants (id, slug, name)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'demo-barber', 'Demo Barber')
on conflict (id) do nothing;

-- Staff demo (sin user_id por ahora, se vinculará después)
insert into public.staff (id, tenant_id, name, display_name, active)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Barbero Demo', 'Barbero Demo', true)
on conflict (id) do update set 
  name = excluded.name,
  display_name = excluded.display_name,
  active = excluded.active;

-- Servicios demo
insert into public.services (id, tenant_id, name, duration_min, price_cents, active)
values 
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Corte Básico', 30, 1500, true),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Barba', 20, 1000, true)
on conflict (id) do nothing;


-- Horario demo (Lunes a Viernes, 9:00-18:00) solo si existe schedules
do $$
begin
  if to_regclass('public.schedules') is not null then
    insert into public.schedules (tenant_id, staff_id, weekday, start_time, end_time)
    select 
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      weekday,
      '09:00'::time,
      '18:00'::time
    from generate_series(0, 4) as weekday
    on conflict do nothing;
  end if;
end $$;


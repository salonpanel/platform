-- 0018_booking_system_complete.sql
-- Sistema completo de reservas: memberships, payment_intents, appointments (adaptación de bookings), logs
-- y políticas RLS para lectura pública de disponibilidad

-- 1) Memberships (relación usuario-tenant con roles)
-- Permite que un usuario pertenezca a múltiples tenants con diferentes roles
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','staff','viewer')),
  created_at timestamptz default now(),
  unique(tenant_id, user_id)
);

create index on public.memberships(tenant_id);
create index on public.memberships(user_id);
create index on public.memberships(tenant_id, user_id);

-- Migrar datos de users a memberships si existen
do $$
declare
  v_user_record record;
begin
  for v_user_record in 
    select id, tenant_id, role 
    from public.users 
    where not exists (
      select 1 from public.memberships m 
      where m.user_id = users.id and m.tenant_id = users.tenant_id
    )
  loop
    insert into public.memberships (tenant_id, user_id, role)
    values (v_user_record.tenant_id, v_user_record.id, v_user_record.role)
    on conflict (tenant_id, user_id) do nothing;
  end loop;
end $$;

-- 2) Payment Intents (intentos de pago simulados o reales)
create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  service_id uuid not null references public.services(id) on delete restrict,
  amount_cents int not null check (amount_cents > 0),
  status text not null default 'requires_payment' check (status in ('requires_payment','paid','failed','cancelled')),
  payment_provider text default 'mock', -- 'mock', 'stripe', etc.
  payment_provider_id text, -- ID del proveedor externo (Stripe, etc.)
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  expires_at timestamptz -- TTL para intents no pagados
);

create index on public.payment_intents(tenant_id, status);
create index on public.payment_intents(tenant_id, customer_id);
create index on public.payment_intents(tenant_id, service_id);
create index on public.payment_intents(status, expires_at) where status = 'requires_payment';

-- 3) Appointments (alias para bookings, mantiene compatibilidad)
-- Usamos bookings como tabla principal, pero añadimos vista o función helper si hace falta
-- Por ahora, bookings ya existe, solo añadimos campos si faltan

-- Añadir campos a bookings si no existen
alter table public.bookings 
  add column if not exists payment_intent_id uuid references public.payment_intents(id) on delete set null;

-- Actualizar referencia de payment_intent_id de text a uuid si es necesario
do $$
begin
  -- Si payment_intent_id es text y queremos migrarlo a uuid, lo haremos después
  -- Por ahora mantenemos ambos: text para Stripe IDs externos, uuid para nuestros payment_intents
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
      and table_name = 'bookings' 
      and column_name = 'payment_intent_id' 
      and data_type = 'text'
  ) then
    -- Renombrar columna antigua
    alter table public.bookings rename column payment_intent_id to payment_provider_id;
    -- Añadir nueva columna uuid
    alter table public.bookings add column if not exists payment_intent_id uuid references public.payment_intents(id) on delete set null;
  end if;
end $$;

-- 4) Logs básicos (registro de acciones importantes)
create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null, -- 'booking_created', 'payment_completed', 'booking_cancelled', etc.
  resource_type text, -- 'booking', 'payment_intent', 'customer', etc.
  resource_id uuid,
  metadata jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz default now()
);

create index on public.logs(tenant_id, created_at desc);
create index on public.logs(user_id, created_at desc);
create index on public.logs(resource_type, resource_id);
create index on public.logs(action, created_at desc);

-- 5) Ajustar función current_tenant_id para usar memberships
create or replace function app.current_tenant_id()
returns uuid
language sql
security definer
stable
as $$
  select tenant_id
  from public.memberships
  where user_id = auth.uid()
  limit 1
$$;

-- 6) Helper: función para verificar rol del usuario en un tenant
create or replace function app.user_has_role(
  p_tenant_id uuid,
  p_user_id uuid default auth.uid(),
  p_roles text[] default array['owner','admin','staff']
)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_role text;
begin
  select role into v_role
  from public.memberships
  where tenant_id = p_tenant_id
    and user_id = p_user_id;
  
  return v_role = any(p_roles);
end;
$$;

-- 7) Activar RLS en nuevas tablas
alter table public.memberships enable row level security;
alter table public.payment_intents enable row level security;
alter table public.logs enable row level security;

-- 8) Políticas RLS para memberships
-- Los usuarios solo ven sus propios memberships
create policy "users_read_own_memberships" on public.memberships
for select using (user_id = auth.uid() or tenant_id = app.current_tenant_id());

-- Solo owners/admins pueden modificar memberships de su tenant
create policy "admins_manage_memberships" on public.memberships
for all using (
  tenant_id = app.current_tenant_id() 
  and app.user_has_role(tenant_id, auth.uid(), array['owner','admin'])
)
with check (
  tenant_id = app.current_tenant_id() 
  and app.user_has_role(tenant_id, auth.uid(), array['owner','admin'])
);

-- 9) Políticas RLS para payment_intents
-- Los usuarios del tenant pueden ver payment_intents de su tenant
create policy "tenant_read_payment_intents" on public.payment_intents
for select using (tenant_id = app.current_tenant_id());

-- Los usuarios pueden crear payment_intents (público para checkout)
-- La validación de tenant_id se hace a nivel de aplicación
create policy "public_create_payment_intents" on public.payment_intents
for insert with check (true); -- Validación en aplicación

-- Solo el sistema puede actualizar payment_intents (vía service_role)
-- Los usuarios normales no pueden modificar payment_intents directamente

-- 10) Políticas RLS para logs
-- Los usuarios del tenant pueden ver logs de su tenant
create policy "tenant_read_logs" on public.logs
for select using (tenant_id = app.current_tenant_id() or tenant_id is null);

-- Solo el sistema puede crear logs (vía service_role o triggers)
-- Los usuarios normales no pueden crear logs directamente

-- 11) Ajustar políticas RLS existentes para lectura pública de disponibilidad
-- Servicios: lectura pública para endpoints de disponibilidad
drop policy if exists "public_read_services" on public.services;
create policy "public_read_services" on public.services
for select using (active = true); -- Lectura pública de servicios activos

-- Schedules: lectura pública para endpoints de disponibilidad
drop policy if exists "public_read_schedules" on public.schedules;
create policy "public_read_schedules" on public.schedules
for select using (
  exists (
    select 1 from public.staff s
    where s.id = schedules.staff_id
      and s.active = true
  )
);

-- Staff: lectura pública de staff activo (solo para disponibilidad)
drop policy if exists "public_read_staff" on public.staff;
create policy "public_read_staff" on public.staff
for select using (active = true); -- Lectura pública de staff activo

-- Mantener políticas existentes para escritura (solo miembros del tenant)
-- Las políticas de escritura ya existen y siguen aplicando

-- 12) Trigger para actualizar updated_at en payment_intents
create or replace function update_payment_intents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger payment_intents_updated_at
before update on public.payment_intents
for each row
execute function update_payment_intents_updated_at();

-- 13) Función helper para crear log (en public para acceso desde service_role)
create or replace function public.create_log(
  p_tenant_id uuid,
  p_user_id uuid,
  p_action text,
  p_resource_type text default null,
  p_resource_id uuid default null,
  p_metadata jsonb default null,
  p_ip_address inet default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_log_id uuid;
begin
  insert into public.logs (
    tenant_id,
    user_id,
    action,
    resource_type,
    resource_id,
    metadata,
    ip_address,
    user_agent
  )
  values (
    p_tenant_id,
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_metadata,
    p_ip_address,
    p_user_agent
  )
  returning id into v_log_id;
  
  return v_log_id;
end;
$$;

-- 14) Comentarios para documentación
comment on table public.memberships is 
  'Relación usuario-tenant con roles. Permite que un usuario pertenezca a múltiples tenants.';

comment on table public.payment_intents is 
  'Intentos de pago (mock o reales) para reservas. Estado: requires_payment -> paid -> booking creado.';

comment on table public.logs is 
  'Registro de acciones importantes del sistema (bookings, pagos, etc.).';

comment on function app.user_has_role is 
  'Verifica si un usuario tiene uno de los roles especificados en un tenant.';

comment on function public.create_log is 
  'Crea un log de acción. Usar desde service_role o triggers.';


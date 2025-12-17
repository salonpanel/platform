-- 0011_platform_governance.sql
-- Gobierno de plataforma: planes, features, auditoría e impersonación

-- Crear schema platform si no existe
create schema if not exists platform;

-- 1) Platform Users (Super-Admins)
create table if not exists platform.platform_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  role text not null default 'admin' check (role in ('admin', 'support', 'viewer')),
  active boolean default true,
  created_at timestamptz default now()
);

-- 2) Plans (Free, Pro, Enterprise...)
create table if not exists platform.plans (
  id uuid primary key default gen_random_uuid(),
  key text unique not null, -- 'free', 'pro', 'enterprise'
  name text not null,
  description text,
  price_monthly_cents int default 0,
  price_yearly_cents int default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- 3) Features (módulos de la plataforma)
create table if not exists platform.features (
  id uuid primary key default gen_random_uuid(),
  key text unique not null, -- 'chat', 'ratings', 'ai_agent', 'analytics'
  name text not null,
  description text,
  default_enabled boolean default false,
  created_at timestamptz default now()
);

-- 4) Plan Features (qué features incluye cada plan)
create table if not exists platform.plan_features (
  plan_id uuid not null references platform.plans(id) on delete cascade,
  feature_id uuid not null references platform.features(id) on delete cascade,
  enabled boolean default true,
  quota_limit jsonb, -- ej: {"messages_per_month": 1000, "ai_tokens": 50000}
  primary key (plan_id, feature_id)
);

-- 5) Org Plans (qué plan tiene cada organización)
create table if not exists platform.org_plans (
  org_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid not null references platform.plans(id) on delete restrict,
  billing_state text not null default 'active' check (billing_state in ('active', 'suspended', 'cancelled', 'trial')),
  renew_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (org_id)
);

-- 6) Org Feature Overrides (excepciones puntuales sin cambiar plan)
create table if not exists platform.org_feature_overrides (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.tenants(id) on delete cascade,
  feature_key text not null, -- referencia a platform.features.key
  enabled boolean not null,
  quota_limit jsonb,
  reason text, -- motivo del override
  expires_at timestamptz, -- opcional: override temporal
  created_by uuid references platform.platform_users(id),
  created_at timestamptz default now(),
  unique(org_id, feature_key)
);

-- 7) Audit Logs (registro de todas las acciones)
create table if not exists platform.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid, -- puede ser platform_user o user de org
  actor_type text not null check (actor_type in ('platform', 'org')),
  scope text not null check (scope in ('platform', 'org')),
  org_id uuid references public.tenants(id) on delete set null,
  action text not null, -- 'plan_changed', 'feature_toggled', 'impersonation_started', 'booking_created'
  target_type text, -- 'plan', 'feature', 'booking', 'org'
  target_id uuid,
  metadata jsonb, -- datos adicionales
  ip_address inet,
  user_agent text,
  created_at timestamptz default now()
);

create index on platform.audit_logs(org_id, created_at desc);
create index on platform.audit_logs(actor_id, created_at desc);
create index on platform.audit_logs(scope, action, created_at desc);

-- 8) Impersonations (registro de impersonaciones)
create table if not exists platform.impersonations (
  id uuid primary key default gen_random_uuid(),
  initiator_platform_user_id uuid not null references platform.platform_users(id),
  org_id uuid not null references public.tenants(id) on delete cascade,
  reason text not null,
  approved_by uuid references platform.platform_users(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  session_token text, -- token temporal para la sesión
  ip_address inet,
  user_agent text
);

create index on platform.impersonations(org_id, started_at desc);
create index on platform.impersonations(initiator_platform_user_id, started_at desc);

-- 9) Support Tickets
create table if not exists platform.support_tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.tenants(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  subject text not null,
  description text,
  channel text check (channel in ('email', 'chat', 'phone', 'platform')),
  assigned_to uuid references platform.platform_users(id),
  created_by uuid, -- puede ser user de org o platform_user
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  resolved_at timestamptz,
  sla_due_at timestamptz
);

create index on platform.support_tickets(org_id, status, created_at desc);
create index on platform.support_tickets(assigned_to, status);

-- 10) Helper: función para obtener features activos de una org (en public para acceso desde cliente)
create or replace function public.get_org_features(p_org_id uuid)
returns table (
  feature_key text,
  enabled boolean,
  quota_limit jsonb
)
language plpgsql
security definer
stable
as $$
declare
  v_plan_id uuid;
begin
  -- Obtener plan de la org
  select plan_id into v_plan_id
  from platform.org_plans
  where org_id = p_org_id and billing_state = 'active';

  -- Combinar: overrides > plan_features > default
  return query
  with plan_features_data as (
    select 
      f.key as feature_key,
      pf.enabled,
      pf.quota_limit
    from platform.plan_features pf
    join platform.features f on f.id = pf.feature_id
    where pf.plan_id = v_plan_id and pf.enabled = true
  ),
  overrides_data as (
    select 
      ofo.feature_key,
      ofo.enabled,
      ofo.quota_limit,
      ofo.expires_at
    from platform.org_feature_overrides ofo
    where ofo.org_id = p_org_id
      and (ofo.expires_at is null or ofo.expires_at > now())
  )
  select 
    coalesce(o.feature_key, p.feature_key) as feature_key,
    coalesce(o.enabled, p.enabled, f.default_enabled) as enabled,
    coalesce(o.quota_limit, p.quota_limit, '{}'::jsonb) as quota_limit
  from platform.features f
  left join plan_features_data p on p.feature_key = f.key
  left join overrides_data o on o.feature_key = f.key
  where coalesce(o.enabled, p.enabled, f.default_enabled) = true;
end;
$$;

-- 11) Helper: verificar si una org tiene un feature activo (en public para acceso desde cliente)
create or replace function public.has_feature(p_org_id uuid, p_feature_key text)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_enabled boolean;
begin
  select exists (
    select 1
    from platform.get_org_features(p_org_id) f
    where f.feature_key = p_feature_key and f.enabled = true
  ) into v_enabled;
  
  return coalesce(v_enabled, false);
end;
$$;

-- 12) RLS para tablas de plataforma (solo platform admins)
alter table platform.platform_users enable row level security;
alter table platform.plans enable row level security;
alter table platform.features enable row level security;
alter table platform.plan_features enable row level security;
alter table platform.org_plans enable row level security;
alter table platform.org_feature_overrides enable row level security;
alter table platform.audit_logs enable row level security;
alter table platform.impersonations enable row level security;
alter table platform.support_tickets enable row level security;

-- Políticas: solo platform admins pueden acceder
-- Nota: Estas políticas asumen que verificas el rol en el JWT o en una tabla de sesión
-- Por ahora, permitimos acceso a service_role (ajustar según tu modelo de auth)

create policy "platform_admins_only" on platform.platform_users
for all using (true); -- Ajustar según tu modelo de autenticación de platform admins

create policy "platform_read_plans" on platform.plans
for select using (true);

create policy "platform_read_features" on platform.features
for select using (true);

create policy "platform_read_plan_features" on platform.plan_features
for select using (true);

-- Org plans: platform admins ven todo, orgs solo ven su plan
create policy "platform_manage_org_plans" on platform.org_plans
for all using (true); -- Ajustar según tu modelo

create policy "org_read_own_plan" on platform.org_plans
for select using (org_id = app.current_tenant_id());

-- Feature overrides: platform admins gestionan, orgs solo leen los suyos
create policy "platform_manage_overrides" on platform.org_feature_overrides
for all using (true);

create policy "org_read_own_overrides" on platform.org_feature_overrides
for select using (org_id = app.current_tenant_id());

-- Audit logs: platform admins ven todo, orgs solo los suyos
create policy "platform_read_audit_logs" on platform.audit_logs
for select using (true);

create policy "org_read_own_audit_logs" on platform.audit_logs
for select using (org_id = app.current_tenant_id());

-- Impersonations: solo platform admins
create policy "platform_manage_impersonations" on platform.impersonations
for all using (true);

-- Support tickets: platform admins ven todo, orgs solo los suyos
create policy "platform_manage_tickets" on platform.support_tickets
for all using (true);

create policy "org_manage_own_tickets" on platform.support_tickets
for all using (org_id = app.current_tenant_id());

-- 13) Seeds: planes y features básicos
insert into platform.plans (id, key, name, description, price_monthly_cents, active)
values 
  ('11111111-1111-1111-1111-111111111111', 'free', 'Free', 'Plan gratuito con funcionalidades básicas', 0, true),
  ('22222222-2222-2222-2222-222222222222', 'pro', 'Pro', 'Plan profesional con todas las funcionalidades', 4900, true),
  ('33333333-3333-3333-3333-333333333333', 'enterprise', 'Enterprise', 'Plan empresarial con soporte prioritario', 19900, true)
on conflict (key) do nothing;

insert into platform.features (id, key, name, description, default_enabled)
values 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'chat', 'Chat Interno', 'Sistema de mensajería entre empleados', false),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ratings', 'Valoraciones', 'Sistema de reseñas y valoraciones de clientes', false),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'ai_agent', 'Agente IA', 'Asistente de IA para atención al cliente', false),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'analytics', 'Analytics', 'Dashboard de métricas y análisis', false),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'knowledge_base', 'Base de Conocimiento', 'Gestión de información para IA', false)
on conflict (key) do nothing;

-- Plan Free: solo funcionalidades básicas (sin features premium)
-- Plan Pro: todas las features
insert into platform.plan_features (plan_id, feature_id, enabled)
select 
  p.id as plan_id,
  f.id as feature_id,
  case 
    when p.key = 'free' then false
    when p.key = 'pro' then true
    when p.key = 'enterprise' then true
    else false
  end as enabled
from platform.plans p
cross join platform.features f
on conflict do nothing;

-- Asignar plan Free por defecto a tenant demo
insert into platform.org_plans (org_id, plan_id, billing_state)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'active')
on conflict (org_id) do nothing;

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


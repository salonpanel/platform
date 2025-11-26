-- Migration: User Permissions System
-- Permite control granular de permisos por usuario y tenant

-- Tabla de permisos de usuario
create table if not exists public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  
  -- Permisos granulares por sección
  permissions jsonb not null default '{
    "dashboard": true,
    "agenda": true,
    "clientes": true,
    "servicios": true,
    "staff": false,
    "marketing": false,
    "reportes": true,
    "ajustes": false
  }'::jsonb,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Un usuario solo puede tener un registro de permisos por tenant
  unique(user_id, tenant_id)
);

-- Índices para rendimiento
create index if not exists idx_user_permissions_user_id on public.user_permissions(user_id);
create index if not exists idx_user_permissions_tenant_id on public.user_permissions(tenant_id);
create index if not exists idx_user_permissions_user_tenant on public.user_permissions(user_id, tenant_id);

-- RLS Policies
alter table public.user_permissions enable row level security;

-- Los usuarios pueden ver sus propios permisos
create policy "Users can view their own permissions"
  on public.user_permissions
  for select
  using (auth.uid() = user_id);

-- Los owners y admins pueden ver todos los permisos de su tenant
create policy "Owners and admins can view all permissions in their tenant"
  on public.user_permissions
  for select
  using (
    exists (
      select 1 from memberships
      where memberships.user_id = auth.uid()
        and memberships.tenant_id = user_permissions.tenant_id
        and memberships.role in ('owner', 'admin')
    )
  );

-- Solo owners y admins pueden crear/actualizar permisos
create policy "Owners and admins can manage permissions"
  on public.user_permissions
  for all
  using (
    exists (
      select 1 from memberships
      where memberships.user_id = auth.uid()
        and memberships.tenant_id = user_permissions.tenant_id
        and memberships.role in ('owner', 'admin')
    )
  );

-- Trigger para updated_at
create or replace function update_user_permissions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_user_permissions_updated_at
  before update on public.user_permissions
  for each row
  execute function update_user_permissions_updated_at();

-- Función helper para obtener permisos de un usuario
create or replace function get_user_permissions(p_user_id uuid, p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_permissions jsonb;
  v_role text;
begin
  -- Obtener el rol del usuario
  select role into v_role
  from memberships
  where user_id = p_user_id and tenant_id = p_tenant_id;
  
  -- Owners y admins tienen todos los permisos
  if v_role in ('owner', 'admin') then
    return '{
      "dashboard": true,
      "agenda": true,
      "clientes": true,
      "servicios": true,
      "staff": true,
      "marketing": true,
      "reportes": true,
      "ajustes": true
    }'::jsonb;
  end if;
  
  -- Para staff, obtener permisos personalizados o usar defaults
  select permissions into v_permissions
  from user_permissions
  where user_id = p_user_id and tenant_id = p_tenant_id;
  
  -- Si no tiene permisos configurados, usar defaults básicos
  if v_permissions is null then
    v_permissions := '{
      "dashboard": true,
      "agenda": true,
      "clientes": true,
      "servicios": false,
      "staff": false,
      "marketing": false,
      "reportes": false,
      "ajustes": false
    }'::jsonb;
  end if;
  
  return v_permissions;
end;
$$;

-- Comentarios
comment on table public.user_permissions is 'Control granular de permisos por usuario y tenant';
comment on column public.user_permissions.permissions is 'Permisos JSON: dashboard, agenda, clientes, servicios, staff, marketing, reportes, ajustes';
comment on function get_user_permissions is 'Obtiene los permisos de un usuario. Owners/admins tienen todos los permisos.';

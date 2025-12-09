-- 0025_p1_rls_complete.sql
-- P1.1: RLS end-to-end completo con políticas por rol

-- 1) Mejorar función current_tenant_id para usar memberships
-- La función actual busca en users, pero debería buscar en memberships
-- Nota: Mantener compatibilidad con users si existe, pero priorizar memberships
create or replace function app.current_tenant_id()
returns uuid
language plpgsql
security definer
stable
as $$
declare
  v_tenant_id uuid;
begin
  -- Primero intentar buscar en memberships
  select tenant_id into v_tenant_id
  from public.memberships
  where user_id = auth.uid()
  order by created_at asc
  limit 1;
  
  -- Si no se encuentra en memberships, buscar en users (compatibilidad)
  if v_tenant_id is null then
    select tenant_id into v_tenant_id
    from public.users
    where id = auth.uid()
    limit 1;
  end if;
  
  return v_tenant_id;
end;
$$;

comment on function app.current_tenant_id is 
  'Retorna el tenant_id del usuario actual basado en memberships. Si el usuario tiene múltiples tenants, retorna el primero.';

-- 2) Función helper para verificar si el usuario tiene acceso a un tenant
create or replace function app.user_has_access_to_tenant(p_tenant_id uuid)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_has_access boolean;
begin
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = p_tenant_id
  ) into v_has_access;
  
  return coalesce(v_has_access, false);
end;
$$;

comment on function app.user_has_access_to_tenant is 
  'Verifica si el usuario actual tiene acceso a un tenant específico (cualquier rol).';

-- 3) Mejorar función user_has_role para usar memberships correctamente
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

comment on function app.user_has_role is 
  'Verifica si un usuario tiene uno de los roles especificados en un tenant. Actualizado para usar memberships.';

-- 4) Refinar políticas RLS para tenants
-- Permitir que los usuarios vean sus tenants
drop policy if exists "tenant_read_tenants" on public.tenants;
create policy "tenant_read_tenants" on public.tenants
for select using (
  exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = tenants.id
  )
  or exists (
    select 1 from public.users
    where id = auth.uid()
      and tenant_id = tenants.id
  )
);

-- 5) Refinar políticas RLS para customers
-- Lectura: usuarios del tenant pueden leer
-- Escritura: solo owner/admin/manager pueden escribir
drop policy if exists "tenant_read_customers" on public.customers;
drop policy if exists "tenant_crud_customers" on public.customers;

create policy "tenant_read_customers" on public.customers
for select using (
  exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = customers.tenant_id
  )
  or exists (
    select 1 from public.users
    where id = auth.uid()
      and tenant_id = customers.tenant_id
  )
);

create policy "tenant_write_customers" on public.customers
for insert with check (
  exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = customers.tenant_id
      and role in ('owner', 'admin', 'manager')
  )
);

create policy "tenant_update_customers" on public.customers
for update using (
  exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = customers.tenant_id
      and role in ('owner', 'admin', 'manager')
  )
);

create policy "tenant_delete_customers" on public.customers
for delete using (
  exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = customers.tenant_id
      and role in ('owner', 'admin')
  )
);

-- 6) Refinar políticas RLS para staff
-- Lectura: usuarios del tenant pueden leer + lectura pública de staff activo
-- Escritura: solo owner/admin pueden escribir
drop policy if exists "tenant_read_staff" on public.staff;
drop policy if exists "tenant_crud_staff" on public.staff;
drop policy if exists "public_read_staff" on public.staff;
drop policy if exists "public_read_staff_active" on public.staff;

-- Lectura pública de staff activo (para disponibilidad)
create policy "public_read_staff_active" on public.staff
for select using (active = true);

-- Lectura de tenant (sobrescribe la pública para miembros del tenant)
create policy "tenant_read_staff" on public.staff
for select using (
  exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = staff.tenant_id
  )
  or exists (
    select 1 from public.users
    where id = auth.uid()
      and tenant_id = staff.tenant_id
  )
);

-- Escritura: solo owner/admin
create policy "tenant_write_staff" on public.staff
for insert with check (
  exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = staff.tenant_id
      and role in ('owner', 'admin')
  )
);

create policy "tenant_update_staff" on public.staff
for update using (
  exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = staff.tenant_id
      and role in ('owner', 'admin')
  )
);

create policy "tenant_delete_staff" on public.staff
for delete using (
  exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = staff.tenant_id
      and role in ('owner', 'admin')
  )
);

-- 7) Refinar políticas RLS para services
-- Lectura: usuarios del tenant pueden leer + lectura pública de servicios activos
-- Escritura: solo owner/admin pueden escribir
drop policy if exists "tenant_read_services" on public.services;
drop policy if exists "tenant_crud_services" on public.services;
drop policy if exists "public_read_services" on public.services;
drop policy if exists "public_read_services_active" on public.services;

-- Lectura pública de servicios activos (para disponibilidad)
create policy "public_read_services_active" on public.services
for select using (active = true);

-- Lectura de tenant (sobrescribe la pública para miembros del tenant)
create policy "tenant_read_services" on public.services
for select using (
  exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = services.tenant_id
  )
  or exists (
    select 1 from public.users
    where id = auth.uid()
      and tenant_id = services.tenant_id
  )
);

-- Escritura: solo owner/admin
create policy "tenant_write_services" on public.services
for insert with check (
  exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = services.tenant_id
      and role in ('owner', 'admin')
  )
);

create policy "tenant_update_services" on public.services
for update using (
  exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = services.tenant_id
      and role in ('owner', 'admin')
  )
);

create policy "tenant_delete_services" on public.services
for delete using (
  exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = services.tenant_id
      and role in ('owner', 'admin')
  )
);


-- Proteger todos los DROP/CREATE POLICY sobre public.schedules
do $$
begin
  if to_regclass('public.schedules') is not null then
    drop policy if exists "tenant_crud_schedules" on public.schedules;
    drop policy if exists "public_read_schedules" on public.schedules;
    drop policy if exists "public_read_schedules_active" on public.schedules;

    create policy "public_read_schedules_active" on public.schedules
    for select using (
      exists (
        select 1 from public.staff s
        where s.id = schedules.staff_id
          and s.active = true
      )
    );

    create policy "tenant_read_schedules" on public.schedules
    for select using (
      exists (
        select 1 from public.memberships
        where user_id = auth.uid()
          and tenant_id = schedules.tenant_id
      )
      or exists (
        select 1 from public.users
        where id = auth.uid()
          and tenant_id = schedules.tenant_id
      )
    );

    create policy "tenant_write_schedules" on public.schedules
    for insert with check (
      exists (
        select 1 from public.memberships
        where user_id = auth.uid()
          and tenant_id = schedules.tenant_id
          and role in ('owner', 'admin')
      )
    );

    create policy "tenant_update_schedules" on public.schedules
    for update using (
      exists (
        select 1 from public.memberships
        where user_id = auth.uid()
          and tenant_id = schedules.tenant_id
          and role in ('owner', 'admin')
      )
    );

    create policy "tenant_delete_schedules" on public.schedules
    for delete using (
      exists (
        select 1 from public.memberships
        where user_id = auth.uid()
          and tenant_id = schedules.tenant_id
          and role in ('owner', 'admin')
      )
    );
  end if;
end $$;

-- LEGACY DEFENSE: Solo ejecutar si la tabla existe
do $$
begin
  if to_regclass('public.schedules') is not null then
    drop policy if exists "tenant_read_schedules" on public.schedules;
    drop policy if exists "tenant_crud_schedules" on public.schedules;
    drop policy if exists "public_read_schedules" on public.schedules;
    drop policy if exists "public_read_schedules_active" on public.schedules;

    create policy "public_read_schedules_active" on public.schedules
    for select using (
      exists (
        select 1 from public.staff s
        where s.id = schedules.staff_id
          and s.active = true
      )
    );

    create policy "tenant_read_schedules" on public.schedules
    for select using (
      exists (
        select 1 from public.memberships
        where user_id = auth.uid()
          and tenant_id = schedules.tenant_id
      )
      or exists (
        select 1 from public.users
        where id = auth.uid()
          and tenant_id = schedules.tenant_id
      )
    );

    create policy "tenant_write_schedules" on public.schedules
    for insert with check (
      exists (
        select 1 from public.memberships
        where user_id = auth.uid()
          and tenant_id = schedules.tenant_id
          and role in ('owner', 'admin')
      )
    );

    create policy "tenant_update_schedules" on public.schedules
    for update using (
      exists (
        select 1 from public.memberships
        where user_id = auth.uid()
          and tenant_id = schedules.tenant_id
          and role in ('owner', 'admin')
      )
    );

    create policy "tenant_delete_schedules" on public.schedules
    for delete using (
      exists (
        select 1 from public.memberships
        where user_id = auth.uid()
          and tenant_id = schedules.tenant_id
          and role in ('owner', 'admin')
      )
    );
  end if;
end $$;

-- 9) Refinar políticas RLS para bookings
-- Lectura: usuarios del tenant pueden leer
-- Escritura: owner/admin/manager pueden escribir, staff solo puede leer
drop policy if exists "tenant_read_bookings" on public.bookings;
drop policy if exists "tenant_crud_bookings" on public.bookings;

create policy "tenant_read_bookings" on public.bookings
for select using (
  exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = bookings.tenant_id
  )
  or exists (
    select 1 from public.users
    where id = auth.uid()
      and tenant_id = bookings.tenant_id
  )
);

-- Escritura: owner/admin/manager
create policy "tenant_write_bookings" on public.bookings
for insert with check (
  exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = bookings.tenant_id
      and role in ('owner', 'admin', 'manager')
  )
);

create policy "tenant_update_bookings" on public.bookings
for update using (
  exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = bookings.tenant_id
      and role in ('owner', 'admin', 'manager')
  )
);

create policy "tenant_delete_bookings" on public.bookings
for delete using (
  exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = bookings.tenant_id
      and role in ('owner', 'admin')
  )
);

-- 10) Refinar políticas RLS para memberships
-- Lectura: usuarios pueden leer sus propios memberships
-- Escritura: solo owner/admin pueden escribir
drop policy if exists "users_read_own_memberships" on public.memberships;
drop policy if exists "admins_manage_memberships" on public.memberships;

create policy "users_read_own_memberships" on public.memberships
for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.memberships m2
    where m2.user_id = auth.uid()
      and m2.tenant_id = memberships.tenant_id
      and m2.role in ('owner', 'admin')
  )
);

create policy "admins_write_memberships" on public.memberships
for insert with check (
  exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = memberships.tenant_id
      and role in ('owner', 'admin')
  )
);

create policy "admins_update_memberships" on public.memberships
for update using (
  exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = memberships.tenant_id
      and role in ('owner', 'admin')
  )
);

create policy "admins_delete_memberships" on public.memberships
for delete using (
  exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = memberships.tenant_id
      and role in ('owner', 'admin')
  )
);

-- 11) Refinar políticas RLS para payment_intents
-- Lectura: usuarios del tenant pueden leer
-- Escritura: creación pública (validación en aplicación), actualización solo sistema
drop policy if exists "tenant_read_payment_intents" on public.payment_intents;
drop policy if exists "public_create_payment_intents" on public.payment_intents;

create policy "tenant_read_payment_intents" on public.payment_intents
for select using (
  exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = payment_intents.tenant_id
  )
  or exists (
    select 1 from public.users
    where id = auth.uid()
      and tenant_id = payment_intents.tenant_id
  )
);

-- Creación pública (validación en aplicación)
create policy "public_create_payment_intents" on public.payment_intents
for insert with check (true);

-- Actualización solo sistema (vía service_role)
-- No crear política de actualización para usuarios normales

-- 12) Refinar políticas RLS para logs
-- Lectura: usuarios del tenant pueden leer
-- Escritura: solo sistema (vía service_role o triggers)
drop policy if exists "tenant_read_logs" on public.logs;

create policy "tenant_read_logs" on public.logs
for select using (
  tenant_id is null
  or exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and tenant_id = logs.tenant_id
  )
  or exists (
    select 1 from public.users
    where id = auth.uid()
      and tenant_id = logs.tenant_id
  )
);

-- Escritura solo sistema (no crear política para usuarios normales)

-- 13) Notas sobre políticas RLS
-- - Las políticas de lectura pública (services, staff, schedules) permiten que usuarios anónimos
--   vean datos activos para disponibilidad, pero los miembros del tenant pueden ver todo.
-- - Las políticas de escritura están restringidas por rol:
--   - owner/admin: Pueden gestionar todo
--   - manager: Puede gestionar bookings y customers
--   - staff: Solo lectura de bookings y customers
--   - viewer: Solo lectura
-- - Las políticas usan `exists` con subconsultas a `memberships` para mejor rendimiento.
-- - Compatibilidad: Las políticas también verifican `users` para mantener compatibilidad con datos antiguos.

comment on function app.current_tenant_id is 
  'Retorna el tenant_id del usuario actual basado en memberships. Actualizado para usar memberships en lugar de users, con compatibilidad hacia atrás.';

comment on function app.user_has_access_to_tenant is 
  'Verifica si el usuario actual tiene acceso a un tenant específico (cualquier rol).';

comment on function app.user_has_role is 
  'Verifica si un usuario tiene uno de los roles especificados en un tenant. Actualizado para usar memberships.';

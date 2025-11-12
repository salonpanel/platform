-- 0019_seed_booking_demo.sql
-- Seeds mejorados para sistema de reservas: tenant demo completo con servicios, staff y horarios

-- 1) Tenant demo (barberia_demo)
-- ID fijo para consistencia
insert into public.tenants (id, slug, name, timezone)
values 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'barberia-demo', 'Barbería Demo', 'Europe/Madrid')
on conflict (id) do update
set 
  slug = excluded.slug,
  name = excluded.name,
  timezone = excluded.timezone;

-- 2) Servicios (2 servicios de ejemplo)
-- Corte Básico y Barba
insert into public.services (id, tenant_id, name, duration_min, price_cents, active)
values 
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Corte Básico', 30, 1500, true),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Barba', 20, 1000, true)
on conflict (id) do update
set 
  name = excluded.name,
  duration_min = excluded.duration_min,
  price_cents = excluded.price_cents,
  active = excluded.active;

-- 3) Staff (2 barberos)
-- Barbero 1: Juan
-- Barbero 2: Pedro
insert into public.staff (id, tenant_id, name, display_name, active)
values 
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Juan Pérez', 'Juan', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Pedro García', 'Pedro', true)
on conflict (id) do update
set 
  name = excluded.name,
  display_name = excluded.display_name,
  active = excluded.active;

-- 4) Horarios semanales (Lunes a Viernes, 9:00-18:00 para ambos barberos)
-- Eliminar horarios antiguos del tenant demo
delete from public.schedules 
where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Barbero 1: Lunes a Viernes, 9:00-18:00
insert into public.schedules (tenant_id, staff_id, weekday, start_time, end_time)
select 
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  weekday,
  '09:00'::time,
  '18:00'::time
from generate_series(0, 4) as weekday;

-- Barbero 2: Lunes a Viernes, 9:00-18:00
insert into public.schedules (tenant_id, staff_id, weekday, start_time, end_time)
select 
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  weekday,
  '09:00'::time,
  '18:00'::time
from generate_series(0, 4) as weekday;

-- 5) Usuario owner (requiere que el usuario exista en auth.users)
-- Nota: El usuario debe crearse primero en auth.users
-- Por ahora, creamos un placeholder que se puede vincular después
-- Para testing, puedes crear un usuario en auth.users con este ID:
-- INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
-- VALUES ('11111111-1111-1111-1111-111111111111', 'owner@demo.com', crypt('password', gen_salt('bf')), now(), now(), now());

-- Crear membership para el usuario owner (si existe)
-- Por ahora, comentamos esto porque requiere que el usuario exista en auth.users
/*
insert into public.memberships (tenant_id, user_id, role)
values 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner')
on conflict (tenant_id, user_id) do update
set role = excluded.role;
*/

-- 6) Customer de ejemplo (para testing)
insert into public.customers (id, tenant_id, email, name, phone)
values 
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cliente@demo.com', 'Cliente Demo', '+34600000000')
on conflict (id) do update
set 
  email = excluded.email,
  name = excluded.name,
  phone = excluded.phone;

-- 7) Verificación de seeds
do $$
declare
  v_tenant_count int;
  v_service_count int;
  v_staff_count int;
  v_schedule_count int;
begin
  select count(*) into v_tenant_count
  from public.tenants
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  
  select count(*) into v_service_count
  from public.services
  where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  
  select count(*) into v_staff_count
  from public.staff
  where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  
  select count(*) into v_schedule_count
  from public.schedules
  where tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  
  if v_tenant_count = 0 then
    raise exception 'Tenant demo no encontrado';
  end if;
  
  if v_service_count < 2 then
    raise exception 'Se esperaban 2 servicios, se encontraron %', v_service_count;
  end if;
  
  if v_staff_count < 2 then
    raise exception 'Se esperaban 2 barberos, se encontraron %', v_staff_count;
  end if;
  
  if v_schedule_count < 10 then
    raise exception 'Se esperaban al menos 10 horarios, se encontraron %', v_schedule_count;
  end if;
  
  raise notice 'Seeds verificados correctamente: tenant=%, services=%, staff=%, schedules=%', 
    v_tenant_count, v_service_count, v_staff_count, v_schedule_count;
end $$;

-- 8) Comentarios para documentación
comment on table public.tenants is 
  'Tenants (organizaciones) del sistema multi-tenant. Cada tenant tiene un slug único.';

comment on table public.services is 
  'Servicios ofrecidos por cada tenant. Incluye duración y precio.';

comment on table public.staff is 
  'Staff (barberos) de cada tenant. Pueden tener horarios y reservas.';

comment on table public.schedules is 
  'Horarios de trabajo del staff. Define días de la semana y horas de trabajo.';


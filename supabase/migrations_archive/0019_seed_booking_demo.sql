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


-- LEGACY DEFENSE: Solo ejecutar si la tabla existe
do $$
begin
  if to_regclass('public.schedules') is not null then
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
  end if;
end $$;

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


-- 7) Verificación de seeds (migrado a bloque seguro más abajo)


-- LEGACY DEFENSE: Solo verificar schedules si la tabla existe
DO $$
BEGIN
  IF to_regclass('public.schedules') IS NOT NULL THEN
    DECLARE
      v_tenant_count int;
      v_service_count int;
      v_staff_count int;
      v_schedule_count int;
    BEGIN
      SELECT count(*) INTO v_tenant_count
      FROM public.tenants
      WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

      SELECT count(*) INTO v_service_count
      FROM public.services
      WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

      SELECT count(*) INTO v_staff_count
      FROM public.staff
      WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

      SELECT count(*) INTO v_schedule_count
      FROM public.schedules
      WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

      IF v_tenant_count = 0 THEN
        RAISE EXCEPTION 'Tenant demo no encontrado';
      END IF;

      IF v_service_count < 2 THEN
        RAISE EXCEPTION 'Se esperaban 2 servicios, se encontraron %', v_service_count;
      END IF;

      IF v_staff_count < 2 THEN
        RAISE EXCEPTION 'Se esperaban 2 barberos, se encontraron %', v_staff_count;
      END IF;

      IF v_schedule_count < 10 THEN
        RAISE EXCEPTION 'Se esperaban al menos 10 horarios, se encontraron %', v_schedule_count;
      END IF;

      RAISE NOTICE 'Seeds verificados correctamente: tenant=%, services=%, staff=%, schedules=%', 
        v_tenant_count, v_service_count, v_staff_count, v_schedule_count;
    END;
  END IF;
END $$;

-- 8) Comentarios para documentación
comment on table public.tenants is 
  'Tenants (organizaciones) del sistema multi-tenant. Cada tenant tiene un slug único.';

comment on table public.services is 
  'Servicios ofrecidos por cada tenant. Incluye duración y precio.';

comment on table public.staff is 
  'Staff (barberos) de cada tenant. Pueden tener horarios y reservas.';

DO $$
BEGIN
  IF to_regclass('public.schedules') IS NOT NULL THEN
    COMMENT ON TABLE public.schedules IS 'Horarios de trabajo del staff. Define días de la semana y horas de trabajo.';
  END IF;
END $$;


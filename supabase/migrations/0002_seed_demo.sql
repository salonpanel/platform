-- 0002_seed_demo.sql (IDs fijos para testing)
-- Org demo con UUID fijo
insert into public.orgs (id, name)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Demo Salon')
on conflict (id) do nothing;

-- Owner ficticio (simula auth.uid() para pruebas)
insert into public.org_members (org_id, user_id, role)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'owner')
on conflict (org_id, user_id) do nothing;

-- Servicios base
insert into public.services (id, org_id, name, duration_min, price_cents)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Corte Basico', 30, 1500),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Barba',        20, 1000)
on conflict (id) do nothing;

-- Appointment en estado hold para pruebas
insert into public.appointments (
  id,
  org_id,
  customer_id,
  staff_id,
  service_id,
  starts_at,
  ends_at,
  status,
  source,
  created_by
)
values (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  null,
  null,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  now() + interval '1 day',
  now() + interval '1 day' + interval '30 minutes',
  'hold',
  'web',
  null
)
on conflict (id) do nothing;

-- Verificación rápida del seed
select id, status
from public.appointments
where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

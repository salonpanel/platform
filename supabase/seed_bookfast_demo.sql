-- ============================================================================
-- SEED DEMO: BookFast - Barbería Demo Completa
-- ============================================================================
-- Este script crea un tenant de demo completamente funcional para BookFast
-- con datos realistas, coherentes y respetando todas las constraints del sistema.
--
-- CONTENIDO:
-- 1. Tenant BookFast
-- 2. Usuarios owners (tus cuentas existentes)
-- 3. Staff (barberos) con horarios
-- 4. Servicios de barbería
-- 5. Clientes
-- 6. Reservas históricas (últimos 6 meses)
-- 7. Reservas actuales y futuras
--
-- EJECUCIÓN: Copiar y pegar en SQL Editor de Supabase Cloud
-- ============================================================================

BEGIN;

-- ============================================================================
-- PASO 1: VERIFICAR Y CREAR TENANT BOOKFAST
-- ============================================================================

-- Insertar tenant BookFast
INSERT INTO public.tenants (
  id,
  name,
  slug,
  timezone,
  logo_url,
  primary_color,
  contact_email,
  contact_phone,
  address,
  portal_url,
  stripe_onboarding_status,
  stripe_charges_enabled,
  stripe_payouts_enabled
) VALUES (
  'bf000000-0000-0000-0000-000000000001', -- ID fijo para facilitar referencias
  'BookFast Barbería',
  'bookfast',
  'Europe/Madrid',
  NULL, -- Logo a añadir después
  '#1a1a1a', -- Color oscuro profesional
  'contacto@bookfast.es',
  '+34 911 234 567',
  'Calle Gran Vía, 42, 28013 Madrid',
  '/r/bookfast',
  'pending',
  false,
  false
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  timezone = EXCLUDED.timezone,
  primary_color = EXCLUDED.primary_color,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone,
  address = EXCLUDED.address,
  updated_at = NOW();

-- Crear tenant_settings para BookFast
INSERT INTO public.tenant_settings (
  tenant_id,
  no_show_protection_enabled,
  no_show_protection_mode,
  no_show_protection_percentage,
  no_show_cancellation_hours,
  default_service_duration,
  business_open_time,
  business_close_time
) VALUES (
  'bf000000-0000-0000-0000-000000000001',
  true,
  'deposit',
  20, -- 20% de depósito
  24, -- 24h de antelación para cancelar
  30,
  '09:00:00',
  '20:00:00'
) ON CONFLICT (tenant_id) DO UPDATE SET
  no_show_protection_enabled = EXCLUDED.no_show_protection_enabled,
  no_show_protection_mode = EXCLUDED.no_show_protection_mode,
  no_show_protection_percentage = EXCLUDED.no_show_protection_percentage,
  updated_at = NOW();

-- ============================================================================
-- PASO 2: ASIGNAR OWNERS AL TENANT
-- ============================================================================
-- IMPORTANTE: Necesitas reemplazar estos UUIDs con los IDs reales de tus usuarios
-- Para obtenerlos: SELECT id, email FROM auth.users WHERE email IN ('tu@email.com', 'socio@email.com');

-- Ejemplo (DEBES CAMBIAR ESTOS IDS):
-- INSERT INTO public.memberships (tenant_id, user_id, role)
-- VALUES 
--   ('bf000000-0000-0000-0000-000000000001', 'TU_USER_ID_AQUI', 'owner'),
--   ('bf000000-0000-0000-0000-000000000001', 'SOCIO_USER_ID_AQUI', 'owner')
-- ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'owner';

-- ⚠️ ACCIÓN REQUERIDA: Ejecutar esta query para obtener los user_ids:
-- SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 10;
-- Luego descomentar y completar los INSERT anteriores

-- ============================================================================
-- PASO 3: CREAR SERVICIOS DE BARBERÍA
-- ============================================================================

INSERT INTO public.services (
  id,
  tenant_id,
  name,
  duration_min,
  price_cents,
  active,
  category,
  buffer_min,
  deposit_enabled,
  deposit_type,
  deposit_percent,
  online_payment_required
) VALUES
  -- Servicios de corte
  ('bf000001-serv-0000-0000-000000000001', 'bf000000-0000-0000-0000-000000000001', 'Corte Clásico', 30, 1800, true, 'Corte', 5, false, NULL, NULL, false),
  ('bf000001-serv-0000-0000-000000000002', 'bf000000-0000-0000-0000-000000000001', 'Fade Profesional', 45, 2500, true, 'Corte', 5, false, NULL, NULL, false),
  ('bf000001-serv-0000-0000-000000000003', 'bf000000-0000-0000-0000-000000000001', 'Corte + Diseño', 60, 3000, true, 'Corte', 5, true, 'percent', 20, false),
  
  -- Servicios de barba
  ('bf000001-serv-0000-0000-000000000004', 'bf000000-0000-0000-0000-000000000001', 'Arreglo de Barba', 20, 1200, true, 'Barba', 5, false, NULL, NULL, false),
  ('bf000001-serv-0000-0000-000000000005', 'bf000000-0000-0000-0000-000000000001', 'Afeitado Clásico', 30, 1500, true, 'Barba', 5, false, NULL, NULL, false),
  
  -- Combos
  ('bf000001-serv-0000-0000-000000000006', 'bf000000-0000-0000-0000-000000000001', 'Corte + Barba', 50, 3200, true, 'Combo', 10, true, 'percent', 20, false),
  ('bf000001-serv-0000-0000-000000000007', 'bf000000-0000-0000-0000-000000000001', 'Pack Premium (Corte + Barba + Cejas)', 75, 4500, true, 'Combo', 10, true, 'percent', 30, false),
  
  -- Otros servicios
  ('bf000001-serv-0000-0000-000000000008', 'bf000000-0000-0000-0000-000000000001', 'Tinte de Barba', 25, 1800, true, 'Otros', 5, false, NULL, NULL, false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  duration_min = EXCLUDED.duration_min,
  price_cents = EXCLUDED.price_cents,
  active = EXCLUDED.active,
  updated_at = NOW();

-- ============================================================================
-- PASO 4: CREAR STAFF (BARBEROS)
-- ============================================================================

INSERT INTO public.staff (
  id,
  tenant_id,
  name,
  display_name,
  active,
  provides_services,
  weekly_hours,
  color,
  bio,
  role
) VALUES
  ('bf000002-staf-0000-0000-000000000001', 'bf000000-0000-0000-0000-000000000001', 
   'Carlos Martínez', 'Carlos', true, true, 40, '#3B82F6', 
   'Especialista en fades y diseños modernos. 8 años de experiencia.', 'Barbero Senior'),
  
  ('bf000002-staf-0000-0000-000000000002', 'bf000000-0000-0000-0000-000000000001', 
   'Miguel Ángel Torres', 'Miguel', true, true, 40, '#10B981', 
   'Experto en barbería clásica y afeitados tradicionales.', 'Maestro Barbero'),
  
  ('bf000002-staf-0000-0000-000000000003', 'bf000000-0000-0000-0000-000000000001', 
   'Javier López', 'Javi', true, true, 35, '#F59E0B', 
   'Especialista en color y tintes. Estilo urbano y moderno.', 'Barbero'),
  
  ('bf000002-staf-0000-0000-000000000004', 'bf000000-0000-0000-0000-000000000001', 
   'David Hernández', 'David', true, true, 30, '#EF4444', 
   'Barbero joven con técnicas innovadoras. Especialista en clientes jóvenes.', 'Barbero Junior')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_name = EXCLUDED.display_name,
  active = EXCLUDED.active,
  updated_at = NOW();

-- ============================================================================
-- PASO 5: ASIGNAR SERVICIOS A BARBEROS
-- ============================================================================

-- Carlos (senior) - puede hacer todo
INSERT INTO public.staff_provides_services (tenant_id, staff_id, service_id) VALUES
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000001', 'bf000001-serv-0000-0000-000000000001'),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000001', 'bf000001-serv-0000-0000-000000000002'),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000001', 'bf000001-serv-0000-0000-000000000003'),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000001', 'bf000001-serv-0000-0000-000000000004'),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000001', 'bf000001-serv-0000-0000-000000000005'),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000001', 'bf000001-serv-0000-0000-000000000006'),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000001', 'bf000001-serv-0000-0000-000000000007')
ON CONFLICT DO NOTHING;

-- Miguel (maestro) - especialista en clásicos y barba
INSERT INTO public.staff_provides_services (tenant_id, staff_id, service_id) VALUES
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000002', 'bf000001-serv-0000-0000-000000000001'),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000002', 'bf000001-serv-0000-0000-000000000004'),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000002', 'bf000001-serv-0000-0000-000000000005'),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000002', 'bf000001-serv-0000-0000-000000000006'),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000002', 'bf000001-serv-0000-0000-000000000007')
ON CONFLICT DO NOTHING;

-- Javi - especialista en diseño y color
INSERT INTO public.staff_provides_services (tenant_id, staff_id, service_id) VALUES
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000003', 'bf000001-serv-0000-0000-000000000001'),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000003', 'bf000001-serv-0000-0000-000000000002'),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000003', 'bf000001-serv-0000-0000-000000000003'),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000003', 'bf000001-serv-0000-0000-000000000008'),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000003', 'bf000001-serv-0000-0000-000000000007')
ON CONFLICT DO NOTHING;

-- David (junior) - servicios básicos
INSERT INTO public.staff_provides_services (tenant_id, staff_id, service_id) VALUES
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000004', 'bf000001-serv-0000-0000-000000000001'),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000004', 'bf000001-serv-0000-0000-000000000002'),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000004', 'bf000001-serv-0000-0000-000000000004'),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000004', 'bf000001-serv-0000-0000-000000000006')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PASO 6: CREAR HORARIOS DE TRABAJO DEL STAFF
-- ============================================================================
-- Formato: day_of_week (0=Lunes, 6=Domingo)

-- Carlos - Lunes a Viernes 9:00-18:00, Sábado 10:00-14:00
INSERT INTO public.staff_schedules (tenant_id, staff_id, day_of_week, start_time, end_time, is_active) VALUES
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000001', 0, '09:00', '18:00', true),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000001', 1, '09:00', '18:00', true),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000001', 2, '09:00', '18:00', true),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000001', 3, '09:00', '18:00', true),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000001', 4, '09:00', '18:00', true),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000001', 5, '10:00', '14:00', true)
ON CONFLICT DO NOTHING;

-- Miguel - Martes a Sábado 10:00-19:00
INSERT INTO public.staff_schedules (tenant_id, staff_id, day_of_week, start_time, end_time, is_active) VALUES
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000002', 1, '10:00', '19:00', true),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000002', 2, '10:00', '19:00', true),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000002', 3, '10:00', '19:00', true),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000002', 4, '10:00', '19:00', true),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000002', 5, '10:00', '19:00', true)
ON CONFLICT DO NOTHING;

-- Javi - Lunes a Viernes 12:00-20:00
INSERT INTO public.staff_schedules (tenant_id, staff_id, day_of_week, start_time, end_time, is_active) VALUES
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000003', 0, '12:00', '20:00', true),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000003', 1, '12:00', '20:00', true),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000003', 2, '12:00', '20:00', true),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000003', 3, '12:00', '20:00', true),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000003', 4, '12:00', '20:00', true)
ON CONFLICT DO NOTHING;

-- David - Miércoles a Domingo 10:00-18:00
INSERT INTO public.staff_schedules (tenant_id, staff_id, day_of_week, start_time, end_time, is_active) VALUES
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000004', 2, '10:00', '18:00', true),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000004', 3, '10:00', '18:00', true),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000004', 4, '10:00', '18:00', true),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000004', 5, '10:00', '18:00', true),
  ('bf000000-0000-0000-0000-000000000001', 'bf000002-staf-0000-0000-000000000004', 6, '10:00', '14:00', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PASO 7: CREAR CLIENTES
-- ============================================================================

INSERT INTO public.customers (
  id,
  tenant_id,
  name,
  email,
  phone,
  birth_date,
  notes,
  tags,
  is_vip,
  marketing_opt_in,
  preferred_time_of_day,
  internal_notes
) VALUES
  -- Clientes VIP recurrentes
  ('bf000003-cust-0000-0000-000000000001', 'bf000000-0000-0000-0000-000000000001', 'Alberto García', 'alberto.garcia@email.com', '+34 612345001', '1985-03-15', NULL, ARRAY['vip', 'puntual'], true, true, 'mañana', 'Cliente desde hace 3 años. Siempre pide a Carlos.'),
  ('bf000003-cust-0000-0000-000000000002', 'bf000000-0000-0000-0000-000000000001', 'Roberto Sánchez', 'roberto.sanchez@email.com', '+34 612345002', '1978-07-22', NULL, ARRAY['vip', 'mensual'], true, true, 'tarde', 'Prefiere Miguel. Corte + barba siempre.'),
  ('bf000003-cust-0000-0000-000000000003', 'bf000000-0000-0000-0000-000000000001', 'Fernando López', 'fernando.lopez@email.com', '+34 612345003', '1990-11-08', NULL, ARRAY['vip'], true, true, 'tarde', 'CEO de empresa tech. Muy exigente con el fade.'),
  
  -- Clientes regulares
  ('bf000003-cust-0000-0000-000000000004', 'bf000000-0000-0000-0000-000000000001', 'Miguel Ruiz', 'miguel.ruiz@email.com', '+34 612345004', '1992-01-30', NULL, ARRAY['regular'], false, true, 'mañana', NULL),
  ('bf000003-cust-0000-0000-000000000005', 'bf000000-0000-0000-0000-000000000001', 'David Martín', 'david.martin@email.com', '+34 612345005', '1988-05-12', NULL, ARRAY['regular'], false, true, 'tarde', NULL),
  ('bf000003-cust-0000-0000-000000000006', 'bf000000-0000-0000-0000-000000000001', 'Carlos Fernández', 'carlos.fernandez@email.com', '+34 612345006', '1995-09-25', NULL, ARRAY['joven'], false, true, 'tarde', NULL),
  ('bf000003-cust-0000-0000-000000000007', 'bf000000-0000-0000-0000-000000000001', 'Javier Moreno', 'javier.moreno@email.com', '+34 612345007', '1982-12-03', NULL, ARRAY['regular'], false, true, 'mañana', NULL),
  ('bf000003-cust-0000-0000-000000000008', 'bf000000-0000-0000-0000-000000000001', 'Antonio Jiménez', 'antonio.jimenez@email.com', '+34 612345008', '1975-04-18', NULL, ARRAY['senior'], false, true, 'mañana', NULL),
  ('bf000003-cust-0000-0000-000000000009', 'bf000000-0000-0000-0000-000000000001', 'Francisco Álvarez', 'francisco.alvarez@email.com', '+34 612345009', '1998-08-27', NULL, ARRAY['joven'], false, true, 'noche', NULL),
  ('bf000003-cust-0000-0000-000000000010', 'bf000000-0000-0000-0000-000000000001', 'Manuel Romero', 'manuel.romero@email.com', '+34 612345010', '1987-02-14', NULL, ARRAY['regular'], false, true, 'tarde', NULL),
  
  -- Más clientes variados
  ('bf000003-cust-0000-0000-000000000011', 'bf000000-0000-0000-0000-000000000001', 'José Torres', NULL, '+34 612345011', '1991-06-05', NULL, ARRAY['sin-email'], false, false, NULL, NULL),
  ('bf000003-cust-0000-0000-000000000012', 'bf000000-0000-0000-0000-000000000001', 'Luis Navarro', 'luis.navarro@email.com', '+34 612345012', '1983-10-19', NULL, ARRAY['regular'], false, true, 'mañana', NULL),
  ('bf000003-cust-0000-0000-000000000013', 'bf000000-0000-0000-0000-000000000001', 'Pedro Gil', 'pedro.gil@email.com', '+34 612345013', '1996-03-08', NULL, ARRAY['joven'], false, true, 'tarde', NULL),
  ('bf000003-cust-0000-0000-000000000014', 'bf000000-0000-0000-0000-000000000001', 'Sergio Ramírez', 'sergio.ramirez@email.com', '+34 612345014', '1989-07-21', NULL, ARRAY['regular'], false, true, 'tarde', NULL),
  ('bf000003-cust-0000-0000-000000000015', 'bf000000-0000-0000-0000-000000000001', 'Pablo Castro', 'pablo.castro@email.com', '+34 612345015', '1993-11-16', NULL, ARRAY['regular'], false, true, 'mañana', NULL),
  ('bf000003-cust-0000-0000-000000000016', 'bf000000-0000-0000-0000-000000000001', 'Raúl Ortiz', NULL, '+34 612345016', '1980-01-28', NULL, ARRAY['sin-email'], false, false, NULL, NULL),
  ('bf000003-cust-0000-0000-000000000017', 'bf000000-0000-0000-0000-000000000001', 'Adrián Rubio', 'adrian.rubio@email.com', '+34 612345017', '1997-05-09', NULL, ARRAY['joven'], false, true, 'noche', NULL),
  ('bf000003-cust-0000-0000-000000000018', 'bf000000-0000-0000-0000-000000000001', 'Iván Molina', 'ivan.molina@email.com', '+34 612345018', '1986-09-12', NULL, ARRAY['regular'], false, true, 'tarde', NULL),
  ('bf000003-cust-0000-0000-000000000019', 'bf000000-0000-0000-0000-000000000001', 'Óscar Delgado', 'oscar.delgado@email.com', '+34 612345019', '1994-02-23', NULL, ARRAY['regular'], false, true, 'mañana', NULL),
  ('bf000003-cust-0000-0000-000000000020', 'bf000000-0000-0000-0000-000000000001', 'Álvaro Castro', 'alvaro.castro@email.com', '+34 612345020', '1984-06-17', NULL, ARRAY['regular'], false, true, 'tarde', NULL),
  
  -- Clientes adicionales
  ('bf000003-cust-0000-0000-000000000021', 'bf000000-0000-0000-0000-000000000001', 'Jorge Méndez', 'jorge.mendez@email.com', '+34 612345021', '1999-04-11', NULL, ARRAY['joven', 'estudiante'], false, true, 'tarde', NULL),
  ('bf000003-cust-0000-0000-000000000022', 'bf000000-0000-0000-0000-000000000001', 'Rubén Vega', 'ruben.vega@email.com', '+34 612345022', '1981-08-06', NULL, ARRAY['regular'], false, true, 'mañana', NULL),
  ('bf000003-cust-0000-0000-000000000023', 'bf000000-0000-0000-0000-000000000001', 'Daniel Herrera', 'daniel.herrera@email.com', '+34 612345023', '1995-12-01', NULL, ARRAY['joven'], false, true, 'noche', NULL),
  ('bf000003-cust-0000-0000-000000000024', 'bf000000-0000-0000-0000-000000000001', 'Marcos Peña', 'marcos.pena@email.com', '+34 612345024', '1987-03-19', NULL, ARRAY['regular'], false, true, 'tarde', NULL),
  ('bf000003-cust-0000-0000-000000000025', 'bf000000-0000-0000-0000-000000000001', 'Hugo Campos', 'hugo.campos@email.com', '+34 612345025', '1992-07-28', NULL, ARRAY['regular'], false, true, 'mañana', NULL),
  ('bf000003-cust-0000-0000-000000000026', 'bf000000-0000-0000-0000-000000000001', 'Víctor Prieto', NULL, '+34 612345026', '1979-11-14', NULL, ARRAY['sin-email', 'senior'], false, false, NULL, NULL),
  ('bf000003-cust-0000-0000-000000000027', 'bf000000-0000-0000-0000-000000000001', 'Samuel Vargas', 'samuel.vargas@email.com', '+34 612345027', '1996-01-07', NULL, ARRAY['joven'], false, true, 'tarde', NULL),
  ('bf000003-cust-0000-0000-000000000028', 'bf000000-0000-0000-0000-000000000001', 'Guillermo Nieto', 'guillermo.nieto@email.com', '+34 612345028', '1988-05-22', NULL, ARRAY['regular'], false, true, 'mañana', NULL),
  ('bf000003-cust-0000-0000-000000000029', 'bf000000-0000-0000-0000-000000000001', 'Andrés Ibáñez', 'andres.ibanez@email.com', '+34 612345029', '1993-09-03', NULL, ARRAY['regular'], false, true, 'tarde', NULL),
  ('bf000003-cust-0000-0000-000000000030', 'bf000000-0000-0000-0000-000000000001', 'Mario Cordero', 'mario.cordero@email.com', '+34 612345030', '1985-12-25', NULL, ARRAY['regular'], false, true, 'mañana', NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  updated_at = NOW();

-- ============================================================================
-- PASO 8: CREAR RESERVAS HISTÓRICAS Y FUTURAS
-- ============================================================================
-- Este paso lo haremos con una función helper para respetar constraints

-- Nota: Las reservas se crearán manualmente para asegurar:
-- 1. No solapamientos (EXCLUDE constraint)
-- 2. Horarios coherentes con staff_schedules
-- 3. Distribución realista de servicios
-- 4. Estados variados (completed, confirmed, no_show, cancelled)

-- Las insertaremos en el siguiente orden cronológico:
-- - Últimos 6 meses: reservas completadas (para métricas históricas)
-- - Última semana: mix de completed/confirmed
-- - Próximas 2 semanas: reservas confirmed (agenda activa)

-- ⚠️ IMPORTANTE: Este INSERT manual garantiza coherencia total
-- pero es extenso. Se incluirá en un bloque separado después de validar
-- que no haya errores en los pasos anteriores.

COMMIT;

-- ============================================================================
-- VALIDACIONES POST-INSERCIÓN
-- ============================================================================
-- Ejecutar estas queries para verificar que todo está correcto:

-- 1. Verificar tenant creado
-- SELECT * FROM public.tenants WHERE id = 'bf000000-0000-0000-0000-000000000001';

-- 2. Verificar servicios
-- SELECT COUNT(*) as total_servicios FROM public.services WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';

-- 3. Verificar staff
-- SELECT COUNT(*) as total_staff FROM public.staff WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';

-- 4. Verificar horarios
-- SELECT s.display_name, COUNT(ss.id) as dias_trabajo
-- FROM public.staff s
-- JOIN public.staff_schedules ss ON ss.staff_id = s.id
-- WHERE s.tenant_id = 'bf000000-0000-0000-0000-000000000001'
-- GROUP BY s.id, s.display_name;

-- 5. Verificar clientes
-- SELECT COUNT(*) as total_clientes FROM public.customers WHERE tenant_id = 'bf000000-0000-0000-0000-000000000001';

-- 6. Verificar servicios por barbero
-- SELECT s.display_name, COUNT(sps.service_id) as servicios_habilitados
-- FROM public.staff s
-- LEFT JOIN public.staff_provides_services sps ON sps.staff_id = s.id
-- WHERE s.tenant_id = 'bf000000-0000-0000-0000-000000000001'
-- GROUP BY s.id, s.display_name;

-- ============================================================================
-- SIGUIENTE PASO: CREAR RESERVAS
-- ============================================================================
-- Ver archivo: seed_bookfast_bookings.sql
-- (Se creará en un archivo separado para facilitar ajustes sin rehacer todo)

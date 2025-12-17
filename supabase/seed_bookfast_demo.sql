-- ============================================================================
-- SEED DEMO COMERCIAL: BookFast - Barbería Demo Realista para Ventas
-- ============================================================================
-- Este script crea un tenant de demo COMPLETO y REALISTA para BookFast
-- optimizado para demostraciones comerciales y ventas.
--
-- DATASET COMPLETO (2 AÑOS):
-- - Periodo: 12/12/2024 → 12/12/2026 (2 años completos)
-- - Clientes: 400 (realista para barbería establecida)
-- - Servicios: 20 (catálogo profesional completo)
-- - Staff: 5 barberos (2 owners + 3 empleados)
-- - Reservas: 2.500-3.500 (generadas en script separado)
-- - Horarios: Completos con pausas, vacaciones, bloqueos
--
-- CONTENIDO:
-- 1. Tenant BookFast
-- 2. Usuarios owners (como staff senior activo)
-- 3. Staff completo (5 barberos)
-- 4. Catálogo de servicios profesional (20 servicios)
-- 5. Base de clientes realista (400 clientes)
--
-- ⚠️ NO EJECUTAR en producción - Solo para demo/testing
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
  '00000000-0000-0000-0000-000000000001', -- ID fijo para facilitar referencias
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
  '00000000-0000-0000-0000-000000000001',
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
--   ('00000000-0000-0000-0000-000000000001', 'TU_USER_ID_AQUI', 'owner'),
--   ('00000000-0000-0000-0000-000000000001', 'SOCIO_USER_ID_AQUI', 'owner')
-- ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'owner';

-- ⚠️ ACCIÓN REQUERIDA: Ejecutar esta query para obtener los user_ids:
-- SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 10;
-- Luego descomentar y completar los INSERT anteriores

-- ============================================================================
-- PASO 3: CREAR CATÁLOGO COMPLETO DE SERVICIOS (20 servicios)
-- ============================================================================
-- Catálogo profesional completo para barbería moderna

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
  -- ===== CORTES (7 opciones) =====
  ('00000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Corte Clásico', 30, 1800, true, 'Corte', 5, false, NULL, NULL, false),
  ('00000001-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Fade Profesional', 45, 2500, true, 'Corte', 5, false, NULL, NULL, false),
  ('00000001-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Fade Premium', 50, 2800, true, 'Corte', 5, true, 'percent', 20, false),
  ('00000001-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Corte + Diseño', 60, 3200, true, 'Corte', 5, true, 'percent', 20, false),
  ('00000001-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Corte Niño (0-12 años)', 25, 1500, true, 'Corte', 5, false, NULL, NULL, false),
  ('00000001-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Degradado Ejecutivo', 40, 2200, true, 'Corte', 5, false, NULL, NULL, false),
  ('00000001-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Corte Rapado', 20, 1400, true, 'Corte', 5, false, NULL, NULL, false),
  
  -- ===== BARBA (5 opciones) =====
  ('00000001-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Arreglo de Barba', 20, 1200, true, 'Barba', 5, false, NULL, NULL, false),
  ('00000001-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'Barba Premium', 30, 1800, true, 'Barba', 5, false, NULL, NULL, false),
  ('00000001-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Afeitado Clásico', 30, 1800, true, 'Barba', 5, false, NULL, NULL, false),
  ('00000001-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Afeitado Toalla Caliente', 40, 2500, true, 'Barba', 5, true, 'percent', 20, false),
  ('00000001-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Tinte de Barba', 30, 2000, true, 'Barba', 5, false, NULL, NULL, false),
  
  -- ===== COMBOS POPULARES (4 opciones) =====
  ('00000001-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'Corte + Barba', 50, 3200, true, 'Combo', 10, true, 'percent', 20, false),
  ('00000001-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'Fade + Barba Premium', 65, 4000, true, 'Combo', 10, true, 'percent', 25, false),
  ('00000001-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', 'Pack Premium (Corte + Barba + Cejas)', 75, 4800, true, 'Combo', 10, true, 'percent', 30, false),
  ('00000001-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001', 'Pack Ejecutivo (Corte + Afeitado)', 60, 3800, true, 'Combo', 10, true, 'percent', 25, false),
  
  -- ===== EXTRAS Y TRATAMIENTOS (4 opciones) =====
  ('00000001-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000001', 'Arreglo de Cejas', 15, 800, true, 'Extras', 5, false, NULL, NULL, false),
  ('00000001-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000001', 'Lavado Capilar', 20, 1000, true, 'Extras', 5, false, NULL, NULL, false),
  ('00000001-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000001', 'Black Mask (Mascarilla Facial)', 30, 1500, true, 'Extras', 5, false, NULL, NULL, false),
  ('00000001-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', 'Diseño Especial (Líneas/Dibujos)', 25, 1500, true, 'Extras', 5, false, NULL, NULL, false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  duration_min = EXCLUDED.duration_min,
  price_cents = EXCLUDED.price_cents,
  active = EXCLUDED.active,
  updated_at = NOW();

-- ============================================================================
-- PASO 4: CREAR STAFF COMPLETO (5 BARBEROS)
-- ============================================================================
-- IMPORTANTE: Los 2 primeros serán los owners (asignar user_id después)

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
  role,
  user_id
) VALUES
  -- ===== OWNERS (Barberos Senior) =====
  -- ⚠️ IMPORTANTE: user_id será asignado en seed_bookfast_assign_users.sql
  ('00000002-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 
   'Josep Calafat', 'Josep', true, true, 40, '#3B82F6', 
   'Co-fundador y barbero senior. Especialista en fades y diseños modernos. 10+ años de experiencia.', 'Owner / Barbero Senior', NULL),
  
  ('00000002-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 
   'Socio Co-Founder', 'Socio', true, true, 40, '#10B981', 
   'Co-fundador y maestro barbero. Experto en barbería clásica y afeitados tradicionales.', 'Owner / Maestro Barbero', NULL),
  
  -- ===== EMPLEADOS =====
  ('00000002-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 
   'Carlos Martínez', 'Carlos', true, true, 40, '#8B5CF6', 
   'Barbero senior especializado en fades profesionales y acabados perfectos. 7 años de experiencia.', 'Barbero Senior', NULL),
  
  ('00000002-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 
   'Javier López', 'Javi', true, true, 35, '#F59E0B', 
   'Especialista en color, tintes y estilos urbanos. Preferido por clientes jóvenes.', 'Barbero', NULL),
  
  ('00000002-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 
   'David Hernández', 'David', true, true, 30, '#EF4444', 
   'Barbero junior con formación en técnicas modernas. Gran atención al cliente.', 'Barbero Junior', NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_name = EXCLUDED.display_name,
  active = EXCLUDED.active,
  updated_at = NOW();

-- ============================================================================
-- PASO 5: ASIGNAR SERVICIOS A BARBEROS
-- ============================================================================
-- Distribución por especialidad:
-- - Josep (Owner/Senior): Especialista en fades modernos y diseños - TODOS los servicios
-- - Socio (Owner/Maestro): Clásicos, barba tradicional, afeitados - servicios premium
-- - Carlos (Senior): Fades profesionales, combos - servicios variados
-- - Javier (Regular): Color, tintes, jóvenes - servicios urbanos  
-- - David (Junior): Básicos, aprendizaje - servicios simples

-- JOSEP (001) - Owner/Senior - PUEDE HACER TODO (20 servicios)
INSERT INTO public.staff_provides_services (tenant_id, staff_id, service_id)
SELECT '00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000001', s.id
FROM public.services s
WHERE s.tenant_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- SOCIO (002) - Owner/Maestro - Especialista en barba y clásicos (12 servicios)
INSERT INTO public.staff_provides_services (tenant_id, staff_id, service_id) VALUES
  -- Cortes clásicos
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000002', '00000001-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000002', '00000001-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000002', '00000001-0000-0000-0000-000000000007'),
  -- Toda la barba
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000002', '00000001-0000-0000-0000-000000000008'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000002', '00000001-0000-0000-0000-000000000009'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000002', '00000001-0000-0000-0000-000000000010'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000002', '00000001-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000002', '00000001-0000-0000-0000-000000000012'),
  -- Combos premium
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000002', '00000001-0000-0000-0000-000000000013'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000002', '00000001-0000-0000-0000-000000000014'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000002', '00000001-0000-0000-0000-000000000015'),
  -- Extras
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000002', '00000001-0000-0000-0000-000000000019')
ON CONFLICT DO NOTHING;

-- CARLOS (003) - Senior - Fades profesionales y combos (14 servicios)
INSERT INTO public.staff_provides_services (tenant_id, staff_id, service_id) VALUES
  -- Todos los cortes excepto niños
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000003', '00000001-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000003', '00000001-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000003', '00000001-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000003', '00000001-0000-0000-0000-000000000004'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000003', '00000001-0000-0000-0000-000000000005'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000003', '00000001-0000-0000-0000-000000000007'),
  -- Barba básica
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000003', '00000001-0000-0000-0000-000000000008'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000003', '00000001-0000-0000-0000-000000000009'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000003', '00000001-0000-0000-0000-000000000011'),
  -- Todos los combos
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000003', '00000001-0000-0000-0000-000000000013'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000003', '00000001-0000-0000-0000-000000000014'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000003', '00000001-0000-0000-0000-000000000015'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000003', '00000001-0000-0000-0000-000000000016'),
  -- Cera
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000003', '00000001-0000-0000-0000-000000000020')
ON CONFLICT DO NOTHING;

-- JAVIER (004) - Regular - Color, jóvenes, urbanos (12 servicios)
INSERT INTO public.staff_provides_services (tenant_id, staff_id, service_id) VALUES
  -- Cortes jóvenes
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000004', '00000001-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000004', '00000001-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000004', '00000001-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000004', '00000001-0000-0000-0000-000000000004'),
  -- Barba básica
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000004', '00000001-0000-0000-0000-000000000008'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000004', '00000001-0000-0000-0000-000000000009'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000004', '00000001-0000-0000-0000-000000000012'),
  -- Combos básicos
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000004', '00000001-0000-0000-0000-000000000013'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000004', '00000001-0000-0000-0000-000000000016'),
  -- Extras urbanos
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000004', '00000001-0000-0000-0000-000000000017'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000004', '00000001-0000-0000-0000-000000000018'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000004', '00000001-0000-0000-0000-000000000020')
ON CONFLICT DO NOTHING;

-- DAVID (005) - Junior - Servicios básicos (8 servicios)
INSERT INTO public.staff_provides_services (tenant_id, staff_id, service_id) VALUES
  -- Cortes básicos
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000005', '00000001-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000005', '00000001-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000005', '00000001-0000-0000-0000-000000000006'),
  -- Barba simple
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000005', '00000001-0000-0000-0000-000000000008'),
  -- Combo básico
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000005', '00000001-0000-0000-0000-000000000013'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000005', '00000001-0000-0000-0000-000000000016'),
  -- Extras simples
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000005', '00000001-0000-0000-0000-000000000019'),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000005', '00000001-0000-0000-0000-000000000020')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PASO 6: CREAR HORARIOS DE TRABAJO DEL STAFF
-- ============================================================================
-- Formato: day_of_week (0=Lunes, 6=Domingo)
-- Estrategia: Turnos diferenciados para cobertura 09:00-20:00 todos los días

-- JOSEP (001) - Owner/Senior: Lunes a Sábado 09:00-17:00 (turno mañana, gestión)
INSERT INTO public.staff_schedules (tenant_id, staff_id, day_of_week, start_time, end_time, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000001', 0, '09:00', '17:00', true),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000001', 1, '09:00', '17:00', true),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000001', 2, '09:00', '17:00', true),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000001', 3, '09:00', '17:00', true),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000001', 4, '09:00', '17:00', true),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000001', 5, '09:00', '14:00', true)
ON CONFLICT DO NOTHING;

-- SOCIO (002) - Owner/Maestro: Martes a Sábado 10:00-19:00 (horario premium)
INSERT INTO public.staff_schedules (tenant_id, staff_id, day_of_week, start_time, end_time, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000002', 1, '10:00', '19:00', true),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000002', 2, '10:00', '19:00', true),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000002', 3, '10:00', '19:00', true),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000002', 4, '10:00', '19:00', true),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000002', 5, '10:00', '19:00', true)
ON CONFLICT DO NOTHING;

-- CARLOS (003) - Senior: Lunes a Viernes 12:00-20:00, Sábado 10:00-18:00 (turno tarde)
INSERT INTO public.staff_schedules (tenant_id, staff_id, day_of_week, start_time, end_time, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000003', 0, '12:00', '20:00', true),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000003', 1, '12:00', '20:00', true),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000003', 2, '12:00', '20:00', true),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000003', 3, '12:00', '20:00', true),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000003', 4, '12:00', '20:00', true),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000003', 5, '10:00', '18:00', true)
ON CONFLICT DO NOTHING;

-- JAVIER (004) - Regular: Miércoles a Domingo 11:00-19:00 (incluye fin de semana)
INSERT INTO public.staff_schedules (tenant_id, staff_id, day_of_week, start_time, end_time, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000004', 2, '11:00', '19:00', true),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000004', 3, '11:00', '19:00', true),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000004', 4, '11:00', '19:00', true),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000004', 5, '11:00', '19:00', true),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000004', 6, '10:00', '14:00', true)
ON CONFLICT DO NOTHING;

-- DAVID (005) - Junior: Lunes, Martes, Jueves, Viernes, Sábado 10:00-18:00 (rotativo)
INSERT INTO public.staff_schedules (tenant_id, staff_id, day_of_week, start_time, end_time, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000005', 0, '10:00', '18:00', true),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000005', 1, '10:00', '18:00', true),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000005', 3, '10:00', '18:00', true),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000005', 4, '10:00', '18:00', true),
  ('00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000005', 5, '10:00', '18:00', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PASO 7: CREAR CLIENTES
-- ============================================================================
-- Generación de 400 clientes con distribución realista
-- Distribución: 10% VIP (40), 75% regular (300), 15% ocasional (60)

DO $$
DECLARE
  v_nombres TEXT[] := ARRAY[
    'Alberto', 'Roberto', 'Carlos', 'Miguel', 'David', 'Javier', 'Antonio', 'Francisco', 'Manuel', 'José',
    'Luis', 'Pedro', 'Sergio', 'Pablo', 'Raúl', 'Adrián', 'Iván', 'Óscar', 'Álvaro', 'Jorge',
    'Rubén', 'Daniel', 'Marcos', 'Hugo', 'Víctor', 'Samuel', 'Guillermo', 'Andrés', 'Mario', 'Fernando',
    'Rafael', 'Tomás', 'Enrique', 'Ignacio', 'Lorenzo', 'Mateo', 'Gonzalo', 'Rodrigo', 'Emilio', 'Felipe',
    'Alejandro', 'Gabriel', 'Diego', 'Lucas', 'Martín', 'Nicolás', 'Santiago', 'Simón', 'Eduardo', 'Ricardo'
  ];
  v_apellidos TEXT[] := ARRAY[
    'García', 'López', 'Martínez', 'Sánchez', 'Fernández', 'Romero', 'Torres', 'Navarro', 'Gil', 'Ramírez',
    'Castro', 'Ortiz', 'Rubio', 'Molina', 'Delgado', 'Méndez', 'Vega', 'Herrera', 'Peña', 'Campos',
    'Prieto', 'Vargas', 'Nieto', 'Ibáñez', 'Cordero', 'Moreno', 'Álvarez', 'Jiménez', 'Ruiz', 'Díaz',
    'Muñoz', 'González', 'Rodríguez', 'Pérez', 'Guerrero', 'Flores', 'Reyes', 'Medina', 'Silva', 'Rojas'
  ];
  v_tags TEXT[];
  v_email TEXT;
  v_email_local TEXT;
  v_email_base TEXT;
  v_email_candidate TEXT;
  v_email_suffix INT;
  v_phone TEXT;
  v_birth DATE;
  v_is_vip BOOLEAN;
  v_preferred_time TEXT;
  v_notes TEXT;
  i INT;
BEGIN
  FOR i IN 1..400 LOOP
    -- Determinar VIP (primeros 40 = 10%)
    v_is_vip := (i <= 40);
    
    -- Email: 85% tiene email
    IF random() < 0.85 THEN
      v_email_local := lower(
        v_nombres[1 + (i % array_length(v_nombres, 1))] || '.' ||
        v_apellidos[1 + ((i * 7) % array_length(v_apellidos, 1))]
      );

      -- Normalización ASCII-safe para cumplir customers_email_format_ck
      -- 1) Transliteration de tildes/diacríticos comunes (España)
      -- 2) Eliminación de cualquier carácter fuera de [a-z0-9._%+-]
      v_email_local := translate(
        v_email_local,
        'áàäâãåÁÀÄÂÃÅéèëêÉÈËÊíìïîÍÌÏÎóòöôõÓÒÖÔÕúùüûÚÙÜÛñÑçÇ',
        'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUnNcC'
      );
      v_email_local := regexp_replace(v_email_local, '[^a-z0-9._%+\-]', '', 'g');

      -- Resolver colisiones del constraint unique_email_per_tenant
      -- Base: nombre.apellido; si existe, usar nombre.apellido.2, .3, ...
      v_email_base := v_email_local;
      v_email_candidate := v_email_base;
      v_email_suffix := 1;
      WHILE EXISTS (
        SELECT 1
        FROM public.customers c
        WHERE c.tenant_id = '00000000-0000-0000-0000-000000000001'
          AND c.email = (v_email_candidate || '@email.com')
      ) LOOP
        v_email_suffix := v_email_suffix + 1;
        v_email_candidate := v_email_base || '.' || v_email_suffix::TEXT;
      END LOOP;

      v_email := v_email_candidate || '@email.com';
    ELSE
      v_email := NULL;
    END IF;
    
    -- Teléfono: formato español
    v_phone := '+34 6' || LPAD((12000000 + i)::TEXT, 8, '0');
    
    -- Fecha nacimiento: 18-70 años
    v_birth := CURRENT_DATE - ((random() * 52 * 365 + 18 * 365)::INT || ' days')::INTERVAL;
    
    -- Tags basados en edad y VIP status
    IF v_is_vip THEN
      v_tags := ARRAY['vip', CASE WHEN random() < 0.5 THEN 'puntual' ELSE 'mensual' END];
      v_notes := 'Cliente VIP desde hace ' || (1 + (random() * 4)::INT)::TEXT || ' años.';
    ELSIF EXTRACT(YEAR FROM AGE(v_birth)) < 25 THEN
      v_tags := ARRAY['joven'];
      v_notes := NULL;
    ELSIF EXTRACT(YEAR FROM AGE(v_birth)) > 60 THEN
      v_tags := ARRAY['senior'];
      v_notes := NULL;
    ELSE
      v_tags := ARRAY['regular'];
      v_notes := NULL;
    END IF;
    
    -- Preferencia horaria
    v_preferred_time := CASE (i % 4)
      WHEN 0 THEN 'mañana'
      WHEN 1 THEN 'tarde'
      WHEN 2 THEN 'noche'
      ELSE NULL
    END;
    
    -- Insertar cliente
    INSERT INTO public.customers (
      id,
      tenant_id,
      name,
      email,
      phone,
      birth_date,
      tags,
      is_vip,
      marketing_opt_in,
      preferred_time_of_day,
      internal_notes
    ) VALUES (
      ('00000003-0000-0000-0000-' || LPAD(i::TEXT, 12, '0'))::uuid,
      '00000000-0000-0000-0000-000000000001',
      v_nombres[1 + (i % array_length(v_nombres, 1))] || ' ' || 
      v_apellidos[1 + ((i * 3) % array_length(v_apellidos, 1))] || ' ' || 
      v_apellidos[1 + ((i * 7) % array_length(v_apellidos, 1))],
      v_email,
      v_phone,
      v_birth,
      v_tags,
      v_is_vip,
      (v_email IS NOT NULL),
      v_preferred_time,
      v_notes
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      updated_at = NOW();
  END LOOP;
  
  RAISE NOTICE '✅ Generados 400 clientes (40 VIP, 360 regulares)';
END $$;

-- ============================================================================
-- PASO 8: CREAR RESERVAS HISTÓRICAS Y FUTURAS
-- ============================================================================
-- ⚠️ LAS RESERVAS SE GENERAN EN ARCHIVO SEPARADO: seed_bookfast_bookings.sql
-- 
-- Razón: La generación de 2500-4000 reservas con:
-- - Horizonte temporal: 12/12/2024 a 12/12/2026 (2 años)
-- - Estados: completed (pasadas), confirmed (futuras), no_show, cancelled
-- - Sin solapamientos (EXCLUDE constraint)
-- - Respeto de staff_schedules
-- - Distribución realista de servicios
--
-- Se ejecuta mediante función helper generate_bookfast_bookings() que:
-- 1. Respeta la constraint EXCLUDE on bookings(tenant_id, staff_id, slot)
-- 2. Solo crea reservas en horarios válidos de cada barbero
-- 3. Aplica distribución probabilística: 70% Corte, 20% Barba, 10% Combos
-- 4. Genera concentración en viernes/sábado, menor actividad domingos
-- 5. Asigna estados: COMPLETED si < NOW(), CONFIRMED si >= NOW()
--
-- 👉 Ejecutar seed_bookfast_bookings.sql DESPUÉS de este archivo

-- ============================================================================
-- PASO 9: CREAR BLOQUEOS DE STAFF (Vacaciones, ausencias)
-- ============================================================================
-- Añadir realismo con períodos de vacaciones y ausencias

INSERT INTO public.staff_blockings (
  id,
  tenant_id,
  staff_id,
  start_at,
  end_at,
  type,
  reason,
  notes,
  created_at,
  created_by
) VALUES
  -- Vacaciones Josep (verano 2025)
  ('00000004-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000001', 
   '2025-08-01 00:00:00+00', '2025-08-15 23:59:59+00', 'vacation', 'Vacaciones verano', NULL, NOW(), NULL),
  
  -- Vacaciones Socio (navidad 2024)
  ('00000004-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000002', 
   '2024-12-23 00:00:00+00', '2025-01-07 23:59:59+00', 'vacation', 'Vacaciones navidad', NULL, NOW(), NULL),
  
  -- Vacaciones Carlos (semana santa 2025)
  ('00000004-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000003', 
   '2025-04-14 00:00:00+00', '2025-04-21 23:59:59+00', 'vacation', 'Vacaciones Semana Santa', NULL, NOW(), NULL),
  
  -- Baja médica Javier (ejemplo)
  ('00000004-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000004', 
    '2025-03-10 00:00:00+00', '2025-03-14 23:59:59+00', 'absence', 'Baja médica', NULL, NOW(), NULL),
  
  -- Vacaciones David (agosto 2025)
  ('00000004-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000005', 
   '2025-08-16 00:00:00+00', '2025-08-31 23:59:59+00', 'vacation', 'Vacaciones verano', NULL, NOW(), NULL),
  
  -- Formación Josep (evento futuro)
  ('00000004-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '00000002-0000-0000-0000-000000000001', 
    '2025-11-20 00:00:00+00', '2025-11-22 23:59:59+00', 'block', 'Formación barbería avanzada', NULL, NOW(), NULL)
ON CONFLICT DO NOTHING;
COMMIT;

-- ============================================================================
-- VALIDACIONES POST-INSERCIÓN
-- ============================================================================
-- Ejecutar estas queries para verificar que todo está correcto:

-- 1. Verificar tenant creado
-- SELECT * FROM public.tenants WHERE id = '00000000-0000-0000-0000-000000000001';

-- 2. Verificar servicios
-- SELECT COUNT(*) as total_servicios FROM public.services WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- 3. Verificar staff
-- SELECT COUNT(*) as total_staff FROM public.staff WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- 4. Verificar horarios
-- SELECT s.display_name, COUNT(ss.id) as dias_trabajo
-- FROM public.staff s
-- JOIN public.staff_schedules ss ON ss.staff_id = s.id
-- WHERE s.tenant_id = '00000000-0000-0000-0000-000000000001'
-- GROUP BY s.id, s.display_name;

-- 5. Verificar clientes
-- SELECT COUNT(*) as total_clientes FROM public.customers WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- 6. Verificar servicios por barbero
-- SELECT s.display_name, COUNT(sps.service_id) as servicios_habilitados
-- FROM public.staff s
-- LEFT JOIN public.staff_provides_services sps ON sps.staff_id = s.id
-- WHERE s.tenant_id = '00000000-0000-0000-0000-000000000001'
-- GROUP BY s.id, s.display_name;

-- ============================================================================
-- SIGUIENTE PASO: CREAR RESERVAS
-- ============================================================================
-- Ver archivo: seed_bookfast_bookings.sql
-- (Se creará en un archivo separado para facilitar ajustes sin rehacer todo)

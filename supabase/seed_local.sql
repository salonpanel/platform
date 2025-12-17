-- BookFast Pro – Local Seed (non-production)
-- Purpose: operations that should NOT live in baseline but help local dev

-- 1) Refresh materialized views after local data is present
-- (Run this after seeding minimal data for tenants/customers/bookings/payments)
DO $$
BEGIN
  PERFORM 1;
  -- Replace with actual mat view names present in baseline
  -- Example refreshes:
  -- REFRESH MATERIALIZED VIEW public.daily_dashboard_kpis;
  -- REFRESH MATERIALIZED VIEW public.vw_booking_overview_mat;
  -- REFRESH MATERIALIZED VIEW public.vw_customer_summary;
  -- REFRESH MATERIALIZED VIEW public.vw_staff_overview_mat;
  -- REFRESH MATERIALIZED VIEW public.vw_customer_summary_mat;
END $$;

-- 2) Optional indexes for mat views (performance helpers for local dev)
-- Note: keep these in seed to avoid coupling prod baseline to local perf choices
-- Example index suggestions (enable if views exist):
-- CREATE INDEX IF NOT EXISTS idx_daily_dashboard_kpis_tenant_date ON public.daily_dashboard_kpis(tenant_id, kpi_date);
-- CREATE INDEX IF NOT EXISTS idx_vw_booking_overview_tenant_starts ON public.vw_booking_overview_mat(tenant_id, starts_at);
-- CREATE INDEX IF NOT EXISTS idx_vw_customer_summary_tenant_customer ON public.vw_customer_summary_mat(tenant_id, customer_id);
-- CREATE INDEX IF NOT EXISTS idx_vw_staff_overview_tenant_staff ON public.vw_staff_overview_mat(tenant_id, staff_id);

-- 3) Minimal local data seed (safe defaults)
-- NOTE: Adapt these inserts to your actual column definitions once baseline is applied.
-- INSERT INTO public.tenants(id, name, slug, timezone)
-- VALUES (gen_random_uuid(), 'Local Demo Tenant', 'local-demo', 'Europe/Madrid') ON CONFLICT DO NOTHING;

-- INSERT INTO public.memberships(tenant_id, user_id, role)
-- SELECT t.id, auth.uid(), 'owner' FROM public.tenants t WHERE t.slug = 'local-demo'
-- ON CONFLICT DO NOTHING;

-- 4) Local-only configuration examples (do not ship to prod baseline)
-- -- e.g., feature flags, debug toggles, etc.-- =============================================
-- BOOKFAST PRO - SEED LOCAL (DESARROLLO)
-- Fecha: 2025-12-12
-- Datos mínimos para desarrollo local
-- =============================================

-- =============================================
-- NOTA: Ejecutar después de aplicar baseline
-- =============================================
-- Este seed crea:
-- 1. Usuario admin de prueba en auth.users
-- 2. Tenant de ejemplo
-- 3. Membership del admin al tenant
-- 4. Profile básico
-- 5. Configuración del tenant
-- =============================================

BEGIN;

-- =============================================
-- 1. CREAR USUARIO ADMIN DE PRUEBA
-- =============================================
-- IMPORTANTE: Supabase CLI creará automáticamente usuarios en auth.users
-- Después del reset, crear usuario manualmente en dashboard o con:
-- supabase auth signup --email admin@bookfast.test --password Admin123!

-- Asumimos que el usuario ya existe o será creado.
-- UUID fijo para desarrollo local
DO $$
DECLARE
  v_admin_id uuid := 'd5b5e5f5-6f5e-5f5e-6f5e-5f5e6f5e6f5e';
  v_tenant_id uuid;
BEGIN
  -- Verificar si el usuario existe en auth.users
  -- (en desarrollo local usaremos un UUID predecible)
  
  -- =============================================
  -- 2. CREAR TENANT DE EJEMPLO
  -- =============================================
  INSERT INTO public.tenants (id, name, slug, timezone, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'Demo Barbershop',
    'demo-barbershop',
    'Europe/Madrid',
    now(),
    now()
  )
  RETURNING id INTO v_tenant_id;
  
  RAISE NOTICE 'Tenant creado con ID: %', v_tenant_id;
  
  -- =============================================
  -- 3. CREAR CONFIGURACIÓN DEL TENANT
  -- =============================================
  INSERT INTO public.tenant_settings (tenant_id, settings)
  VALUES (
    v_tenant_id,
    jsonb_build_object(
      'business_hours', jsonb_build_object(
        'monday', jsonb_build_object('open', '09:00', 'close', '20:00', 'enabled', true),
        'tuesday', jsonb_build_object('open', '09:00', 'close', '20:00', 'enabled', true),
        'wednesday', jsonb_build_object('open', '09:00', 'close', '20:00', 'enabled', true),
        'thursday', jsonb_build_object('open', '09:00', 'close', '20:00', 'enabled', true),
        'friday', jsonb_build_object('open', '09:00', 'close', '20:00', 'enabled', true),
        'saturday', jsonb_build_object('open', '10:00', 'close', '18:00', 'enabled', true),
        'sunday', jsonb_build_object('open', '10:00', 'close', '14:00', 'enabled', false)
      ),
      'booking_settings', jsonb_build_object(
        'advance_days', 30,
        'same_day_enabled', true,
        'confirmation_required', false,
        'cancellation_hours', 24
      ),
      'notifications', jsonb_build_object(
        'email_enabled', true,
        'sms_enabled', false,
        'reminder_hours', 24
      )
    )
  );
  
  RAISE NOTICE 'Configuración del tenant creada';
  
  -- =============================================
  -- NOTA IMPORTANTE: USUARIOS Y MEMBERSHIPS
  -- =============================================
  -- Los usuarios deben crearse en auth.users primero
  -- Después del db reset, ejecutar:
  --
  -- supabase auth signup --email admin@bookfast.test --password Admin123!
  --
  -- Y luego crear el membership manualmente:
  --
  -- INSERT INTO public.memberships (tenant_id, user_id, role)
  -- VALUES ('<tenant_id>', '<user_id>', 'owner');
  --
  -- INSERT INTO public.profiles (user_id, display_name)
  -- VALUES ('<user_id>', 'Admin Demo');
  
END $$;

-- =============================================
-- 4. DATOS DE EJEMPLO (OPCIONAL)
-- =============================================
-- Puedes agregar servicios, staff, etc. aquí
-- Ejemplo:

-- INSERT INTO public.services (tenant_id, name, category, duration_min, price_cents, active)
-- SELECT 
--   t.id,
--   'Corte Clásico',
--   'Cortes',
--   30,
--   1500,
--   true
-- FROM public.tenants t
-- WHERE t.slug = 'demo-barbershop';

COMMIT;

-- =============================================
-- VERIFICACIÓN
-- =============================================
SELECT 
  'Tenants creados:' as tipo,
  count(*) as cantidad
FROM public.tenants;

SELECT 
  'Configuraciones creadas:' as tipo,
  count(*) as cantidad
FROM public.tenant_settings;

-- =============================================
-- INSTRUCCIONES POST-SEED
-- =============================================
/*

1. Crear usuario admin:
   supabase auth signup --email admin@bookfast.test --password Admin123!

2. Obtener el ID del usuario (copiar de dashboard o de confirmación)

3. Obtener el ID del tenant:
   SELECT id, slug FROM public.tenants WHERE slug = 'demo-barbershop';

4. Crear membership:
   INSERT INTO public.memberships (tenant_id, user_id, role, created_at)
   VALUES ('<tenant_id>', '<user_id>', 'owner', now());

5. Crear profile:
   INSERT INTO public.profiles (user_id, display_name, created_at, updated_at)
   VALUES ('<user_id>', 'Admin Demo', now(), now());

6. Login:
   supabase auth login --email admin@bookfast.test --password Admin123!

*/

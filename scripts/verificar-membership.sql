-- ============================================================================
-- SCRIPT DE VERIFICACIÓN DE MEMBERSHIP
-- ============================================================================
-- Este script verifica que el usuario tiene un membership válido
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================================================

-- IMPORTANTE: Reemplaza 'u0136986872@gmail.com' con tu email de prueba
-- o ejecuta la consulta directamente con tu user_id

-- 1. Verificar que el usuario existe en auth.users
SELECT 
  'Usuario en auth.users' as check_item,
  id as user_id,
  email,
  created_at,
  email_confirmed_at,
  CASE 
    WHEN email_confirmed_at IS NOT NULL THEN '✅ Email confirmado'
    ELSE '⚠️ Email NO confirmado'
  END as email_status
FROM auth.users
WHERE email = 'u0136986872@gmail.com';

-- 2. Verificar que existe un membership para este usuario
SELECT 
  'Membership encontrado' as check_item,
  m.id as membership_id,
  m.tenant_id,
  m.user_id,
  m.role,
  m.created_at as membership_created,
  t.name as tenant_name,
  t.slug as tenant_slug,
  t.timezone as tenant_timezone,
  CASE 
    WHEN m.id IS NOT NULL THEN '✅ Membership existe'
    ELSE '❌ Membership NO existe'
  END as membership_status
FROM auth.users u
LEFT JOIN public.memberships m ON m.user_id = u.id
LEFT JOIN public.tenants t ON t.id = m.tenant_id
WHERE u.email = 'u0136986872@gmail.com';

-- 3. Verificar que el tenant del membership existe y es válido
SELECT 
  'Tenant del membership' as check_item,
  t.id as tenant_id,
  t.name as tenant_name,
  t.slug as tenant_slug,
  t.timezone as tenant_timezone,
  t.created_at as tenant_created,
  CASE 
    WHEN t.id IS NOT NULL THEN '✅ Tenant existe'
    ELSE '❌ Tenant NO existe'
  END as tenant_status
FROM auth.users u
JOIN public.memberships m ON m.user_id = u.id
LEFT JOIN public.tenants t ON t.id = m.tenant_id
WHERE u.email = 'u0136986872@gmail.com';

-- 4. Verificar políticas RLS de memberships
SELECT 
  'Políticas RLS de memberships' as check_item,
  policyname,
  cmd as command_type,
  CASE 
    WHEN qual IS NOT NULL THEN 'Tiene condición'
    ELSE 'Sin condición'
  END as has_condition
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'memberships'
ORDER BY policyname;

-- 5. Verificar políticas RLS de tenants
SELECT 
  'Políticas RLS de tenants' as check_item,
  policyname,
  cmd as command_type,
  CASE 
    WHEN qual IS NOT NULL THEN 'Tiene condición'
    ELSE 'Sin condición'
  END as has_condition
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tenants'
ORDER BY policyname;

-- 6. Resumen completo
DO $$
DECLARE
  v_user_id uuid;
  v_user_exists boolean;
  v_membership_exists boolean;
  v_tenant_exists boolean;
  v_membership_count int;
  v_tenant_id uuid;
BEGIN
  -- Buscar usuario
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'u0136986872@gmail.com';

  v_user_exists := v_user_id IS NOT NULL;

  IF v_user_exists THEN
    RAISE NOTICE '✅ Usuario encontrado: %', v_user_id;
  ELSE
    RAISE NOTICE '❌ Usuario NO encontrado';
    RETURN;
  END IF;

  -- Verificar membership
  SELECT COUNT(*), MAX(tenant_id) INTO v_membership_count, v_tenant_id
  FROM public.memberships
  WHERE user_id = v_user_id;

  v_membership_exists := v_membership_count > 0;

  IF v_membership_exists THEN
    RAISE NOTICE '✅ Membership encontrado: % membership(s)', v_membership_count;
    RAISE NOTICE '   Tenant ID: %', v_tenant_id;
  ELSE
    RAISE NOTICE '❌ Membership NO encontrado';
    RAISE NOTICE '   Ejecuta scripts/create-memberships-and-link-user.sql';
    RETURN;
  END IF;

  -- Verificar tenant
  IF v_tenant_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.tenants WHERE id = v_tenant_id
    ) INTO v_tenant_exists;

    IF v_tenant_exists THEN
      RAISE NOTICE '✅ Tenant existe: %', v_tenant_id;
    ELSE
      RAISE NOTICE '❌ Tenant NO existe: %', v_tenant_id;
      RAISE NOTICE '   Ejecuta scripts/verificar-y-corregir-base-datos-completo.sql';
    END IF;
  END IF;

  -- Resumen final
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  IF v_user_exists AND v_membership_exists AND v_tenant_exists THEN
    RAISE NOTICE '✅ TODO CORRECTO - El usuario puede acceder a /panel';
  ELSE
    RAISE NOTICE '⚠️ HAY PROBLEMAS - Revisa los errores arriba';
  END IF;
  RAISE NOTICE '========================================';
END $$;

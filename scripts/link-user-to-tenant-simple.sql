-- ============================================================================
-- SCRIPT SIMPLE PARA VINCULAR USUARIO AL TENANT DEMO
-- ============================================================================
-- Este script vincula el usuario de prueba al tenant demo
-- Ejecuta este script DESPUÉS de ejecutar fix-memberships-table-and-rls.sql
-- ============================================================================

-- IMPORTANTE: Reemplaza 'u0136986872@gmail.com' con tu email de prueba si es diferente

DO $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; -- ID del tenant demo
  v_membership_exists boolean;
BEGIN
  -- 1. Buscar el usuario por email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'u0136986872@gmail.com';

  -- Si no se encuentra el usuario, mostrar error
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario con email u0136986872@gmail.com no encontrado en auth.users. Verifica que el usuario existe en Authentication > Users';
  END IF;

  RAISE NOTICE '✅ Usuario encontrado: %', v_user_id;

  -- 2. Verificar que el tenant existe
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = v_tenant_id) THEN
    RAISE EXCEPTION 'Tenant demo (aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa) no encontrado. Ejecuta primero scripts/verificar-y-corregir-base-datos-completo.sql';
  END IF;

  RAISE NOTICE '✅ Tenant demo existe';

  -- 3. Verificar si ya existe membership
  SELECT EXISTS (
    SELECT 1 FROM public.memberships 
    WHERE tenant_id = v_tenant_id AND user_id = v_user_id
  ) INTO v_membership_exists;

  -- 4. Crear o actualizar membership
  IF v_membership_exists THEN
    RAISE NOTICE '📝 Membership ya existe, actualizando rol a owner...';
    UPDATE public.memberships 
    SET role = 'owner'
    WHERE tenant_id = v_tenant_id AND user_id = v_user_id;
  ELSE
    RAISE NOTICE '📝 Creando membership...';
    INSERT INTO public.memberships (tenant_id, user_id, role)
    VALUES (v_tenant_id, v_user_id, 'owner');
  END IF;

  RAISE NOTICE '✅ Usuario % vinculado al tenant demo con rol owner', v_user_id;

END $$;

-- 5. Verificar que se creó correctamente (fuera del bloque DO)
SELECT 
  m.id as membership_id,
  m.tenant_id,
  m.user_id,
  m.role,
  t.name as tenant_name,
  t.slug as tenant_slug,
  u.email as user_email,
  m.created_at
FROM public.memberships m
JOIN public.tenants t ON t.id = m.tenant_id
JOIN auth.users u ON u.id = m.user_id
WHERE u.email = 'u0136986872@gmail.com'
AND m.tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';


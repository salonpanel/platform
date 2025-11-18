-- Script para corregir las políticas RLS de tenants
-- Ejecuta este script en el SQL Editor de Supabase

-- 1. Verificar políticas actuales
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tenants';

-- 2. Eliminar políticas problemáticas
DROP POLICY IF EXISTS "users_read_own_tenant" ON public.tenants;
DROP POLICY IF EXISTS "users_read_tenant_membership" ON public.tenants;
DROP POLICY IF EXISTS "public_read_tenants" ON public.tenants;
DROP POLICY IF EXISTS "tenant_read_tenants" ON public.tenants;

-- 3. Crear política simple: usuarios pueden leer tenants donde tienen membership
CREATE POLICY "users_read_tenant_membership" ON public.tenants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid()
    AND m.tenant_id = tenants.id
  )
);

-- 4. Verificar que se creó correctamente
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tenants';

-- 5. Probar consulta (simula lo que hace getCurrentTenant)
-- Reemplaza 'USER_ID_AQUI' con el UUID del usuario
DO $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_tenant_count int;
BEGIN
  -- Obtener ID del usuario
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'u0136986872@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ Usuario no encontrado';
    RETURN;
  END IF;

  RAISE NOTICE '✅ Usuario encontrado: %', v_user_id;

  -- Verificar que el tenant existe
  SELECT COUNT(*) INTO v_tenant_count
  FROM public.tenants
  WHERE id = v_tenant_id;

  IF v_tenant_count = 0 THEN
    RAISE NOTICE '❌ Tenant no encontrado: %', v_tenant_id;
    RAISE NOTICE '   Ejecuta las migraciones de seeds (0019_seed_booking_demo.sql)';
  ELSE
    RAISE NOTICE '✅ Tenant existe en la base de datos';
  END IF;

  -- Verificar membership
  SELECT COUNT(*) INTO v_tenant_count
  FROM public.memberships
  WHERE user_id = v_user_id
  AND tenant_id = v_tenant_id;

  IF v_tenant_count = 0 THEN
    RAISE NOTICE '❌ Membership no encontrado';
    RAISE NOTICE '   Ejecuta scripts/create-memberships-and-link-user.sql';
  ELSE
    RAISE NOTICE '✅ Membership existe';
  END IF;
END $$;







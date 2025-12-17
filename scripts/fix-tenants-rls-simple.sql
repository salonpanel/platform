-- Script SIMPLE para corregir políticas RLS de tenants y solucionar error 500
-- Ejecuta este script en el SQL Editor de Supabase

-- IMPORTANTE: Este script elimina todas las políticas y crea una nueva simple

-- 1. Eliminar TODAS las políticas existentes de tenants
DROP POLICY IF EXISTS "tenant_read_tenants" ON public.tenants;
DROP POLICY IF EXISTS "users_read_own_tenant" ON public.tenants;
DROP POLICY IF EXISTS "users_read_tenant_membership" ON public.tenants;
DROP POLICY IF EXISTS "public_read_tenants" ON public.tenants;

-- 2. Verificar que no quedan políticas
SELECT COUNT(*) as policies_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tenants';

-- 3. Crear política MUY SIMPLE que solo verifica memberships
-- Sin referencias a otras tablas que puedan causar errores
CREATE POLICY "tenant_read_tenants" ON public.tenants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.memberships 
    WHERE memberships.user_id = auth.uid()
      AND memberships.tenant_id = tenants.id
  )
);

-- 4. Verificar que se creó correctamente
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN 'Tiene condición'
    ELSE 'Sin condición'
  END as has_condition
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tenants';

-- 5. Probar que el tenant es accesible (simula lo que hace el cliente)
-- Nota: Esto solo funciona si ejecutas como el usuario, pero es útil para diagnóstico
DO $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_has_membership boolean;
  v_tenant_exists boolean;
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
  SELECT EXISTS (
    SELECT 1 FROM public.tenants WHERE id = v_tenant_id
  ) INTO v_tenant_exists;

  IF NOT v_tenant_exists THEN
    RAISE NOTICE '❌ Tenant no existe: %', v_tenant_id;
    RAISE NOTICE '   Ejecuta las migraciones de seeds';
    RETURN;
  END IF;

  RAISE NOTICE '✅ Tenant existe en la base de datos';

  -- Verificar membership
  SELECT EXISTS (
    SELECT 1 
    FROM public.memberships 
    WHERE user_id = v_user_id 
      AND tenant_id = v_tenant_id
  ) INTO v_has_membership;

  IF NOT v_has_membership THEN
    RAISE NOTICE '❌ Membership no existe';
    RAISE NOTICE '   Ejecuta scripts/create-memberships-and-link-user.sql';
    RETURN;
  END IF;

  RAISE NOTICE '✅ Membership existe';
  RAISE NOTICE '✅ Todo está correcto. El problema puede ser RLS o sesión.';
  RAISE NOTICE '   Verifica que estás autenticado correctamente en el navegador.';
END $$;









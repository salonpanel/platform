-- Script COMPLETO para corregir app.current_tenant_id() y políticas RLS
-- Ejecuta este script en el SQL Editor de Supabase

-- 1. Actualizar función app.current_tenant_id() para usar memberships
CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Primero intentar buscar en memberships
  SELECT tenant_id INTO v_tenant_id
  FROM public.memberships
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;

  -- Si no se encuentra en memberships, intentar en users (compatibilidad)
  IF v_tenant_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = 'users') THEN
      SELECT tenant_id INTO v_tenant_id
      FROM public.users
      WHERE id = auth.uid()
      LIMIT 1;
    END IF;
  END IF;

  RETURN v_tenant_id;
END;
$$;

-- 2. Eliminar políticas problemáticas de tenants
DROP POLICY IF EXISTS "tenant_read_tenants" ON public.tenants;
DROP POLICY IF EXISTS "users_read_own_tenant" ON public.tenants;
DROP POLICY IF EXISTS "users_read_tenant_membership" ON public.tenants;

-- 3. Crear política simple que use memberships directamente
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
    WHEN qual IS NOT NULL THEN substring(qual, 1, 100)
    ELSE 'Sin condición'
  END as condition_preview
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tenants';

-- 5. Probar la función current_tenant_id
-- Nota: Esto solo funciona si ejecutas como el usuario autenticado
DO $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'u0136986872@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ Usuario no encontrado';
    RETURN;
  END IF;

  RAISE NOTICE '✅ Usuario encontrado: %', v_user_id;
  RAISE NOTICE '📋 Para probar desde el cliente, ejecuta:';
  RAISE NOTICE '   SELECT app.current_tenant_id();';
END $$;

-- 6. Verificar que todo está correcto
SELECT 
  'Tenant existe' as check_item,
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.tenants WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    THEN '✅'
    ELSE '❌'
  END as status
UNION ALL
SELECT 
  'Membership existe',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.memberships m
      JOIN auth.users u ON u.id = m.user_id
      WHERE u.email = 'u0136986872@gmail.com'
      AND m.tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    )
    THEN '✅'
    ELSE '❌'
  END
UNION ALL
SELECT 
  'Política RLS existe',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename = 'tenants'
      AND policyname = 'tenant_read_tenants'
    )
    THEN '✅'
    ELSE '❌'
  END
UNION ALL
SELECT 
  'Función current_tenant_id existe',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines
      WHERE routine_schema = 'app'
      AND routine_name = 'current_tenant_id'
    )
    THEN '✅'
    ELSE '❌'
  END;









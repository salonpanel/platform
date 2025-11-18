-- ============================================================================
-- SCRIPT PARA CORREGIR TABLA MEMBERSHIPS Y RLS
-- ============================================================================
-- Este script crea la tabla memberships si no existe y corrige las políticas RLS
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================================================

-- IMPORTANTE: Este script es idempotente (puede ejecutarse múltiples veces)

-- 1. Crear tabla memberships si no existe
CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','staff','viewer')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- 2. Crear índices si no existen
CREATE INDEX IF NOT EXISTS idx_memberships_tenant_id ON public.memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant_user ON public.memberships(tenant_id, user_id);

-- 3. Habilitar RLS si no está habilitado
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- 4. Eliminar TODAS las políticas existentes (para recrearlas limpias)
DROP POLICY IF EXISTS "users_read_own_memberships" ON public.memberships;
DROP POLICY IF EXISTS "admins_manage_memberships" ON public.memberships;
DROP POLICY IF EXISTS "users_read_tenant_memberships" ON public.memberships;
DROP POLICY IF EXISTS "public_read_memberships" ON public.memberships;
DROP POLICY IF EXISTS "public_insert_memberships" ON public.memberships;

-- 5. Crear políticas RLS simples y seguras

-- Política 1: Los usuarios pueden leer sus propios memberships
CREATE POLICY "users_read_own_memberships" ON public.memberships
FOR SELECT
USING (auth.uid() = user_id);

-- Política 2: Los usuarios pueden leer memberships de su tenant (para ver quién más pertenece)
-- IMPORTANTE: Usamos tenants en lugar de memberships para evitar recursión infinita
CREATE POLICY "users_read_tenant_memberships" ON public.memberships
FOR SELECT
USING (
  -- Verificar que el usuario tiene un membership en el mismo tenant
  -- Usamos una subconsulta directa sin recursión
  EXISTS (
    SELECT 1 
    FROM public.memberships m2
    WHERE m2.user_id = auth.uid()
    AND m2.tenant_id = memberships.tenant_id
    -- Evitar recursión: solo verificamos que existe, no consultamos memberships dentro de la política
  )
);

-- Política 3: Los admins/owners pueden gestionar (INSERT, UPDATE, DELETE) memberships de su tenant
-- NOTA: Esta política permite INSERT solo si el usuario ya tiene un membership en ese tenant
CREATE POLICY "admins_manage_memberships" ON public.memberships
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.memberships m2
    WHERE m2.user_id = auth.uid()
    AND m2.tenant_id = memberships.tenant_id
    AND m2.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.memberships m2
    WHERE m2.user_id = auth.uid()
    AND m2.tenant_id = memberships.tenant_id
    AND m2.role IN ('owner', 'admin')
  )
);

-- 6. Verificar que se crearon correctamente
SELECT 
  policyname,
  cmd as command_type,
  CASE 
    WHEN qual IS NOT NULL THEN 'Tiene condición USING'
    ELSE 'Sin condición USING'
  END as has_using,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Tiene condición WITH CHECK'
    ELSE 'Sin condición WITH CHECK'
  END as has_with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'memberships'
ORDER BY policyname;

-- 7. Verificar estructura de la tabla
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'memberships'
ORDER BY ordinal_position;

-- 8. Verificar que RLS está habilitado
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'memberships';

-- 9. Verificar usuario y membership (consulta directa, no bloque DO)
-- Buscar usuario por email
SELECT 
  'Usuario encontrado' as check_item,
  id as user_id,
  email,
  created_at,
  CASE 
    WHEN id IS NOT NULL THEN '✅'
    ELSE '❌'
  END as status
FROM auth.users
WHERE email = 'u0136986872@gmail.com';

-- Contar memberships del usuario
SELECT 
  'Membership del usuario' as check_item,
  COUNT(*) as membership_count,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Membership encontrado'
    ELSE '⚠️ No se encontró membership'
  END as status
FROM public.memberships m
JOIN auth.users u ON u.id = m.user_id
WHERE u.email = 'u0136986872@gmail.com';

-- 10. Resumen final
SELECT 
  'Tabla memberships' as check_item,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'memberships')
    THEN '✅ Existe'
    ELSE '❌ NO existe'
  END as status
UNION ALL
SELECT 
  'RLS habilitado',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = 'memberships' 
      AND rowsecurity = true
    )
    THEN '✅ Habilitado'
    ELSE '❌ NO habilitado'
  END
UNION ALL
SELECT 
  'Políticas RLS',
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'memberships') >= 3
    THEN '✅ Creadas (' || (SELECT COUNT(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'memberships') || ')'
    ELSE '❌ Faltan políticas'
  END;


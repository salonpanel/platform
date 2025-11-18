-- ============================================================================
-- SCRIPT FINAL PARA CORREGIR RLS DE TENANTS SIN RECURSIÓN
-- ============================================================================
-- Este script elimina TODAS las referencias a org_members y users antiguos
-- y crea una política simple que solo usa memberships
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================================================

-- PROBLEMA: La política de tenants consulta public.users que puede estar relacionada con org_members
-- SOLUCIÓN: Eliminar la parte que consulta users y dejar solo memberships

-- 1. Eliminar TODAS las políticas problemáticas de tenants
DROP POLICY IF EXISTS "tenant_read_tenants" ON public.tenants;
DROP POLICY IF EXISTS "users_read_own_tenant" ON public.tenants;
DROP POLICY IF EXISTS "users_read_tenant_membership" ON public.tenants;
DROP POLICY IF EXISTS "public_read_tenants" ON public.tenants;
DROP POLICY IF EXISTS "org members can select their orgs" ON public.tenants;

-- 2. Eliminar políticas problemáticas de org_members (si la tabla existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'org_members') THEN
    DROP POLICY IF EXISTS "org members read org_members" ON public.org_members;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orgs') THEN
    DROP POLICY IF EXISTS "org members can select their orgs" ON public.orgs;
  END IF;
END $$;

-- 3. Crear una única política SIMPLE que solo usa memberships
-- NO consulta users ni org_members para evitar recursión
CREATE POLICY "tenant_read_tenants" ON public.tenants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = tenants.id
  )
);

-- 4. Verificar que solo queda esta política
SELECT 
  policyname,
  cmd as command_type,
  CASE 
    WHEN qual IS NOT NULL THEN substring(qual, 1, 200) || '...'
    ELSE 'Sin condición'
  END as condition_preview
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tenants'
ORDER BY policyname;

-- 5. Verificar que la política NO consulta org_members ni users
SELECT 
  'Verificación de política' as check_item,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename = 'tenants'
      AND policyname = 'tenant_read_tenants'
      AND qual LIKE '%memberships%'
      AND qual NOT LIKE '%org_members%'
      AND qual NOT LIKE '%public.users%'
    )
    THEN '✅ Política correcta: solo usa memberships'
    ELSE '❌ Revisar política: puede consultar org_members o users'
  END as status;

-- 6. (Opcional) Deshabilitar RLS en org_members si ya no se usa
-- Descomenta si quieres deshabilitar RLS completamente:
/*
ALTER TABLE IF EXISTS public.org_members DISABLE ROW LEVEL SECURITY;
*/


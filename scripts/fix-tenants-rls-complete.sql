-- ============================================================================
-- SCRIPT COMPLETO PARA CORREGIR RLS DE TENANTS
-- ============================================================================
-- Este script resetea completamente las políticas RLS de tenants y crea una simple
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================================================

-- 0) Ver qué políticas hay ahora mismo en tenants (solo para ver el estado)
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tenants';

-- 1) Eliminar TODAS las políticas previas que puedan estar ensuciando
DROP POLICY IF EXISTS "tenant_read_tenants" ON public.tenants;
DROP POLICY IF EXISTS "users_read_own_tenant" ON public.tenants;
DROP POLICY IF EXISTS "users_read_tenant_membership" ON public.tenants;
DROP POLICY IF EXISTS "public_read_tenants" ON public.tenants;

-- 2) Crear una única política SIMPLE y robusta:
--    "Si el usuario tiene membership en ese tenant, puede leerlo"
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

-- 3) Verificar que solo queda esta política
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN substring(qual, 1, 200) || '...'
    ELSE 'Sin condición'
  END as condition_preview
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tenants';

-- 4) Verificar que RLS está habilitado
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'tenants';

-- ============================================================================
-- SCRIPT PARA CORREGIR RECURSIÓN INFINITA EN ORG_MEMBERS
-- ============================================================================
-- El error indica que hay recursión infinita en org_members
-- Este script elimina las políticas problemáticas de org_members
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================================================

-- PROBLEMA: La tabla org_members (antigua) tiene políticas RLS que causan recursión infinita
-- SOLUCIÓN: Eliminar todas las políticas de org_members o deshabilitar RLS

-- 1. Ver qué políticas tiene org_members actualmente
SELECT 
  policyname,
  cmd as command_type,
  CASE 
    WHEN qual IS NOT NULL THEN substring(qual, 1, 200) || '...'
    ELSE 'Sin condición'
  END as condition_preview
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'org_members'
ORDER BY policyname;

-- 2. Eliminar TODAS las políticas de org_members que causan recursión
DROP POLICY IF EXISTS "org members read org_members" ON public.org_members;
DROP POLICY IF EXISTS "org members can select their orgs" ON public.orgs;
DROP POLICY IF EXISTS "org members manage customers" ON public.customers;
DROP POLICY IF EXISTS "org members manage services" ON public.services;
DROP POLICY IF EXISTS "org members manage staff" ON public.staff;
DROP POLICY IF EXISTS "org members manage appointments" ON public.appointments;

-- 3. Si org_members ya no se usa, deshabilitar RLS (opcional)
-- Descomenta estas líneas si quieres deshabilitar RLS completamente en org_members:
/*
ALTER TABLE public.org_members DISABLE ROW LEVEL SECURITY;
*/

-- 4. Verificar que las políticas problemáticas se eliminaron
SELECT 
  'Políticas restantes en org_members' as check_item,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'org_members';

-- 5. Verificar políticas de tenants (debe usar memberships, no org_members)
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

-- 6. Asegurarse de que la política de tenants NO consulta org_members
-- Si la política de tenants consulta org_members, eliminarla y recrearla
DO $$
BEGIN
  -- Verificar si hay alguna política de tenants que consulta org_members
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'tenants'
    AND qual LIKE '%org_members%'
  ) THEN
    -- Eliminar políticas problemáticas
    DROP POLICY IF EXISTS "tenant_read_tenants" ON public.tenants;
    DROP POLICY IF EXISTS "org members can select their orgs" ON public.tenants;
    
    -- Crear política simple que usa memberships
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
    
    RAISE NOTICE '✅ Política de tenants recreada sin referencia a org_members';
  ELSE
    RAISE NOTICE '✅ La política de tenants no consulta org_members';
  END IF;
END $$;

-- 7. Verificación final
SELECT 
  'Estado final' as check_item,
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'org_members') = 0
    THEN '✅ No hay políticas en org_members'
    ELSE '⚠️ Aún hay ' || (SELECT COUNT(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'org_members') || ' políticas'
  END as status
UNION ALL
SELECT 
  'Política de tenants correcta',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename = 'tenants'
      AND policyname = 'tenant_read_tenants'
      AND qual LIKE '%memberships%'
      AND qual NOT LIKE '%org_members%'
    )
    THEN '✅ Usa memberships, no org_members'
    ELSE '❌ Revisar política de tenants'
  END;







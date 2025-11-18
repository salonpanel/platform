-- ============================================================================
-- SCRIPT PARA CORREGIR RLS DE MEMBERSHIPS SIN RECURSIÓN INFINITA
-- ============================================================================
-- Este script elimina las políticas que causan recursión infinita
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================================================

-- PROBLEMA: Las políticas que consultan memberships dentro de memberships causan recursión infinita
-- SOLUCIÓN: Eliminar esas políticas y dejar solo la política simple sin recursión

-- 1. Eliminar TODAS las políticas problemáticas
DROP POLICY IF EXISTS "users_read_own_memberships" ON public.memberships;
DROP POLICY IF EXISTS "admins_manage_memberships" ON public.memberships;
DROP POLICY IF EXISTS "users_read_tenant_memberships" ON public.memberships;
DROP POLICY IF EXISTS "public_read_memberships" ON public.memberships;
DROP POLICY IF EXISTS "public_insert_memberships" ON public.memberships;

-- 2. Crear SOLO la política simple que NO causa recursión
-- Esta política solo verifica auth.uid() = user_id, sin consultar memberships
CREATE POLICY "users_read_own_memberships" ON public.memberships
FOR SELECT
USING (auth.uid() = user_id);

-- 3. Verificar que solo queda esta política
SELECT 
  policyname,
  cmd as command_type,
  CASE 
    WHEN qual IS NOT NULL THEN substring(qual, 1, 100) || '...'
    ELSE 'Sin condición'
  END as condition_preview
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'memberships'
ORDER BY policyname;

-- 4. NOTA IMPORTANTE:
-- Esta política simple permite que los usuarios lean SOLO sus propios memberships.
-- Esto es suficiente para que el layout del panel funcione.
-- 
-- Si en el futuro necesitas que los usuarios lean memberships de otros usuarios del mismo tenant,
-- o que los admins gestionen memberships, debes usar funciones RPC con SECURITY DEFINER
-- que bypass RLS. Por ejemplo:
/*
CREATE OR REPLACE FUNCTION public.get_tenant_memberships(p_tenant_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  role text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar que el usuario tiene membership en ese tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = auth.uid()
    AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'No tienes acceso a este tenant';
  END IF;

  RETURN QUERY
  SELECT m.id, m.user_id, m.role, m.created_at
  FROM public.memberships m
  WHERE m.tenant_id = p_tenant_id;
END;
$$;
*/







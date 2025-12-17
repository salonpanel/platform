-- ============================================================================
-- SCRIPT PARA CORREGIR POLÍTICAS RLS DE MEMBERSHIPS SIN RECURSIÓN
-- ============================================================================
-- Este script elimina las políticas problemáticas y crea políticas simples sin recursión
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================================================

-- IMPORTANTE: Este script es idempotente (puede ejecutarse múltiples veces)

-- 1. Habilitar RLS si no está habilitado
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar TODAS las políticas existentes (para recrearlas limpias)
DROP POLICY IF EXISTS "users_read_own_memberships" ON public.memberships;
DROP POLICY IF EXISTS "admins_manage_memberships" ON public.memberships;
DROP POLICY IF EXISTS "users_read_tenant_memberships" ON public.memberships;
DROP POLICY IF EXISTS "public_read_memberships" ON public.memberships;
DROP POLICY IF EXISTS "public_insert_memberships" ON public.memberships;

-- 3. Crear políticas RLS simples SIN recursión

-- Política 1: Los usuarios pueden leer sus propios memberships
-- Esta es la más simple y no causa recursión
CREATE POLICY "users_read_own_memberships" ON public.memberships
FOR SELECT
USING (auth.uid() = user_id);

-- Política 2: Los usuarios pueden leer memberships de su tenant
-- IMPORTANTE: Para evitar recursión, usamos una función helper o verificamos directamente
-- Sin embargo, esto puede causar recursión. La solución es usar una función SECURITY DEFINER
-- Por ahora, simplificamos: solo permitir leer los propios memberships
-- Si necesitas leer otros memberships del tenant, usa una función RPC

-- Política 3: Los admins/owners pueden gestionar memberships de su tenant
-- IMPORTANTE: Esta política también puede causar recursión si consulta memberships
-- La solución es usar una función SECURITY DEFINER o simplificar
-- Por ahora, solo permitimos que los usuarios gestionen sus propios memberships
-- Para gestión completa, usa una función RPC con SECURITY DEFINER

-- NOTA: Las políticas que consultan memberships dentro de memberships causan recursión infinita
-- La solución es usar funciones RPC con SECURITY DEFINER que bypass RLS

-- 4. Verificar que se crearon correctamente
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

-- 5. Comentarios
COMMENT ON POLICY "users_read_own_memberships" ON public.memberships IS 
  'Permite que los usuarios lean sus propios memberships. Esta política no causa recursión.';

-- 6. NOTA IMPORTANTE:
-- Si necesitas que los usuarios lean memberships de otros usuarios del mismo tenant,
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
AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.user_id, m.role, m.created_at
  FROM public.memberships m
  WHERE m.tenant_id = p_tenant_id;
END;
$$;
*/









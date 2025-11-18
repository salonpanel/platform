-- ============================================================================
-- SCRIPT PARA CORREGIR POLÍTICAS RLS DE MEMBERSHIPS
-- ============================================================================
-- Este script crea/actualiza las políticas RLS mínimas para memberships
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================================================

-- IMPORTANTE: Este script es idempotente (puede ejecutarse múltiples veces)

-- 1. Habilitar RLS si no está habilitado
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas existentes (para recrearlas limpias)
DROP POLICY IF EXISTS "users_read_own_memberships" ON public.memberships;
DROP POLICY IF EXISTS "admins_manage_memberships" ON public.memberships;
DROP POLICY IF EXISTS "users_read_tenant_memberships" ON public.memberships;

-- 3. Política: Los usuarios pueden leer sus propios memberships
CREATE POLICY "users_read_own_memberships" ON public.memberships
FOR SELECT
USING (auth.uid() = user_id);

-- 4. Política: Los admins/owners pueden gestionar memberships de su tenant
CREATE POLICY "admins_manage_memberships" ON public.memberships
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.memberships m2
    WHERE m2.user_id = auth.uid()
    AND m2.tenant_id = memberships.tenant_id
    AND m2.role IN ('owner', 'admin')
  )
);

-- 5. Política: Los usuarios pueden leer memberships de su tenant (para ver quién más pertenece)
CREATE POLICY "users_read_tenant_memberships" ON public.memberships
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.memberships m2
    WHERE m2.user_id = auth.uid()
    AND m2.tenant_id = memberships.tenant_id
  )
);

-- 6. Verificar que se crearon correctamente
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

-- 7. Comentarios
COMMENT ON POLICY "users_read_own_memberships" ON public.memberships IS 
  'Permite que los usuarios lean sus propios memberships';

COMMENT ON POLICY "admins_manage_memberships" ON public.memberships IS 
  'Permite que owners y admins gestionen (crear, actualizar, eliminar) memberships de su tenant';

COMMENT ON POLICY "users_read_tenant_memberships" ON public.memberships IS 
  'Permite que los usuarios lean memberships de otros usuarios del mismo tenant';

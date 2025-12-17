-- 0067_fix_memberships_rls_no_recursion.sql
-- Limpieza de las políticas RLS de public.memberships para evitar recursión

-- Eliminar todas las políticas existentes sobre public.memberships
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'memberships'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.memberships', pol.policyname);
  END LOOP;
END$$;

-- Asegurar que RLS está habilitado (idempotente)
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- Política: cada usuario solo puede leer sus propios memberships
CREATE POLICY select_own_memberships
  ON public.memberships
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Política: cada usuario solo puede insertar memberships para sí mismo
CREATE POLICY insert_own_memberships
  ON public.memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Nota: no se crean políticas de UPDATE/DELETE para mantener la superficie mínima




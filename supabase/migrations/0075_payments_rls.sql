-- 0075_payments_rls.sql
-- Habilitar RLS y políticas de seguridad para public.payments

-- 1) Habilitar RLS en payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 2) Política de lectura: usuarios autenticados que pertenecen al tenant asociado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'payments' 
      AND policyname = 'payments_select_tenant_members'
  ) THEN
    CREATE POLICY payments_select_tenant_members
      ON public.payments
      FOR SELECT
      USING (
        public.user_has_role_for_tenant(barberia_id, NULL)
      );
  END IF;
END $$;

-- 3) Política de inserción: solo service_role (webhooks/backend)
-- Los webhooks y procesos internos usan service_role que bypass RLS
-- No permitimos inserción directa desde clientes autenticados por seguridad
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'payments' 
      AND policyname = 'payments_insert_service_role'
  ) THEN
    CREATE POLICY payments_insert_service_role
      ON public.payments
      FOR INSERT
      WITH CHECK (
        -- Solo service_role puede insertar (webhooks, procesos internos)
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
      );
  END IF;
END $$;

-- 4) Política de actualización: service_role y procesos internos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'payments' 
      AND policyname = 'payments_update_service_role'
  ) THEN
    CREATE POLICY payments_update_service_role
      ON public.payments
      FOR UPDATE
      USING (
        -- Solo service_role puede actualizar (webhooks)
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
      )
      WITH CHECK (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
      );
  END IF;
END $$;

-- 5) Prohibir DELETE salvo service_role
-- No permitimos DELETE desde clientes, solo desde procesos internos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'payments' 
      AND policyname = 'payments_delete_service_role'
  ) THEN
    CREATE POLICY payments_delete_service_role
      ON public.payments
      FOR DELETE
      USING (
        -- Solo service_role puede eliminar (procesos de mantenimiento)
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
      );
  END IF;
END $$;

-- Comentarios
COMMENT ON POLICY payments_select_tenant_members ON public.payments IS 
  'Permite lectura de pagos a usuarios autenticados que pertenecen al tenant (barberia_id)';
COMMENT ON POLICY payments_insert_service_role ON public.payments IS 
  'Solo service_role puede insertar pagos (webhooks, procesos internos)';
COMMENT ON POLICY payments_update_service_role ON public.payments IS 
  'Solo service_role puede actualizar pagos (webhooks)';
COMMENT ON POLICY payments_delete_service_role ON public.payments IS 
  'Solo service_role puede eliminar pagos (procesos de mantenimiento)';




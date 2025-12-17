-- 0064_audit_logs_system.sql
-- Sistema de auditoría para cambios críticos e impersonación

-- ============================================================================
-- 1. CREAR TABLA DE AUDIT LOGS
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS platform;

CREATE TABLE IF NOT EXISTS platform.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'impersonate', etc.
  resource_type TEXT NOT NULL, -- 'service', 'staff', 'customer', 'booking', 'tenant_settings', etc.
  resource_id UUID, -- ID del recurso afectado
  old_data JSONB, -- Estado anterior (para updates/deletes)
  new_data JSONB, -- Estado nuevo (para creates/updates)
  metadata JSONB, -- Información adicional (IP, user agent, etc.)
  impersonated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Si fue una acción por impersonación
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON platform.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON platform.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON platform.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON platform.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON platform.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_impersonated_by ON platform.audit_logs(impersonated_by);

COMMENT ON TABLE platform.audit_logs IS 
  'Registro de auditoría para cambios críticos y acciones administrativas. Incluye tracking de impersonación.';

-- ============================================================================
-- 2. FUNCIÓN HELPER PARA REGISTRAR LOGS
-- ============================================================================

CREATE OR REPLACE FUNCTION platform.log_audit(
  p_tenant_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_impersonated_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO platform.audit_logs (
    tenant_id,
    user_id,
    action,
    resource_type,
    resource_id,
    old_data,
    new_data,
    metadata,
    impersonated_by
  ) VALUES (
    p_tenant_id,
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_old_data,
    p_new_data,
    p_metadata,
    p_impersonated_by
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

COMMENT ON FUNCTION platform.log_audit IS 
  'Función helper para registrar eventos de auditoría. Usar desde triggers o código de aplicación.';

-- ============================================================================
-- 3. TRIGGERS PARA CAMBIOS CRÍTICOS
-- ============================================================================

-- Trigger para services
CREATE OR REPLACE FUNCTION platform.audit_service_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
BEGIN
  -- Obtener user_id del contexto (auth.uid())
  v_user_id := auth.uid();
  v_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);
  
  IF TG_OP = 'INSERT' THEN
    PERFORM platform.log_audit(
      v_tenant_id,
      v_user_id,
      'create',
      'service',
      NEW.id,
      NULL,
      row_to_json(NEW)::jsonb,
      jsonb_build_object('trigger', 'audit_service_changes')
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM platform.log_audit(
      v_tenant_id,
      v_user_id,
      'update',
      'service',
      NEW.id,
      row_to_json(OLD)::jsonb,
      row_to_json(NEW)::jsonb,
      jsonb_build_object('trigger', 'audit_service_changes')
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM platform.log_audit(
      v_tenant_id,
      v_user_id,
      'delete',
      'service',
      OLD.id,
      row_to_json(OLD)::jsonb,
      NULL,
      jsonb_build_object('trigger', 'audit_service_changes')
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Aplicar trigger a services
DROP TRIGGER IF EXISTS trigger_audit_service_changes ON public.services;
CREATE TRIGGER trigger_audit_service_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION platform.audit_service_changes();

-- Trigger para staff
CREATE OR REPLACE FUNCTION platform.audit_staff_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
BEGIN
  v_user_id := auth.uid();
  v_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);
  
  IF TG_OP = 'INSERT' THEN
    PERFORM platform.log_audit(
      v_tenant_id,
      v_user_id,
      'create',
      'staff',
      NEW.id,
      NULL,
      row_to_json(NEW)::jsonb,
      jsonb_build_object('trigger', 'audit_staff_changes')
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM platform.log_audit(
      v_tenant_id,
      v_user_id,
      'update',
      'staff',
      NEW.id,
      row_to_json(OLD)::jsonb,
      row_to_json(NEW)::jsonb,
      jsonb_build_object('trigger', 'audit_staff_changes')
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM platform.log_audit(
      v_tenant_id,
      v_user_id,
      'delete',
      'staff',
      OLD.id,
      row_to_json(OLD)::jsonb,
      NULL,
      jsonb_build_object('trigger', 'audit_staff_changes')
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_staff_changes ON public.staff;
CREATE TRIGGER trigger_audit_staff_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION platform.audit_staff_changes();

-- Trigger para customers
CREATE OR REPLACE FUNCTION platform.audit_customer_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
BEGIN
  v_user_id := auth.uid();
  v_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);
  
  IF TG_OP = 'INSERT' THEN
    PERFORM platform.log_audit(
      v_tenant_id,
      v_user_id,
      'create',
      'customer',
      NEW.id,
      NULL,
      row_to_json(NEW)::jsonb,
      jsonb_build_object('trigger', 'audit_customer_changes')
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM platform.log_audit(
      v_tenant_id,
      v_user_id,
      'update',
      'customer',
      NEW.id,
      row_to_json(OLD)::jsonb,
      row_to_json(NEW)::jsonb,
      jsonb_build_object('trigger', 'audit_customer_changes')
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM platform.log_audit(
      v_tenant_id,
      v_user_id,
      'delete',
      'customer',
      OLD.id,
      row_to_json(OLD)::jsonb,
      NULL,
      jsonb_build_object('trigger', 'audit_customer_changes')
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_customer_changes ON public.customers;
CREATE TRIGGER trigger_audit_customer_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION platform.audit_customer_changes();

-- ============================================================================
-- 4. RLS PARA AUDIT LOGS (solo lectura para admins/owners)
-- ============================================================================

ALTER TABLE platform.audit_logs ENABLE ROW LEVEL SECURITY;

-- Solo miembros del tenant pueden leer sus logs
CREATE POLICY "audit_logs_select_tenant_members"
  ON platform.audit_logs
  FOR SELECT
  USING (
    tenant_id IS NULL -- Logs globales (impersonación, etc.)
    OR EXISTS (
      SELECT 1 FROM public.memberships
      WHERE user_id = auth.uid()
        AND tenant_id = audit_logs.tenant_id
        AND role IN ('owner', 'admin')
    )
  );

-- Solo service_role puede insertar (desde triggers)
-- Los triggers usan SECURITY DEFINER, así que pueden insertar directamente

COMMENT ON TABLE platform.audit_logs IS 
  'Sistema de auditoría completo. Registra cambios en services, staff, customers y acciones de impersonación. Solo visible para owners/admins del tenant.';






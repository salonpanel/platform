-- 0055_audit_logs_and_triggers.sql
-- Auditoría básica para cambios sensibles

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id bigserial PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,
  action text NOT NULL CHECK (action IN ('insert','update','delete')),
  table_name text NOT NULL,
  record_id uuid,
  tenant_id uuid,
  diff jsonb
);

COMMENT ON TABLE public.audit_logs IS 'Registro de auditoría para cambios sensibles en tablas clave.';

-- Helper: construir diff JSON entre OLD y NEW
CREATE OR REPLACE FUNCTION public.build_row_diff(old_row jsonb, new_row jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'old', old_row,
    'new', new_row
  );
$$;

-- Generic trigger function para auditoría
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_action text;
  v_table text := TG_TABLE_NAME;
  v_actor uuid := auth.uid();
  v_record uuid;
  v_tenant uuid;
  v_diff jsonb := NULL;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'insert';
    v_record := NEW.id;
    -- Detectar tenant_id si existe
    BEGIN v_tenant := NEW.tenant_id; EXCEPTION WHEN others THEN v_tenant := NULL; END;
    v_diff := public.build_row_diff(NULL, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_record := NEW.id;
    BEGIN v_tenant := NEW.tenant_id; EXCEPTION WHEN others THEN v_tenant := NULL; END;
    v_diff := public.build_row_diff(to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_record := OLD.id;
    BEGIN v_tenant := OLD.tenant_id; EXCEPTION WHEN others THEN v_tenant := NULL; END;
    v_diff := public.build_row_diff(to_jsonb(OLD), NULL);
  END IF;

  INSERT INTO public.audit_logs(actor_user_id, action, table_name, record_id, tenant_id, diff)
  VALUES (v_actor, v_action, v_table, v_record, v_tenant, v_diff);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Activar auditoría en tablas clave
DROP TRIGGER IF EXISTS trg_audit_bookings ON public.bookings;
CREATE TRIGGER trg_audit_bookings
AFTER INSERT OR UPDATE OR DELETE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_services ON public.services;
CREATE TRIGGER trg_audit_services
AFTER INSERT OR UPDATE OR DELETE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_tenant_settings ON public.tenant_settings;
CREATE TRIGGER trg_audit_tenant_settings
AFTER INSERT OR UPDATE OR DELETE ON public.tenant_settings
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();










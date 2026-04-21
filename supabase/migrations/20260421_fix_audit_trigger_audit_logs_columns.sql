-- Fix audit_trigger() to match current public.audit_logs schema.
-- Previous version referenced removed columns (actor_user_id, action, table_name, record_id, diff).

CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
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

  INSERT INTO public.audit_logs(
    tenant_id,
    actor_id,
    event_type,
    resource_entity,
    resource_id,
    metadata
  )
  VALUES (
    v_tenant,
    v_actor,
    v_action,
    v_table,
    v_record::text,
    jsonb_build_object('diff', v_diff)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;


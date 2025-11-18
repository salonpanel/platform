-- 0014_admin_helper_functions.sql
-- Funciones helper para el panel de administración

-- Función para obtener plan de una org (accesible desde cliente con service_role)
create or replace function public.get_org_plan_info(p_org_id uuid)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  v_result jsonb;
  v_plan_id uuid;
  v_billing_state text;
  v_plan_key text;
  v_plan_name text;
begin
  -- Obtener plan de la org
  select plan_id, billing_state
  into v_plan_id, v_billing_state
  from platform.org_plans
  where org_id = p_org_id;

  if v_plan_id is not null then
    -- Obtener info del plan
    select key, name
    into v_plan_key, v_plan_name
    from platform.plans
    where id = v_plan_id;

    v_result := jsonb_build_object(
      'key', v_plan_key,
      'name', v_plan_name,
      'billing_state', v_billing_state
    );
  else
    v_result := null;
  end if;

  return v_result;
end;
$$;








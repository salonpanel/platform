-- memberships.role es un tipo ENUM; RETURNS TABLE pide text → hace falta ::text
-- para evitar: structure of query does not match function result type

CREATE OR REPLACE FUNCTION public.list_tenant_members(p_tenant_id uuid)
RETURNS TABLE(
  user_id uuid,
  tenant_role text,
  display_name text,
  avatar_url text,
  staff_id uuid,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT app.user_has_access_to_tenant(p_tenant_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT
    m.user_id,
    m.role::text,
    COALESCE(s.display_name, s.name, CONCAT('Usuario ', LEFT(m.user_id::text, 8))) AS display_name,
    s.profile_photo_url,
    s.id,
    COALESCE(s.active, true) AS is_active
  FROM public.memberships m
  LEFT JOIN public.staff s
    ON s.tenant_id = m.tenant_id
   AND s.user_id = m.user_id
  WHERE m.tenant_id = p_tenant_id
  ORDER BY display_name;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.list_tenant_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_tenant_members(uuid) TO service_role;

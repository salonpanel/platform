-- Grupo de equipo: creación con miembros elegidos, validada en el servidor (SECURITY DEFINER).

CREATE OR REPLACE FUNCTION public.create_group_team_conversation(
  p_tenant_id uuid,
  p_name text,
  p_member_user_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app', 'auth'
AS $function$
DECLARE
  v_cid uuid;
  v_name text;
  v_unique uuid[];
  v_merged uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para crear un grupo.';
  END IF;

  IF NOT app.user_has_access_to_tenant(p_tenant_id) THEN
    RAISE EXCEPTION 'No tienes permiso en este negocio.';
  END IF;

  v_merged := COALESCE(p_member_user_ids, ARRAY[]::uuid[]) || auth.uid();
  v_unique := ARRAY(SELECT DISTINCT unnest(v_merged));
  v_name := trim(p_name);

  IF v_name = '' OR v_name IS NULL THEN
    RAISE EXCEPTION 'Indica un nombre para el grupo.';
  END IF;

  IF length(v_name) > 120 THEN
    RAISE EXCEPTION 'El nombre no puede superar 120 caracteres.';
  END IF;

  -- Al menos 2 participantes: tú y otra persona
  IF cardinality(v_unique) < 2 THEN
    RAISE EXCEPTION 'Añade al menos una persona al grupo (además de ti).';
  END IF;

  IF (
    SELECT COUNT(*)::integer
    FROM public.memberships m
    WHERE m.tenant_id = p_tenant_id
      AND m.user_id = ANY (v_unique)
  ) IS DISTINCT FROM cardinality(v_unique) THEN
    RAISE EXCEPTION 'Uno o más participantes no forman parte de tu equipo en BookFast.';
  END IF;

  INSERT INTO public.team_conversations (
    tenant_id,
    type,
    name,
    is_default,
    created_by
  )
  VALUES (p_tenant_id, 'group', v_name, false, auth.uid())
  RETURNING id INTO v_cid;

  INSERT INTO public.team_conversation_members (conversation_id, user_id, role)
  SELECT
    v_cid,
    u,
    CASE WHEN u = auth.uid() THEN 'admin' ELSE 'member' END
  FROM unnest(v_unique) AS u
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN v_cid;
END;
$function$;

COMMENT ON FUNCTION public.create_group_team_conversation(uuid, text, uuid[]) IS
  'Crea un chat grupal (type=group) con el creador como admin y la lista de user_ids (mismo tenant vía memberships).';

REVOKE ALL ON FUNCTION public.create_group_team_conversation(uuid, text, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_group_team_conversation(uuid, text, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_group_team_conversation(uuid, text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group_team_conversation(uuid, text, uuid[]) TO service_role;

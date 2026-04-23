-- Chat: archivado por usuario (membresía), eliminar DM/grupo, preview con nombre del remitente en listado

DROP FUNCTION IF EXISTS public.get_user_conversations_optimized(uuid, uuid);

ALTER TABLE public.team_conversation_members
  ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone NULL;

COMMENT ON COLUMN public.team_conversation_members.archived_at IS 'Si no es null, el usuario archivó esta conversación (solo oculta en su listado).';

CREATE OR REPLACE FUNCTION public.get_user_conversations_optimized(p_user_id uuid, p_tenant_id uuid)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  type text,
  name text,
  last_message_body text,
  last_message_at timestamp with time zone,
  unread_count integer,
  members_count integer,
  last_read_at timestamp with time zone,
  created_by uuid,
  viewer_role text,
  target_user_id uuid,
  last_message_sender_id uuid,
  last_message_sender_name text
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

  PERFORM public.ensure_tenant_group_chat(p_tenant_id);
  PERFORM public.ensure_direct_chats_for_user(p_tenant_id, COALESCE(p_user_id, auth.uid()));

  RETURN QUERY
  WITH user_memberships AS (
    SELECT
      tcm.conversation_id,
      tcm.role AS viewer_role,
      tcm.last_read_at
    FROM public.team_conversation_members tcm
    JOIN public.team_conversations tc ON tc.id = tcm.conversation_id
    WHERE tc.tenant_id = p_tenant_id
      AND tcm.user_id = COALESCE(p_user_id, auth.uid())
      AND tcm.archived_at IS NULL
  ),
  conv_stats AS (
    SELECT
      tm.conversation_id,
      MAX(tm.created_at) AS last_message_at,
      (ARRAY_AGG(tm.body ORDER BY tm.created_at DESC))[1] AS last_message_body,
      (ARRAY_AGG(tm.sender_id ORDER BY tm.created_at DESC))[1] AS last_message_sender_id
    FROM public.team_messages tm
    WHERE tm.tenant_id = p_tenant_id
      AND tm.deleted_at IS NULL
    GROUP BY tm.conversation_id
  ),
  unread_counts AS (
    SELECT
      tm.conversation_id,
      COUNT(*)::integer AS unread_count
    FROM public.team_messages tm
    JOIN user_memberships um ON um.conversation_id = tm.conversation_id
    WHERE tm.tenant_id = p_tenant_id
      AND tm.deleted_at IS NULL
      AND tm.sender_id IS DISTINCT FROM COALESCE(p_user_id, auth.uid())
      AND (um.last_read_at IS NULL OR tm.created_at > um.last_read_at)
    GROUP BY tm.conversation_id
  ),
  member_counts AS (
    SELECT
      conversation_id,
      COUNT(*)::integer AS members_count
    FROM public.team_conversation_members
    GROUP BY conversation_id
  )
  SELECT
    tc.id,
    tc.tenant_id,
    tc.type,
    tc.name,
    cs.last_message_body,
    cs.last_message_at,
    COALESCE(uc.unread_count, 0) AS unread_count,
    COALESCE(mc.members_count, 0) AS members_count,
    um.last_read_at,
    tc.created_by,
    um.viewer_role,
    (
      SELECT tcm.user_id
      FROM public.team_conversation_members tcm
      WHERE tcm.conversation_id = tc.id
        AND tc.type = 'direct'
        AND tcm.user_id != COALESCE(p_user_id, auth.uid())
      LIMIT 1
    ) AS target_user_id,
    cs.last_message_sender_id,
    CASE
      WHEN tc.type IN ('group', 'all')
        AND cs.last_message_sender_id IS NOT NULL
      THEN NULLIF(
        trim(
          public.get_user_display_name(
            COALESCE(p_user_id, auth.uid()),
            cs.last_message_sender_id,
            p_tenant_id
          )
        ),
        ''
      )
      ELSE NULL
    END AS last_message_sender_name
  FROM public.team_conversations tc
  JOIN user_memberships um ON um.conversation_id = tc.id
  LEFT JOIN conv_stats cs ON cs.conversation_id = tc.id
  LEFT JOIN unread_counts uc ON uc.conversation_id = tc.id
  LEFT JOIN member_counts mc ON mc.conversation_id = tc.id
  WHERE tc.tenant_id = p_tenant_id
    AND COALESCE(tc.is_archived, false) = false
  ORDER BY COALESCE(cs.last_message_at, tc.created_at) DESC, tc.name;
END;
$function$;

-- Archivar: solo oculta para el usuario actual (direct / group, nunca canal equipo global)
CREATE OR REPLACE FUNCTION public.user_archive_team_conversation(p_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app'
AS $function$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.team_conversation_members tcm
  SET archived_at = now()
  FROM public.team_conversations tc
  WHERE tcm.conversation_id = tc.id
    AND tcm.conversation_id = p_conversation_id
    AND tcm.user_id = auth.uid()
    AND tc.type IN ('direct', 'group')
    AND COALESCE(tc.is_archived, false) = false
    AND tcm.archived_at IS NULL
    AND app.user_has_access_to_tenant(tc.tenant_id);

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$function$;

-- Eliminar conversación (DM: cualquier miembro; grupo: creador o admin/owner del tenant)
CREATE OR REPLACE FUNCTION public.user_delete_team_conversation(p_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app'
AS $function$
DECLARE
  tc public.team_conversations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO tc
  FROM public.team_conversations c
  WHERE c.id = p_conversation_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF tc.type = 'all' THEN
    RAISE EXCEPTION 'cannot_delete_team_channel';
  END IF;

  IF tc.type NOT IN ('direct', 'group') THEN
    RETURN false;
  END IF;

  IF NOT app.user_has_access_to_tenant(tc.tenant_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.team_conversation_members m
    WHERE m.conversation_id = tc.id
      AND m.user_id = auth.uid()
  ) THEN
    RETURN false;
  END IF;

  IF tc.type = 'group' THEN
    IF tc.created_by IS DISTINCT FROM auth.uid()
       AND NOT public.user_has_role_for_tenant(
         tc.tenant_id,
         ARRAY['owner'::text, 'admin'::text]
       )
    THEN
      RETURN false;
    END IF;
  END IF;

  DELETE FROM public.team_conversations WHERE id = tc.id;
  RETURN true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_user_conversations_optimized(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_conversations_optimized(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_archive_team_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_delete_team_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_archive_team_conversation(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_delete_team_conversation(uuid) TO service_role;

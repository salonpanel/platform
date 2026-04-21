-- Chat: seguridad en RPCs SECURITY DEFINER, conteo de no leídos y revocación a anon
-- Orden: permisos de mensajes → listado de conversaciones → sincronización → stats → find_direct
--
-- Si en la BD remota la firma/tipo de retorno de `get_conversation_messages_paginated` o
-- `get_conversation_stats` difiere, hay que DROP antes de recrear (p. ej. MCP o migración inicial).

DROP FUNCTION IF EXISTS public.get_conversation_messages_paginated(uuid, integer, timestamp with time zone, timestamp with time zone);
DROP FUNCTION IF EXISTS public.get_conversation_stats(uuid);
DROP FUNCTION IF EXISTS public.get_user_conversations_optimized(uuid, uuid);

-- ---------------------------------------------------------------------------
-- 1) Mensajes paginados: comprobar membresía, search_path, revocar anon
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_conversation_messages_paginated(
  p_conversation_id uuid,
  p_limit integer DEFAULT 50,
  p_before_timestamp timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_after_timestamp timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  body text,
  created_at timestamp with time zone,
  edited_at timestamp with time zone,
  deleted_at timestamp with time zone,
  author_name text,
  author_avatar text,
  has_more_before boolean,
  has_more_after boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'app'
AS $function$
DECLARE
  v_has_more_before BOOLEAN;
  v_has_more_after BOOLEAN;
  v_oldest_timestamp TIMESTAMPTZ;
  v_newest_timestamp TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.team_conversation_members tcm
    WHERE tcm.conversation_id = p_conversation_id
      AND tcm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_before_timestamp IS NOT NULL THEN
    SELECT MIN(tm.created_at), MAX(tm.created_at)
    INTO v_oldest_timestamp, v_newest_timestamp
    FROM (
      SELECT created_at
      FROM public.team_messages
      WHERE conversation_id = p_conversation_id
        AND created_at < p_before_timestamp
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT p_limit
    ) tm;
  ELSIF p_after_timestamp IS NOT NULL THEN
    SELECT MIN(tm.created_at), MAX(tm.created_at)
    INTO v_oldest_timestamp, v_newest_timestamp
    FROM (
      SELECT created_at
      FROM public.team_messages
      WHERE conversation_id = p_conversation_id
        AND created_at > p_after_timestamp
        AND deleted_at IS NULL
      ORDER BY created_at ASC
      LIMIT p_limit
    ) tm;
  ELSE
    SELECT MIN(tm.created_at), MAX(tm.created_at)
    INTO v_oldest_timestamp, v_newest_timestamp
    FROM (
      SELECT created_at
      FROM public.team_messages
      WHERE conversation_id = p_conversation_id
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT p_limit
    ) tm;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.team_messages
    WHERE conversation_id = p_conversation_id
      AND created_at < COALESCE(v_oldest_timestamp, NOW())
      AND deleted_at IS NULL
  ) INTO v_has_more_before;

  SELECT EXISTS(
    SELECT 1 FROM public.team_messages
    WHERE conversation_id = p_conversation_id
      AND created_at > COALESCE(v_newest_timestamp, '1970-01-01'::TIMESTAMPTZ)
      AND deleted_at IS NULL
  ) INTO v_has_more_after;

  RETURN QUERY
  SELECT
    tm.id,
    tm.conversation_id,
    tm.sender_id,
    tm.body,
    tm.created_at,
    tm.edited_at,
    tm.deleted_at,
    COALESCE(
      NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
      NULLIF(trim(u.raw_user_meta_data->>'name'), ''),
      NULLIF(split_part(u.email, '@', 1), ''),
      'Usuario desconocido'
    ) AS author_name,
    u.raw_user_meta_data->>'avatar_url' AS author_avatar,
    v_has_more_before,
    v_has_more_after
  FROM public.team_messages tm
  LEFT JOIN auth.users u ON tm.sender_id = u.id
  WHERE tm.conversation_id = p_conversation_id
    AND tm.created_at >= COALESCE(v_oldest_timestamp, '1970-01-01'::TIMESTAMPTZ)
    AND tm.created_at <= COALESCE(v_newest_timestamp, NOW())
    AND tm.deleted_at IS NULL
  ORDER BY tm.created_at ASC;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_conversation_messages_paginated(
  uuid, integer, timestamp with time zone, timestamp with time zone
) FROM anon;

GRANT EXECUTE ON FUNCTION public.get_conversation_messages_paginated(
  uuid, integer, timestamp with time zone, timestamp with time zone
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation_messages_paginated(
  uuid, integer, timestamp with time zone, timestamp with time zone
) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Stats de conversación: membresía + revocar anon
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_conversation_stats(p_conversation_id uuid)
RETURNS TABLE(
  total_messages bigint,
  total_participants integer,
  messages_today integer,
  messages_this_week integer,
  most_active_user_id uuid,
  most_active_user_name text,
  avg_response_time_minutes integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'app'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.team_conversation_members tcm
    WHERE tcm.conversation_id = p_conversation_id
      AND tcm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  WITH message_stats AS (
    SELECT
      COUNT(*) AS total_msgs,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW())) AS msgs_today,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('week', NOW())) AS msgs_week,
      COUNT(DISTINCT sender_id) AS participants
    FROM public.team_messages
    WHERE conversation_id = p_conversation_id
      AND deleted_at IS NULL
  ),
  user_activity AS (
    SELECT
      tm.sender_id AS user_id,
      COUNT(*) AS msg_count,
      u.raw_user_meta_data->>'full_name' AS full_name
    FROM public.team_messages tm
    LEFT JOIN auth.users u ON tm.sender_id = u.id
    WHERE tm.conversation_id = p_conversation_id
      AND tm.deleted_at IS NULL
    GROUP BY tm.sender_id, u.raw_user_meta_data->>'full_name'
    ORDER BY msg_count DESC
    LIMIT 1
  )
  SELECT
    ms.total_msgs,
    ms.participants::integer,
    ms.msgs_today::INT,
    ms.msgs_week::INT,
    ua.user_id,
    ua.full_name,
    0::INT
  FROM message_stats ms
  CROSS JOIN user_activity ua;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_conversation_stats(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.get_conversation_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation_stats(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 3) Sincronización de chats: solo si hay sesión y acceso al tenant (o sesión de servicio sin uid)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_tenant_default_chats(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app'
AS $function$
DECLARE
  v_group_id uuid;
  v_tenant_name text;
  v_pair_record RECORD;
  v_direct_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT app.user_has_access_to_tenant(p_tenant_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT name INTO v_tenant_name FROM public.tenants WHERE id = p_tenant_id;

  SELECT id INTO v_group_id
  FROM public.team_conversations
  WHERE tenant_id = p_tenant_id AND type = 'all' AND is_default = true;

  IF v_group_id IS NULL THEN
    INSERT INTO public.team_conversations (tenant_id, type, name, is_default, created_by)
    VALUES (p_tenant_id, 'all', COALESCE(v_tenant_name, 'General'), true, '00000000-0000-0000-0000-000000000000'::uuid)
    RETURNING id INTO v_group_id;
  ELSE
    UPDATE public.team_conversations SET name = v_tenant_name WHERE id = v_group_id;
  END IF;

  INSERT INTO public.team_conversation_members (conversation_id, user_id, role)
  SELECT DISTINCT v_group_id, u_id, 'member'
  FROM (
    SELECT user_id AS u_id FROM public.memberships WHERE tenant_id = p_tenant_id
    UNION
    SELECT user_id AS u_id FROM public.staff WHERE tenant_id = p_tenant_id AND user_id IS NOT NULL
    UNION
    SELECT auth.uid() AS u_id WHERE auth.uid() IS NOT NULL
  ) users
  WHERE u_id IS NOT NULL
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  FOR v_pair_record IN
    WITH all_team_users AS (
      SELECT DISTINCT user_id AS u_id
      FROM (
        SELECT user_id FROM public.memberships WHERE tenant_id = p_tenant_id
        UNION
        SELECT user_id FROM public.staff WHERE tenant_id = p_tenant_id AND user_id IS NOT NULL
        UNION
        SELECT auth.uid() WHERE auth.uid() IS NOT NULL
      ) t
      WHERE user_id IS NOT NULL
    )
    SELECT a.u_id AS user_a, b.u_id AS user_b
    FROM all_team_users a
    CROSS JOIN all_team_users b
    WHERE a.u_id < b.u_id
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.team_conversation_members ma
      JOIN public.team_conversation_members mb ON ma.conversation_id = mb.conversation_id
      JOIN public.team_conversations tc ON tc.id = ma.conversation_id
      WHERE tc.type = 'direct'
        AND tc.tenant_id = p_tenant_id
        AND ma.user_id = v_pair_record.user_a
        AND mb.user_id = v_pair_record.user_b
    ) THEN
      INSERT INTO public.team_conversations (tenant_id, type, name, created_by)
      VALUES (p_tenant_id, 'direct', 'Chat Directo', '00000000-0000-0000-0000-000000000000'::uuid)
      RETURNING id INTO v_direct_id;

      INSERT INTO public.team_conversation_members (conversation_id, user_id)
      VALUES (v_direct_id, v_pair_record.user_a), (v_direct_id, v_pair_record.user_b);
    END IF;
  END LOOP;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4) Listado de conversaciones: comprobar acceso al tenant + no leídos sin mensajes propios
-- ---------------------------------------------------------------------------
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
  last_message_sender_id uuid
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

  PERFORM public.sync_tenant_default_chats(p_tenant_id);

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
    cs.last_message_sender_id
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

GRANT EXECUTE ON FUNCTION public.get_user_conversations_optimized(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_conversations_optimized(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 5) Buscar DM existente: alinear comprobación de acceso con app.*
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.find_direct_team_conversation(
  p_tenant_id uuid,
  p_user_a uuid,
  p_user_b uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app'
AS $function$
DECLARE
  v_conversation_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT app.user_has_access_to_tenant(p_tenant_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF auth.uid() IS DISTINCT FROM p_user_a AND auth.uid() IS DISTINCT FROM p_user_b THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT tc.id
  INTO v_conversation_id
  FROM public.team_conversations tc
  WHERE tc.tenant_id = p_tenant_id
    AND tc.type = 'direct'
    AND EXISTS (
      SELECT 1
      FROM public.team_conversation_members m1
      WHERE m1.conversation_id = tc.id
        AND m1.user_id = p_user_a
    )
    AND EXISTS (
      SELECT 1
      FROM public.team_conversation_members m2
      WHERE m2.conversation_id = tc.id
        AND m2.user_id = p_user_b
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.team_conversation_members mx
      WHERE mx.conversation_id = tc.id
        AND mx.user_id NOT IN (p_user_a, p_user_b)
    )
  LIMIT 1;

  RETURN v_conversation_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.find_direct_team_conversation(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_direct_team_conversation(uuid, uuid, uuid) TO service_role;

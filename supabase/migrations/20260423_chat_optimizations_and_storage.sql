-- Prioridad media/baja: sync O(n) por usuario, stats sin filas vacías, bucket chat-attachments

-- ---------------------------------------------------------------------------
-- 1) Grupo general del tenant (extraído)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_tenant_group_chat(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app'
AS $function$
DECLARE
  v_group_id uuid;
  v_tenant_name text;
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
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2) DMs solo para un usuario frente al resto del equipo: O(n) por llamada
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_direct_chats_for_user(p_tenant_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app'
AS $function$
DECLARE
  v_other uuid;
  v_direct_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NOT app.user_has_access_to_tenant(p_tenant_id) THEN
      RAISE EXCEPTION 'not_authorized';
    END IF;
    IF auth.uid() IS DISTINCT FROM p_user_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.memberships
        WHERE tenant_id = p_tenant_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin')
      ) THEN
        RAISE EXCEPTION 'not_authorized';
      END IF;
    END IF;
  END IF;

  FOR v_other IN
    SELECT DISTINCT u.u_id
    FROM (
      SELECT user_id AS u_id FROM public.memberships WHERE tenant_id = p_tenant_id
      UNION
      SELECT user_id AS u_id FROM public.staff WHERE tenant_id = p_tenant_id AND user_id IS NOT NULL
    ) u
    WHERE u.u_id IS NOT NULL
      AND u.u_id IS DISTINCT FROM p_user_id
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.team_conversation_members ma
      JOIN public.team_conversation_members mb ON ma.conversation_id = mb.conversation_id
      JOIN public.team_conversations tc ON tc.id = ma.conversation_id
      WHERE tc.tenant_id = p_tenant_id
        AND tc.type = 'direct'
        AND ma.user_id = p_user_id
        AND mb.user_id = v_other
    ) THEN
      INSERT INTO public.team_conversations (tenant_id, type, name, created_by)
      VALUES (p_tenant_id, 'direct', 'Chat Directo', '00000000-0000-0000-0000-000000000000'::uuid)
      RETURNING id INTO v_direct_id;

      INSERT INTO public.team_conversation_members (conversation_id, user_id)
      VALUES (v_direct_id, p_user_id), (v_direct_id, v_other);
    END IF;
  END LOOP;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3) sync_tenant_default_chats: compatibilidad; ya no recorre todos los pares O(n²)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_tenant_default_chats(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app'
AS $function$
BEGIN
  PERFORM public.ensure_tenant_group_chat(p_tenant_id);
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.ensure_direct_chats_for_user(p_tenant_id, auth.uid());
  END IF;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4) Listado: solo grupo + DMs del usuario actual (barato en cada carga)
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

-- ---------------------------------------------------------------------------
-- 5) Trigger membresía: grupo + DMs solo para el usuario nuevo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.on_membership_created_sync_chats()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'app'
AS $function$
BEGIN
  PERFORM public.ensure_tenant_group_chat(NEW.tenant_id);
  PERFORM public.ensure_direct_chats_for_user(NEW.tenant_id, NEW.user_id);
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6) Stats: siempre una fila (conversación sin mensajes o sin “usuario más activo”)
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
      COUNT(*)::bigint AS total_msgs,
      COUNT(DISTINCT sender_id)::integer AS participants,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW()))::bigint AS msgs_today,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('week', NOW()))::bigint AS msgs_week
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
    ORDER BY COUNT(*) DESC
    LIMIT 1
  )
  SELECT
    ms.total_msgs,
    ms.participants,
    ms.msgs_today::integer,
    ms.msgs_week::integer,
    ua.user_id,
    ua.full_name,
    0::integer
  FROM message_stats ms
  LEFT JOIN user_activity ua ON true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7) Storage: bucket de adjuntos de chat (límite ~10 MB, tipos habituales)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  true,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "chat_attachments_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "chat_attachments_authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "chat_attachments_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "chat_attachments_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "chat_attachments_public_select" ON storage.objects;

CREATE POLICY "chat_attachments_authenticated_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');

CREATE POLICY "chat_attachments_authenticated_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments');

CREATE POLICY "chat_attachments_authenticated_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'chat-attachments')
  WITH CHECK (bucket_id = 'chat-attachments');

CREATE POLICY "chat_attachments_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-attachments');

CREATE POLICY "chat_attachments_public_select"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'chat-attachments');

-- auth.users no tiene columna full_name (Supabase); la RPC fallaba en runtime y el
-- cliente mostraba lista vacía. Nombre desde raw_user_meta_data + email.

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

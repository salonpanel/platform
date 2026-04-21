-- team_conversations.created_by -> auth.users(id). La migración 20260423 usaba
-- 00000000-0000-0000-0000-000000000000, que no existe en auth.users y rompe la FK.

UPDATE public.team_conversations tc
SET created_by = COALESCE(
  (SELECT m.user_id FROM public.memberships m WHERE m.tenant_id = tc.tenant_id ORDER BY m.created_at ASC LIMIT 1),
  (SELECT s.user_id FROM public.staff s WHERE s.tenant_id = tc.tenant_id AND s.user_id IS NOT NULL LIMIT 1)
)
WHERE tc.created_by = '00000000-0000-0000-0000-000000000000'::uuid
  AND COALESCE(
    (SELECT m.user_id FROM public.memberships m WHERE m.tenant_id = tc.tenant_id ORDER BY m.created_at ASC LIMIT 1),
    (SELECT s.user_id FROM public.staff s WHERE s.tenant_id = tc.tenant_id AND s.user_id IS NOT NULL LIMIT 1)
  ) IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_tenant_group_chat(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app'
AS $function$
DECLARE
  v_group_id uuid;
  v_tenant_name text;
  v_creator uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT app.user_has_access_to_tenant(p_tenant_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT name INTO v_tenant_name FROM public.tenants WHERE id = p_tenant_id;

  SELECT id INTO v_group_id
  FROM public.team_conversations
  WHERE tenant_id = p_tenant_id AND type = 'all' AND is_default = true;

  IF v_group_id IS NULL THEN
    v_creator := auth.uid();
    IF v_creator IS NULL THEN
      SELECT m.user_id INTO v_creator
      FROM public.memberships m
      WHERE m.tenant_id = p_tenant_id
      ORDER BY m.created_at ASC
      LIMIT 1;
    END IF;
    IF v_creator IS NULL THEN
      SELECT s.user_id INTO v_creator
      FROM public.staff s
      WHERE s.tenant_id = p_tenant_id AND s.user_id IS NOT NULL
      LIMIT 1;
    END IF;
    IF v_creator IS NULL THEN
      RAISE EXCEPTION 'cannot_create_group_chat_no_member';
    END IF;

    INSERT INTO public.team_conversations (tenant_id, type, name, is_default, created_by)
    VALUES (p_tenant_id, 'all', COALESCE(v_tenant_name, 'General'), true, v_creator)
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
      VALUES (p_tenant_id, 'direct', 'Chat Directo', p_user_id)
      RETURNING id INTO v_direct_id;

      INSERT INTO public.team_conversation_members (conversation_id, user_id)
      VALUES (v_direct_id, p_user_id), (v_direct_id, v_other);
    END IF;
  END LOOP;
END;
$function$;

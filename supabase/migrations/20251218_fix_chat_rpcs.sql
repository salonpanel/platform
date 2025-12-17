-- Migration: Fix Chat RPCs (Missing helper function)
-- Date: 2025-12-18
-- Author: Antigravity

-- 1. Fix list_tenant_members to use 'app.user_has_access_to_tenant' instead of missing 'public.user_has_role_for_tenant'
CREATE OR REPLACE FUNCTION public.list_tenant_members(p_tenant_id uuid)
 RETURNS TABLE(user_id uuid, tenant_role text, display_name text, avatar_url text, staff_id uuid, is_active boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- FIX: Use correct schema and function name
  IF NOT app.user_has_access_to_tenant(p_tenant_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT
    m.user_id,
    m.role,
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

-- 2. Fix get_user_conversations_optimized to use correct permission check
CREATE OR REPLACE FUNCTION public.get_user_conversations_optimized(p_user_id uuid, p_tenant_id uuid)
 RETURNS TABLE(id uuid, tenant_id uuid, type text, name text, last_message_body text, last_message_at timestamp with time zone, unread_count integer, members_count integer, last_read_at timestamp with time zone, created_by uuid, viewer_role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- FIX: Use correct schema function
  if not app.user_has_access_to_tenant(p_tenant_id) then
    raise exception 'not_authorized';
  end if;

  -- Ensure all 1:1 conversations exist for this user in this tenant
  perform public.ensure_direct_conversations_for_user(coalesce(p_user_id, auth.uid()), p_tenant_id);

  return query
  with user_memberships as (
    select
      tcm.conversation_id,
      tcm.role as viewer_role,
      tcm.last_read_at
    from public.team_conversation_members tcm
    join public.team_conversations tc
      on tc.id = tcm.conversation_id
    where tc.tenant_id = p_tenant_id
      and tcm.user_id = coalesce(p_user_id, auth.uid())
  ),
  conv_stats as (
    select
      tm.conversation_id,
      max(tm.created_at) as last_message_at,
      (array_agg(tm.body order by tm.created_at desc))[1] as last_message_body
    from public.team_messages tm
    where tm.tenant_id = p_tenant_id
      and tm.deleted_at is null
    group by tm.conversation_id
  ),
  unread_counts as (
    select
      tm.conversation_id,
      count(*)::integer as unread_count
    from public.team_messages tm
    join user_memberships um
      on um.conversation_id = tm.conversation_id
    where tm.tenant_id = p_tenant_id
      and tm.deleted_at is null
      and (um.last_read_at is null or tm.created_at > um.last_read_at)
    group by tm.conversation_id
  ),
  member_counts as (
    select
      conversation_id,
      count(*)::integer as members_count
    from public.team_conversation_members
    group by conversation_id
  )
  select
    tc.id,
    tc.tenant_id,
    tc.type,
    tc.name,
    cs.last_message_body,
    cs.last_message_at,
    coalesce(uc.unread_count, 0) as unread_count,
    coalesce(mc.members_count, 0) as members_count,
    um.last_read_at,
    tc.created_by,
    um.viewer_role
  from public.team_conversations tc
  join user_memberships um
    on um.conversation_id = tc.id
  left join conv_stats cs on cs.conversation_id = tc.id
  left join unread_counts uc on uc.conversation_id = tc.id
  left join member_counts mc on mc.conversation_id = tc.id
  where tc.tenant_id = p_tenant_id
    and coalesce(tc.is_archived, false) = false
  order by coalesce(cs.last_message_at, tc.created_at) desc, tc.name;
end;
$function$;

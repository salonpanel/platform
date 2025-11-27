-- 0113_get_user_conversations_optimized.sql
-- Creates an optimized helper function for team chat conversations
-- Used by Sidebar prefetch, useOptimizedData hooks and TeamChat components

begin;

create or replace function public.get_user_conversations_optimized(
  p_user_id uuid,
  p_tenant_id uuid
)
returns table (
  id uuid,
  tenant_id uuid,
  type text,
  name text,
  last_message_body text,
  last_message_at timestamptz,
  unread_count integer,
  members_count integer,
  last_read_at timestamptz,
  created_by uuid,
  viewer_role text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.user_has_role_for_tenant(p_tenant_id, null) then
    raise exception 'not_authorized';
  end if;

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
$$;

grant execute on function public.get_user_conversations_optimized(uuid, uuid) to authenticated;

commit;

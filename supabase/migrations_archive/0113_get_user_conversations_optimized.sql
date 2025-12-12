-- 0113_get_user_conversations_optimized.sql
-- Creates an optimized helper function for team chat conversations
-- Used by Sidebar prefetch, useOptimizedData hooks and TeamChat components

-- Cleanup old definitions to avoid signature conflicts
drop function if exists public.ensure_direct_conversations_for_user(uuid, uuid);

-- =========================================================================
-- Helper: ensure_direct_conversations_for_user
-- Creates missing 1:1 conversations between the target user and every other
-- member of the tenant, avoiding duplicates. Keeps conversation names human.
-- =========================================================================

create or replace function public.ensure_direct_conversations_for_user(
  p_user_id uuid,
  p_tenant_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_other record;
  v_conv_id uuid;
  v_other_name text;
begin
  -- Safeguard
  if p_user_id is null or p_tenant_id is null then
    return;
  end if;

  for v_other in
    select m.user_id
    from public.memberships m
    where m.tenant_id = p_tenant_id
      and m.user_id <> p_user_id
  loop
    -- Skip if a direct conversation with exactly these two users already exists
    if not exists (
      select 1
      from public.team_conversations tc
      join public.team_conversation_members a on a.conversation_id = tc.id and a.user_id = p_user_id
      join public.team_conversation_members b on b.conversation_id = tc.id and b.user_id = v_other.user_id
      where tc.tenant_id = p_tenant_id
        and tc.type = 'direct'
        and coalesce(tc.is_archived, false) = false
      group by tc.id
      having count(distinct a.user_id) = 1 and count(distinct b.user_id) = 1
    ) then
      -- Compute a friendly name with the other member's display_name or email
      select coalesce(p.display_name, u.email, 'Chat directo')
      into v_other_name
      from public.profiles p
      left join auth.users u on u.id = v_other.user_id
      where p.user_id = v_other.user_id;

      insert into public.team_conversations (tenant_id, type, name, created_by)
      values (p_tenant_id, 'direct', v_other_name, p_user_id)
      returning id into v_conv_id;

      insert into public.team_conversation_members (conversation_id, user_id, role)
      values
        (v_conv_id, p_user_id, 'member'),
        (v_conv_id, v_other.user_id, 'member')
      on conflict do nothing;
    end if;
  end loop;
end;
$$;

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
$$;

grant execute on function public.get_user_conversations_optimized(uuid, uuid) to authenticated;

commit;

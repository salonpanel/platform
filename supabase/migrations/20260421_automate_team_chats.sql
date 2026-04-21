-- ==========================================
-- AUTOMATIZACIÓN DE CHATS DE EQUIPO (FINAL)
-- ==========================================

-- 1. DROP de funciones antiguas para evitar errores de tipo de retorno
DROP FUNCTION IF EXISTS public.get_user_conversations_optimized(uuid, uuid);

-- 2. RPC Actualizado: Soporta target_user_id para chats directos
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
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- Asegurar que las conversaciones 1:1 existan (Llama a la lógica de sincronización)
  PERFORM public.sync_tenant_default_chats(p_tenant_id);

  return query
  with user_memberships as (
    select
      tcm.conversation_id,
      tcm.role as viewer_role,
      tcm.last_read_at
    from public.team_conversation_members tcm
    join public.team_conversations tc on tc.id = tcm.conversation_id
    where tc.tenant_id = p_tenant_id
      and tcm.user_id = coalesce(p_user_id, auth.uid())
  ),
  conv_stats as (
    select
      tm.conversation_id,
      max(tm.created_at) as last_message_at,
      (array_agg(tm.body order by tm.created_at desc))[1] as last_message_body,
      (array_agg(tm.sender_id order by tm.created_at desc))[1] as last_message_sender_id
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
    join user_memberships um on um.conversation_id = tm.conversation_id
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
    um.viewer_role,
    (
      SELECT tcm.user_id 
      FROM public.team_conversation_members tcm 
      WHERE tcm.conversation_id = tc.id 
        AND tc.type = 'direct' 
        AND tcm.user_id != coalesce(p_user_id, auth.uid()) 
      LIMIT 1
    ) as target_user_id,
    cs.last_message_sender_id
  from public.team_conversations tc
  join user_memberships um on um.conversation_id = tc.id
  left join conv_stats cs on cs.conversation_id = tc.id
  left join unread_counts uc on uc.conversation_id = tc.id
  left join member_counts mc on mc.conversation_id = tc.id
  where tc.tenant_id = p_tenant_id
    and coalesce(tc.is_archived, false) = false
  order by coalesce(cs.last_message_at, tc.created_at) desc, tc.name;
end;
$function$;

-- 3. Función de Sincronización de Chats Automatizada
CREATE OR REPLACE FUNCTION public.sync_tenant_default_chats(p_tenant_id uuid)
RETURNS void AS $$
DECLARE
    v_group_id uuid;
    v_tenant_name text;
    v_pair_record RECORD;
    v_direct_id uuid;
BEGIN
    -- A. Obtener el nombre de la barbería
    SELECT name INTO v_tenant_name FROM public.tenants WHERE id = p_tenant_id;

    -- B. Asegurar CHAT GRUPAL GENERAL (tipo 'all')
    SELECT id INTO v_group_id 
    FROM public.team_conversations 
    WHERE tenant_id = p_tenant_id AND type = 'all' AND is_default = true;

    IF v_group_id IS NULL THEN
        INSERT INTO public.team_conversations (tenant_id, type, name, is_default, created_by)
        VALUES (p_tenant_id, 'all', COALESCE(v_tenant_name, 'General'), true, '00000000-0000-0000-0000-000000000000'::uuid)
        RETURNING id INTO v_group_id;
    ELSE
        -- Actualizar nombre por si ha cambiado la barbería
        UPDATE public.team_conversations SET name = v_tenant_name WHERE id = v_group_id;
    END IF;

    -- Añadir a todos los miembros actuales al grupo general
    INSERT INTO public.team_conversation_members (conversation_id, user_id, role)
    SELECT v_group_id, m.user_id, 'member'
    FROM public.memberships m
    WHERE m.tenant_id = p_tenant_id
    ON CONFLICT (conversation_id, user_id) DO NOTHING;

    -- C. Asegurar CHATS DIRECTOS (1:1) entre todos los miembros
    FOR v_pair_record IN 
        SELECT a.user_id as user_a, b.user_id as user_b
        FROM public.memberships a
        CROSS JOIN public.memberships b
        WHERE a.tenant_id = p_tenant_id 
          AND b.tenant_id = p_tenant_id 
          AND a.user_id < b.user_id
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger para nuevos registros de membresía
CREATE OR REPLACE FUNCTION public.on_membership_created_sync_chats()
RETURNS trigger AS $$
BEGIN
    PERFORM public.sync_tenant_default_chats(NEW.tenant_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_chats_on_membership ON public.memberships;
CREATE TRIGGER tr_sync_chats_on_membership
AFTER INSERT ON public.memberships
FOR EACH ROW EXECUTE FUNCTION public.on_membership_created_sync_chats();

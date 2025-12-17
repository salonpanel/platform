-- Fix: Sistema de chat completo con conversaciones 1:1 automáticas
-- Fecha: 2025-12-10
-- Problema 1: Mensajes no se persisten después de recargar
-- Problema 2: No existen chats directos (1:1) con cada miembro
-- Problema 3: Chat grupal por defecto puede no existir

-- ============================================================================
-- FUNCIÓN: Inicializar chats 1:1 con todos los miembros del equipo
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ensure_direct_conversations_for_user(
  p_tenant_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  conversation_id UUID,
  other_user_id UUID,
  conversation_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_other_member RECORD;
  v_existing_conv_id UUID;
  v_new_conv_id UUID;
  v_other_user_name TEXT;
BEGIN
  -- Verificar que el usuario pertenece al tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Usuario no pertenece al tenant';
  END IF;

  -- Para cada otro miembro del tenant, crear conversación 1:1 si no existe
  FOR v_other_member IN
    SELECT m.user_id
    FROM public.memberships m
    WHERE m.tenant_id = p_tenant_id
      AND m.user_id <> p_user_id  -- Excluir al usuario actual
  LOOP
    -- Buscar conversación existente entre estos dos usuarios
    SELECT tc.id INTO v_existing_conv_id
    FROM public.team_conversations tc
    WHERE tc.tenant_id = p_tenant_id
      AND tc.type = 'direct'
      AND EXISTS (
        SELECT 1 FROM public.team_conversation_members tcm1
        WHERE tcm1.conversation_id = tc.id AND tcm1.user_id = p_user_id
      )
      AND EXISTS (
        SELECT 1 FROM public.team_conversation_members tcm2
        WHERE tcm2.conversation_id = tc.id AND tcm2.user_id = v_other_member.user_id
      )
      AND (
        SELECT COUNT(*) FROM public.team_conversation_members tcm3
        WHERE tcm3.conversation_id = tc.id
      ) = 2  -- Exactamente 2 miembros
    LIMIT 1;

    -- Si no existe, crear la conversación
    IF v_existing_conv_id IS NULL THEN
      -- Obtener nombre del otro usuario
      SELECT COALESCE(p.full_name, u.email, 'Usuario')
      INTO v_other_user_name
      FROM auth.users u
      LEFT JOIN public.profiles p ON p.id = u.id
      WHERE u.id = v_other_member.user_id;

      -- Crear conversación directa
      INSERT INTO public.team_conversations (
        tenant_id,
        type,
        name,
        created_by,
        is_default
      )
      VALUES (
        p_tenant_id,
        'direct',
        v_other_user_name,  -- Nombre del otro usuario
        p_user_id,
        false
      )
      RETURNING id INTO v_new_conv_id;

      -- Agregar ambos usuarios como miembros
      INSERT INTO public.team_conversation_members (conversation_id, user_id, role)
      VALUES 
        (v_new_conv_id, p_user_id, 'member'),
        (v_new_conv_id, v_other_member.user_id, 'member')
      ON CONFLICT (conversation_id, user_id) DO NOTHING;

      -- Retornar la nueva conversación creada
      RETURN QUERY
      SELECT v_new_conv_id, v_other_member.user_id, v_other_user_name;
    ELSE
      -- Retornar la conversación existente
      SELECT tc.name INTO v_other_user_name
      FROM public.team_conversations tc
      WHERE tc.id = v_existing_conv_id;

      RETURN QUERY
      SELECT v_existing_conv_id, v_other_member.user_id, v_other_user_name;
    END IF;
  END LOOP;

  RETURN;
END;
$$;

COMMENT ON FUNCTION public.ensure_direct_conversations_for_user IS 
'Crea conversaciones directas (1:1) con todos los miembros del equipo si no existen. 
Retorna lista de conversaciones creadas o existentes.';

GRANT EXECUTE ON FUNCTION public.ensure_direct_conversations_for_user TO authenticated;

-- ============================================================================
-- FUNCIÓN: Obtener o crear conversación directa entre dos usuarios
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(
  p_tenant_id UUID,
  p_user_a UUID,
  p_user_b UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_user_b_name TEXT;
BEGIN
  -- Verificar que ambos usuarios pertenecen al tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE tenant_id = p_tenant_id AND user_id = p_user_a
  ) THEN
    RAISE EXCEPTION 'Usuario A no pertenece al tenant';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE tenant_id = p_tenant_id AND user_id = p_user_b
  ) THEN
    RAISE EXCEPTION 'Usuario B no pertenece al tenant';
  END IF;

  -- Buscar conversación existente
  SELECT tc.id INTO v_conversation_id
  FROM public.team_conversations tc
  WHERE tc.tenant_id = p_tenant_id
    AND tc.type = 'direct'
    AND EXISTS (
      SELECT 1 FROM public.team_conversation_members tcm1
      WHERE tcm1.conversation_id = tc.id AND tcm1.user_id = p_user_a
    )
    AND EXISTS (
      SELECT 1 FROM public.team_conversation_members tcm2
      WHERE tcm2.conversation_id = tc.id AND tcm2.user_id = p_user_b
    )
    AND (
      SELECT COUNT(*) FROM public.team_conversation_members tcm3
      WHERE tcm3.conversation_id = tc.id
    ) = 2
  LIMIT 1;

  -- Si no existe, crearla
  IF v_conversation_id IS NULL THEN
    -- Obtener nombre del usuario B para el nombre de la conversación
    SELECT COALESCE(p.full_name, u.email, 'Usuario')
    INTO v_user_b_name
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id = p_user_b;

    -- Crear conversación
    INSERT INTO public.team_conversations (
      tenant_id,
      type,
      name,
      created_by,
      is_default
    )
    VALUES (
      p_tenant_id,
      'direct',
      v_user_b_name,
      p_user_a,
      false
    )
    RETURNING id INTO v_conversation_id;

    -- Agregar ambos usuarios
    INSERT INTO public.team_conversation_members (conversation_id, user_id, role)
    VALUES 
      (v_conversation_id, p_user_a, 'member'),
      (v_conversation_id, p_user_b, 'member')
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;

  RETURN v_conversation_id;
END;
$$;

COMMENT ON FUNCTION public.get_or_create_direct_conversation IS 
'Obtiene o crea una conversación directa entre dos usuarios específicos.';

GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation TO authenticated;

-- ============================================================================
-- VERIFICACIÓN: Debugging de mensajes que no se guardan
-- ============================================================================

-- Verificar que los triggers están activos
DO $$
BEGIN
  RAISE NOTICE 'Verificando triggers de team_messages...';
  
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_team_messages_bump_conversation' 
    AND tgrelid = 'public.team_messages'::regclass
  ) THEN
    RAISE NOTICE '✓ Trigger trg_team_messages_bump_conversation está activo';
  ELSE
    RAISE WARNING '✗ Trigger trg_team_messages_bump_conversation NO EXISTE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_team_messages_set_edited_at' 
    AND tgrelid = 'public.team_messages'::regclass
  ) THEN
    RAISE NOTICE '✓ Trigger trg_team_messages_set_edited_at está activo';
  ELSE
    RAISE WARNING '✗ Trigger trg_team_messages_set_edited_at NO EXISTE';
  END IF;
END $$;

-- Verificar políticas RLS de INSERT en team_messages
DO $$
BEGIN
  RAISE NOTICE 'Verificando políticas RLS de team_messages...';
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'team_messages' 
    AND policyname = 'team_messages_insert'
    AND schemaname = 'public'
  ) THEN
    RAISE NOTICE '✓ Política team_messages_insert existe';
  ELSE
    RAISE WARNING '✗ Política team_messages_insert NO EXISTE - Los mensajes pueden no guardarse!';
  END IF;
END $$;

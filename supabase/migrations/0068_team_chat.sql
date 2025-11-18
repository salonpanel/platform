-- 0068_team_chat.sql
-- Espacio de chat interno por tenant (conversaciones, miembros, mensajes + helpers)

-- Extensión requerida
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

--------------------------------------------------------------------------------
-- Tablas base
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.team_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('all', 'direct', 'group')),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB
);

COMMENT ON TABLE public.team_conversations IS 'Conversaciones internas del equipo (por tenant).';
COMMENT ON COLUMN public.team_conversations.type IS 'all = canal global, direct = 1:1, group = subconjunto del equipo.';
COMMENT ON COLUMN public.team_conversations.metadata IS 'JSON libre para flags futuros (p.ej. iconos, color, participantes).';

CREATE INDEX IF NOT EXISTS idx_team_conversations_tenant
  ON public.team_conversations(tenant_id);

CREATE INDEX IF NOT EXISTS idx_team_conversations_type
  ON public.team_conversations(tenant_id, type);

CREATE UNIQUE INDEX IF NOT EXISTS uq_team_conversations_default_all
  ON public.team_conversations(tenant_id)
  WHERE type = 'all' AND is_default = true;

CREATE TABLE IF NOT EXISTS public.team_conversation_members (
  conversation_id UUID NOT NULL REFERENCES public.team_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (conversation_id, user_id)
);

COMMENT ON TABLE public.team_conversation_members IS 'Miembros asignados a cada conversación interna.';
COMMENT ON COLUMN public.team_conversation_members.role IS 'Rol dentro de la conversación (member/admin).';

CREATE INDEX IF NOT EXISTS idx_team_conversation_members_user
  ON public.team_conversation_members(user_id);

CREATE INDEX IF NOT EXISTS idx_team_conversation_members_conversation
  ON public.team_conversation_members(conversation_id);

CREATE INDEX IF NOT EXISTS idx_team_conversation_members_read
  ON public.team_conversation_members(conversation_id, last_read_at);

CREATE TABLE IF NOT EXISTS public.team_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.team_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  metadata JSONB
);

COMMENT ON TABLE public.team_messages IS 'Mensajes enviados dentro de team_conversations.';
COMMENT ON COLUMN public.team_messages.deleted_at IS 'Marca de borrado lógico (soft delete).';

CREATE INDEX IF NOT EXISTS idx_team_messages_conversation_created_at
  ON public.team_messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_team_messages_tenant_created_at
  ON public.team_messages(tenant_id, created_at);

CREATE INDEX IF NOT EXISTS idx_team_messages_sender
  ON public.team_messages(sender_id);

--------------------------------------------------------------------------------
-- Triggers utilitarios
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.team_conversations_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_team_conversations_touch ON public.team_conversations;
CREATE TRIGGER trg_team_conversations_touch
  BEFORE UPDATE ON public.team_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.team_conversations_touch_updated_at();

CREATE OR REPLACE FUNCTION public.team_messages_set_edited_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.body IS DISTINCT FROM OLD.body OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at OR NEW.metadata IS DISTINCT FROM OLD.metadata THEN
    NEW.edited_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_team_messages_set_edited_at ON public.team_messages;
CREATE TRIGGER trg_team_messages_set_edited_at
  BEFORE UPDATE ON public.team_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.team_messages_set_edited_at();

CREATE OR REPLACE FUNCTION public.team_messages_bump_conversation()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.team_conversations
    SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_team_messages_bump_conversation ON public.team_messages;
CREATE TRIGGER trg_team_messages_bump_conversation
  AFTER INSERT ON public.team_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.team_messages_bump_conversation();

--------------------------------------------------------------------------------
-- RLS
--------------------------------------------------------------------------------

ALTER TABLE public.team_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;

-- team_conversations
DROP POLICY IF EXISTS team_conversations_select_members ON public.team_conversations;
CREATE POLICY team_conversations_select_members
ON public.team_conversations
FOR SELECT
TO authenticated
USING (
  public.user_has_role_for_tenant(tenant_id, NULL)
  AND EXISTS (
    SELECT 1
    FROM public.team_conversation_members tcm
    WHERE tcm.conversation_id = team_conversations.id
      AND tcm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS team_conversations_insert_members ON public.team_conversations;
CREATE POLICY team_conversations_insert_members
ON public.team_conversations
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_has_role_for_tenant(tenant_id, NULL)
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS team_conversations_update_admins ON public.team_conversations;
CREATE POLICY team_conversations_update_admins
ON public.team_conversations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.team_conversation_members tcm
    WHERE tcm.conversation_id = team_conversations.id
      AND tcm.user_id = auth.uid()
  )
  AND (
    created_by = auth.uid()
    OR public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin'])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.team_conversation_members tcm
    WHERE tcm.conversation_id = team_conversations.id
      AND tcm.user_id = auth.uid()
  )
  AND (
    created_by = auth.uid()
    OR public.user_has_role_for_tenant(tenant_id, ARRAY['owner','admin'])
  )
);

DROP POLICY IF EXISTS team_conversations_delete_admins ON public.team_conversations;
CREATE POLICY team_conversations_delete_admins
ON public.team_conversations
FOR DELETE
TO authenticated
USING (
  (public.user_has_role_for_tenant(tenant_id, ARRAY['owner', 'admin']))
  OR (created_by = auth.uid())
);

-- team_conversation_members
DROP POLICY IF EXISTS team_conversation_members_select ON public.team_conversation_members;
CREATE POLICY team_conversation_members_select
ON public.team_conversation_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.team_conversation_members self
    WHERE self.conversation_id = team_conversation_members.conversation_id
      AND self.user_id = auth.uid()
  )
);

-- Insertarse a sí mismo (primer miembro de una conversación)
DROP POLICY IF EXISTS team_conversation_members_insert_self ON public.team_conversation_members;
CREATE POLICY team_conversation_members_insert_self
ON public.team_conversation_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.team_conversations tc
    WHERE tc.id = conversation_id
      AND public.user_has_role_for_tenant(tc.tenant_id, NULL)
  )
);

-- Insertar a otros miembros (solo creador o roles altos del tenant)
DROP POLICY IF EXISTS team_conversation_members_insert_admins ON public.team_conversation_members;
CREATE POLICY team_conversation_members_insert_admins
ON public.team_conversation_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id <> auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.team_conversations tc
    WHERE tc.id = conversation_id
      AND (
        tc.created_by = auth.uid()
        OR public.user_has_role_for_tenant(tc.tenant_id, ARRAY['owner','admin'])
      )
  )
  AND EXISTS (
    SELECT 1 FROM public.team_conversation_members self
    WHERE self.conversation_id = conversation_id
      AND self.user_id = auth.uid()
  )
);

-- Actualizar campos propios (last_read_at, notifications)
DROP POLICY IF EXISTS team_conversation_members_update_self ON public.team_conversation_members;
CREATE POLICY team_conversation_members_update_self
ON public.team_conversation_members
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Actualizar miembros (roles) solo para admins/creador
DROP POLICY IF EXISTS team_conversation_members_update_admins ON public.team_conversation_members;
CREATE POLICY team_conversation_members_update_admins
ON public.team_conversation_members
FOR UPDATE
TO authenticated
USING (
  user_id <> auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.team_conversations tc
    WHERE tc.id = conversation_id
      AND (
        tc.created_by = auth.uid()
        OR public.user_has_role_for_tenant(tc.tenant_id, ARRAY['owner','admin'])
      )
  )
)
WITH CHECK (
  user_id <> auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.team_conversations tc
    WHERE tc.id = conversation_id
      AND (
        tc.created_by = auth.uid()
        OR public.user_has_role_for_tenant(tc.tenant_id, ARRAY['owner','admin'])
      )
  )
);

-- Eliminar miembros (no puedes eliminarte a ti mismo)
DROP POLICY IF EXISTS team_conversation_members_delete_admins ON public.team_conversation_members;
CREATE POLICY team_conversation_members_delete_admins
ON public.team_conversation_members
FOR DELETE
TO authenticated
USING (
  user_id <> auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.team_conversations tc
    WHERE tc.id = conversation_id
      AND (
        tc.created_by = auth.uid()
        OR public.user_has_role_for_tenant(tc.tenant_id, ARRAY['owner','admin'])
      )
  )
);

-- team_messages
DROP POLICY IF EXISTS team_messages_select_members ON public.team_messages;
CREATE POLICY team_messages_select_members
ON public.team_messages
FOR SELECT
TO authenticated
USING (
  public.user_has_role_for_tenant(tenant_id, NULL)
  AND EXISTS (
    SELECT 1
    FROM public.team_conversation_members tcm
    WHERE tcm.conversation_id = team_messages.conversation_id
      AND tcm.user_id = auth.uid()
  )
  AND deleted_at IS NULL
);

DROP POLICY IF EXISTS team_messages_insert_members ON public.team_messages;
CREATE POLICY team_messages_insert_members
ON public.team_messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_has_role_for_tenant(tenant_id, NULL)
  AND sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.team_conversation_members tcm
    WHERE tcm.conversation_id = team_messages.conversation_id
      AND tcm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS team_messages_update_author ON public.team_messages;
CREATE POLICY team_messages_update_author
ON public.team_messages
FOR UPDATE
TO authenticated
USING (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.team_conversation_members tcm
    WHERE tcm.conversation_id = team_messages.conversation_id
      AND tcm.user_id = auth.uid()
  )
)
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.team_conversation_members tcm
    WHERE tcm.conversation_id = team_messages.conversation_id
      AND tcm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS team_messages_delete_author ON public.team_messages;
CREATE POLICY team_messages_delete_author
ON public.team_messages
FOR DELETE
TO authenticated
USING (sender_id = auth.uid());

--------------------------------------------------------------------------------
-- Funciones auxiliares (seguras)
--------------------------------------------------------------------------------

-- Listado de miembros del tenant para UI (nombre, avatar, rol)
CREATE OR REPLACE FUNCTION public.list_tenant_members(p_tenant_id UUID)
RETURNS TABLE (
  user_id UUID,
  tenant_role TEXT,
  display_name TEXT,
  avatar_url TEXT,
  staff_id UUID,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.user_has_role_for_tenant(p_tenant_id, NULL) THEN
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
$$;

GRANT EXECUTE ON FUNCTION public.list_tenant_members(UUID) TO authenticated;

-- Garantiza la existencia del canal global y enrola a todos los memberships
CREATE OR REPLACE FUNCTION public.ensure_default_team_conversation(p_tenant_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_tenant_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.user_has_role_for_tenant(p_tenant_id, NULL) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT id
  INTO v_conversation_id
  FROM public.team_conversations
  WHERE tenant_id = p_tenant_id
    AND type = 'all'
    AND is_default = true
  ORDER BY created_at
  LIMIT 1;

  IF v_conversation_id IS NULL THEN
    SELECT name INTO v_tenant_name FROM public.tenants WHERE id = p_tenant_id;

    INSERT INTO public.team_conversations (tenant_id, type, name, is_default, created_by)
    VALUES (
      p_tenant_id,
      'all',
      COALESCE(v_tenant_name, 'Chat de equipo'),
      true,
      auth.uid()
    )
    RETURNING id INTO v_conversation_id;

    INSERT INTO public.team_conversation_members (conversation_id, user_id, role)
    SELECT v_conversation_id, m.user_id, 'member'
    FROM public.memberships m
    WHERE m.tenant_id = p_tenant_id
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;

  RETURN v_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_default_team_conversation(UUID) TO authenticated;

-- Busca conversación directa existente entre dos usuarios
CREATE OR REPLACE FUNCTION public.find_direct_team_conversation(
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.user_has_role_for_tenant(p_tenant_id, NULL) THEN
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
$$;

GRANT EXECUTE ON FUNCTION public.find_direct_team_conversation(UUID, UUID, UUID) TO authenticated;

--------------------------------------------------------------------------------
-- Comentarios finales
--------------------------------------------------------------------------------

COMMENT ON FUNCTION public.list_tenant_members(UUID) IS 'Devuelve miembros del tenant (rol + datos de staff) para UI del chat.';
COMMENT ON FUNCTION public.ensure_default_team_conversation(UUID) IS 'Garantiza que exista el canal global de equipo por tenant y enrola a todos los usuarios.';
COMMENT ON FUNCTION public.find_direct_team_conversation(UUID, UUID, UUID) IS 'Busca una conversación directa existente entre dos usuarios del mismo tenant.';



-- 0071_add_get_conversation_members_rpc.sql
-- Función RPC para obtener todos los miembros de una conversación
-- Resuelve el problema de RLS que solo permite ver nuestros propios memberships

-- Eliminar función existente si existe (necesario si cambiamos el tipo de retorno)
DROP FUNCTION IF EXISTS public.get_conversation_members(UUID);

-- Función para obtener miembros de una conversación (si el usuario es miembro)
CREATE FUNCTION public.get_conversation_members(p_conversation_id UUID)
RETURNS TABLE (
  user_id UUID,
  role TEXT,
  joined_at TIMESTAMPTZ,
  display_name TEXT,
  profile_photo_url TEXT,
  tenant_role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Verificar autenticación
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Verificar que el usuario es miembro de esta conversación
  IF NOT EXISTS (
    SELECT 1 FROM public.team_conversation_members
    WHERE conversation_id = p_conversation_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Obtener tenant_id de la conversación
  SELECT tenant_id INTO v_tenant_id
  FROM public.team_conversations
  WHERE id = p_conversation_id;

  -- Retornar todos los miembros de la conversación con información del perfil
  RETURN QUERY
  SELECT
    tcm.user_id,
    tcm.role,
    tcm.joined_at,
    public.get_user_display_name(auth.uid(), tcm.user_id, v_tenant_id) AS display_name,
    public.get_user_profile_photo(tcm.user_id, v_tenant_id) AS profile_photo_url,
    m.role AS tenant_role
  FROM public.team_conversation_members tcm
  LEFT JOIN public.memberships m
    ON m.user_id = tcm.user_id
    AND m.tenant_id = v_tenant_id
  WHERE tcm.conversation_id = p_conversation_id
  ORDER BY tcm.joined_at ASC;
END;
$$;

COMMENT ON FUNCTION public.get_conversation_members(UUID) IS 'Obtiene todos los miembros de una conversación si el usuario actual es miembro de ella.';

GRANT EXECUTE ON FUNCTION public.get_conversation_members(UUID) TO authenticated;


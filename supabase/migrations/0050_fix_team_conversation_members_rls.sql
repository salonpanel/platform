-- Fix para la política RLS de team_conversation_members que causa error 500
-- Ejecuta este script en el SQL Editor de Supabase
-- Versión simplificada sin recursión

DROP POLICY IF EXISTS team_conversation_members_select ON public.team_conversation_members;

-- Política simple: los usuarios solo pueden ver sus propios memberships
-- Para ver otros miembros de una conversación, usaremos una función RPC o vista
CREATE POLICY team_conversation_members_select
ON public.team_conversation_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());


-- Migration: Add chat messages table for internal staff communication
-- Supports both group chat and private messages

-- Crear tabla para mensajes de chat
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = mensaje grupal
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant_id ON public.chat_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_recipient_id ON public.chat_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant_recipient ON public.chat_messages(tenant_id, recipient_id);

-- Habilitar RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view chat messages" ON public.chat_messages;
CREATE POLICY "Members can view chat messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.memberships
    WHERE memberships.tenant_id = chat_messages.tenant_id
    AND memberships.user_id = auth.uid()
  )
  AND (
    -- Puede ver mensajes grupales (recipient_id IS NULL) o mensajes privados donde es remitente o destinatario
    chat_messages.recipient_id IS NULL
    OR chat_messages.sender_id = auth.uid()
    OR chat_messages.recipient_id = auth.uid()
  )
);

-- Los miembros del tenant pueden enviar mensajes
DROP POLICY IF EXISTS "Members can send chat messages" ON public.chat_messages;
CREATE POLICY "Members can send chat messages"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.memberships
    WHERE memberships.tenant_id = chat_messages.tenant_id
    AND memberships.user_id = auth.uid()
  )
  AND sender_id = auth.uid()
  -- Solo puede enviar mensajes privados a otros miembros del mismo tenant
  AND (
    recipient_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.tenant_id = chat_messages.tenant_id
      AND memberships.user_id = chat_messages.recipient_id
    )
  )
);

-- Los miembros pueden editar/eliminar sus propios mensajes
DROP POLICY IF EXISTS "Members can update own messages" ON public.chat_messages;
CREATE POLICY "Members can update own messages"
ON public.chat_messages
FOR UPDATE
TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Members can delete own messages" ON public.chat_messages;
CREATE POLICY "Members can delete own messages"
ON public.chat_messages
FOR DELETE
TO authenticated
USING (sender_id = auth.uid());

-- Comentarios
COMMENT ON TABLE public.chat_messages IS 'Mensajes de chat interno entre miembros del staff';
COMMENT ON COLUMN public.chat_messages.recipient_id IS 'NULL = mensaje grupal (visible para todos los miembros del tenant)';
COMMENT ON COLUMN public.chat_messages.message IS 'Contenido del mensaje';

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_chat_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'chat_messages_updated_at'
  ) THEN
    CREATE TRIGGER chat_messages_updated_at
      BEFORE UPDATE ON public.chat_messages
      FOR EACH ROW
      EXECUTE FUNCTION update_chat_messages_updated_at();
  END IF;
END $$;


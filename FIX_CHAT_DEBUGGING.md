# Chat de equipo — notas de depuración

## Estado actual (2026)

- **UI:** `app/panel/chat/page.tsx` (servidor) carga datos con `getInitialChatPageData` (`src/lib/chat-page-data.ts`) y renderiza `ChatPageClient` → `TeamChatOptimized`.
- **Cliente:** `useChatPageData` en `src/hooks/useOptimizedData.ts` revalida en segundo plano; el **realtime** de mensajes está solo en `TeamChatOptimized` (un canal), no duplicado en el hook.
- **RPCs principales:** `get_user_conversations_optimized`, `list_tenant_members`, `get_conversation_messages_paginated`, `find_direct_team_conversation`.
- **Sincronización de DMs:** por usuario (`ensure_direct_chats_for_user`) + grupo general (`ensure_tenant_group_chat`); trigger en `memberships` al dar de alta un miembro.

## Cómo verificar en Supabase

```sql
SELECT * FROM team_messages
WHERE conversation_id = '<uuid>'
ORDER BY created_at DESC
LIMIT 10;

SELECT * FROM team_conversation_members
WHERE conversation_id = '<uuid>' AND user_id = auth.uid();
```

Políticas RLS: `pg_policies` donde `tablename` = `team_messages`.

## Eliminado

- `TeamChat.tsx` (sustituido por `TeamChatOptimized`).

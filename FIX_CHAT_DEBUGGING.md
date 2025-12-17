# Fix del Sistema de Chat - Debugging y Mejoras

## 📋 Cambios Realizados

### 1. **Migración SQL: `0111_fix_team_chat_complete.sql`**

Esta migración agrega dos nuevas funciones SQL:

#### `ensure_direct_conversations_for_user(p_tenant_id, p_user_id)`
- **Propósito**: Crea automáticamente conversaciones 1:1 con todos los miembros del equipo
- **Funcionamiento**:
  - Busca todos los miembros del tenant (excluyendo al usuario actual)
  - Para cada miembro, verifica si ya existe una conversación directa
  - Si no existe, la crea automáticamente
  - Si existe, la retorna sin duplicar
- **Retorna**: Lista de conversaciones (existentes o nuevas) con `conversation_id`, `other_user_id`, `conversation_name`

#### `get_or_create_direct_conversation(p_tenant_id, p_user_a, p_user_b)`
- **Propósito**: Obtener o crear una conversación directa entre dos usuarios específicos
- **Funcionamiento**:
  - Busca si ya existe una conversación directa entre ambos usuarios
  - Si no existe, la crea con el nombre del otro usuario
  - Agrega ambos usuarios a `team_conversation_members`
- **Retorna**: `conversation_id` (UUID)

### 2. **Frontend: `TeamChat.tsx`**

#### Cambio 1: Auto-creación de chats 1:1 en bootstrap
```typescript
const [defaultConvResult, directConvsResult, conversationsResult] = await Promise.all([
  supabase.rpc("ensure_default_team_conversation", { p_tenant_id: targetTenantId }),
  supabase.rpc("ensure_direct_conversations_for_user", { 
    p_tenant_id: targetTenantId, 
    p_user_id: user.id 
  }),
  loadConversationsOptimized(targetTenantId, user.id)
]);
```

**Efecto**: Al cargar el chat, automáticamente:
1. ✅ Crea/verifica el chat grupal por defecto ("all")
2. ✅ Crea/verifica chats 1:1 con cada miembro del equipo
3. ✅ Carga todas las conversaciones existentes

#### Cambio 2: Logs de debugging mejorados

**En `handleSendMessage`:**
```typescript
console.log("[TeamChat] ✓ Mensaje insertado correctamente:", {
  id: data?.id,
  conversation_id: selectedConversation.id,
  body_preview: trimmedBody.slice(0, 30),
  tenant_id: tenantId
});
```

**En `loadMessagesForConversation`:**
```typescript
console.log("[TeamChat] 📥 Cargando mensajes para conversación:", conversationId);
console.log(`[TeamChat] ✓ Mensajes cargados: ${data?.length || 0} mensajes`);
```

**Propósito**: Entender exactamente qué está pasando cuando:
- Se envía un mensaje
- Se recargan los mensajes después de un reload

---

## 🧪 Cómo Probar

### Paso 1: Aplicar la migración SQL
```bash
# Opción A: Si tienes Docker Desktop corriendo
npx supabase db reset

# Opción B: Aplicar manualmente en Supabase Studio
# 1. Ir a Supabase Studio → SQL Editor
# 2. Copiar contenido de supabase/migrations/0111_fix_team_chat_complete.sql
# 3. Ejecutar la migración
```

### Paso 2: Probar en el navegador

#### Test 1: Verificar auto-creación de chats 1:1
1. Abrir la página de Chat (`/panel/chat`)
2. Abrir DevTools Console (F12)
3. Buscar este log:
   ```
   [TeamChat] ✓ 3 conversaciones directas verificadas/creadas
   ```
4. En la UI, deberías ver:
   - 1 chat grupal (tipo "all") con todos los miembros
   - N chats directos (uno por cada miembro del equipo, excluyéndote a ti)

#### Test 2: Verificar persistencia de mensajes
1. Seleccionar cualquier conversación
2. Enviar un mensaje: "Hola, esto es una prueba"
3. En DevTools Console, verificar:
   ```
   [TeamChat] ✓ Mensaje insertado correctamente: { id: "...", conversation_id: "...", ... }
   ```
4. **Recargar la página** (F5 o Ctrl+R)
5. Volver a abrir la misma conversación
6. En DevTools Console, verificar:
   ```
   [TeamChat] 📥 Cargando mensajes para conversación: ...
   [TeamChat] ✓ Mensajes cargados: 1 mensajes
   ```
7. El mensaje "Hola, esto es una prueba" **debe aparecer**

---

## 🔍 Debugging Avanzado

### Si los mensajes siguen desapareciendo:

1. **Verificar que el mensaje se insertó:**
   ```sql
   SELECT * FROM team_messages 
   WHERE conversation_id = 'UUID_DE_LA_CONVERSACION'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

2. **Verificar que eres miembro de la conversación:**
   ```sql
   SELECT * FROM team_conversation_members
   WHERE conversation_id = 'UUID_DE_LA_CONVERSACION'
   AND user_id = 'TU_USER_ID';
   ```

3. **Verificar políticas RLS:**
   ```sql
   -- Ver políticas activas
   SELECT * FROM pg_policies 
   WHERE tablename = 'team_messages' 
   AND schemaname = 'public';
   ```

4. **Verificar si hay errores en el log de Supabase:**
   - Ir a Supabase Dashboard → Logs → Postgres Logs
   - Buscar errores relacionados con `team_messages` o `RLS`

### Si los chats 1:1 no se crean:

1. **Verificar que la función RPC existe:**
   ```sql
   SELECT proname, prosrc FROM pg_proc 
   WHERE proname = 'ensure_direct_conversations_for_user';
   ```

2. **Ejecutar manualmente la función:**
   ```sql
   SELECT * FROM ensure_direct_conversations_for_user(
     'TU_TENANT_ID'::UUID,
     'TU_USER_ID'::UUID
   );
   ```

3. **Ver logs en DevTools Console:**
   - Si hay un warning tipo:
     ```
     [TeamChat] ensure_direct_conversations_for_user no disponible o error: ...
     ```
   - Significa que la función RPC no está deployada o hay un error de permisos

---

## 📊 Resultados Esperados

### Antes:
- ❌ Solo aparece chat grupal, sin chats 1:1
- ❌ Mensajes desaparecen al recargar página
- ❌ No hay logs de debugging

### Después:
- ✅ Chat grupal + chats 1:1 con cada miembro
- ✅ Mensajes persisten después de recargar
- ✅ Logs claros en console para debugging

---

## 🚀 Próximos Pasos (Si es necesario)

Si después de estos cambios los mensajes **SIGUEN** desapareciendo:

1. **Verificar RLS en `team_messages`:**
   - Posible causa: La política SELECT no permite leer mensajes propios
   - Solución: Modificar política `team_messages_select` para incluir `sender_id = auth.uid()`

2. **Verificar triggers:**
   - Posible causa: El trigger `bump_conversation` está fallando silenciosamente
   - Solución: Revisar logs de Postgres para errores en triggers

3. **Verificar tenant_id en sesión:**
   - Posible causa: El `tenant_id` en el mensaje no coincide con el `tenant_id` de la sesión
   - Solución: Agregar `set_config('app.tenant_id', ...)` en las políticas RLS

---

## 📝 Notas Técnicas

### Optimizaciones implementadas:
- **Parallel queries**: Bootstrap ejecuta 3 queries en paralelo (grupo + 1:1 + conversaciones)
- **Fallback silencioso**: Si `ensure_direct_conversations_for_user` falla, no bloquea la carga
- **Lazy loading**: Miembros se cargan después de 100ms para no bloquear UI

### Compatibilidad:
- ✅ Si la migración no está deployada, el chat funciona igual (solo sin chats 1:1 auto)
- ✅ Si ya existen chats 1:1, no se duplican
- ✅ Funciona tanto en desarrollo como en producción

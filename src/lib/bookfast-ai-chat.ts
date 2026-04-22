/**
 * BookFast AI — persistencia local y ronda de chat que sigue en segundo plano
 * aunque el usuario navegue fuera de /panel/bookfast-ai.
 */

export type BookfastAiChatRole = "user" | "assistant";

export interface BookfastAiChatMessage {
  id: string;
  role: BookfastAiChatRole;
  content: string;
  meta?: {
    toolsCalled?: string[];
    durationMs?: number;
  };
}

export const BOOKFAST_AI_CHAT_STORAGE_KEY = "bookfast-ai.chat.v1";
const PENDING_STORAGE_KEY = "bookfast-ai.pending.v1";
const UNREAD_STORAGE_KEY = "bookfast-ai.unread-reply.v1";

export const BOOKFAST_AI_STORAGE_EVENT = "bookfast-ai-storage-updated";
export const BOOKFAST_AI_PENDING_EVENT = "bookfast-ai-pending-changed";

type PersistedChatStateV1 = {
  v: 1;
  messages: BookfastAiChatMessage[];
  sessionId: string | null;
};

type PendingPayloadV1 = { v: 1; userMessageId: string; startedAt: number };

interface ChatResponse {
  sessionId: string;
  reply: string;
  meta?: {
    toolsCalled?: string[];
    durationMs?: number;
    stepCount?: number;
  };
}

interface ChatError {
  error: string;
  message: string;
}

function genAssistantId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function sanitizeMessagesFromStorage(raw: unknown): BookfastAiChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: BookfastAiChatMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    if (
      typeof m.id !== "string" ||
      (m.role !== "user" && m.role !== "assistant") ||
      typeof m.content !== "string"
    ) {
      continue;
    }
    const msg: BookfastAiChatMessage = {
      id: m.id,
      role: m.role,
      content: m.content,
    };
    if (m.meta && typeof m.meta === "object") {
      const meta = m.meta as Record<string, unknown>;
      const toolsCalled = Array.isArray(meta.toolsCalled)
        ? meta.toolsCalled.filter((t): t is string => typeof t === "string")
        : undefined;
      const durationMs =
        typeof meta.durationMs === "number" ? meta.durationMs : undefined;
      if (toolsCalled?.length || durationMs !== undefined) {
        msg.meta = { toolsCalled, durationMs };
      }
    }
    out.push(msg);
  }
  return out;
}

export function loadPersistedBookfastAiChat(): Pick<
  PersistedChatStateV1,
  "messages" | "sessionId"
> | null {
  if (typeof window === "undefined") return null;
  try {
    let raw = localStorage.getItem(BOOKFAST_AI_CHAT_STORAGE_KEY);
    if (!raw) {
      const legacy = sessionStorage.getItem(BOOKFAST_AI_CHAT_STORAGE_KEY);
      if (legacy) {
        localStorage.setItem(BOOKFAST_AI_CHAT_STORAGE_KEY, legacy);
        sessionStorage.removeItem(BOOKFAST_AI_CHAT_STORAGE_KEY);
        raw = legacy;
      }
    }
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<PersistedChatStateV1>;
    if (data.v !== 1) return null;
    const messages = sanitizeMessagesFromStorage(data.messages);
    const sessionId =
      data.sessionId === null
        ? null
        : typeof data.sessionId === "string"
          ? data.sessionId
          : null;
    return { messages, sessionId };
  } catch {
    return null;
  }
}

export function savePersistedBookfastAiChat(
  messages: BookfastAiChatMessage[],
  sessionId: string | null,
) {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedChatStateV1 = {
      v: 1,
      messages,
      sessionId,
    };
    localStorage.setItem(
      BOOKFAST_AI_CHAT_STORAGE_KEY,
      JSON.stringify(payload),
    );
  } catch {
    // quota, modo privado, etc.
  }
}

export function clearPersistedBookfastAiChat() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(BOOKFAST_AI_CHAT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function dispatchStorageUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BOOKFAST_AI_STORAGE_EVENT));
}

function dispatchPendingChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BOOKFAST_AI_PENDING_EVENT));
}

/** Para refrescar badges del header/sidebar tras limpiar estado local. */
export function bookfastAiEmitNavRefresh() {
  dispatchStorageUpdated();
  dispatchPendingChanged();
}

export function getBookfastAiPending(): PendingPayloadV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PENDING_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<PendingPayloadV1>;
    if (data.v !== 1 || typeof data.userMessageId !== "string") return null;
    return data as PendingPayloadV1;
  } catch {
    return null;
  }
}

function setBookfastAiPending(userMessageId: string) {
  if (typeof window === "undefined") return;
  try {
    const payload: PendingPayloadV1 = {
      v: 1,
      userMessageId,
      startedAt: Date.now(),
    };
    localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function clearBookfastAiPending() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PENDING_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getBookfastAiUnreadReply(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(UNREAD_STORAGE_KEY) === "1";
}

export function setBookfastAiUnreadReply() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(UNREAD_STORAGE_KEY, "1");
  } catch {
    // ignore
  }
}

export function clearBookfastAiUnreadReply() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(UNREAD_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function isBookfastAiRoute(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/panel/bookfast-ai")
  );
}

function revertUserMessage(userMessageId: string) {
  const snap = loadPersistedBookfastAiChat();
  if (!snap) {
    clearPersistedBookfastAiChat();
    return;
  }
  const msgs = snap.messages.filter((m) => m.id !== userMessageId);
  const sessionId = msgs.length === 0 ? null : snap.sessionId;
  if (msgs.length === 0 && sessionId === null) {
    clearPersistedBookfastAiChat();
  } else {
    savePersistedBookfastAiChat(msgs, sessionId);
  }
}

/**
 * Ejecuta el POST al asistente y actualiza localStorage al terminar.
 * No usa AbortController: la petición sigue aunque el usuario cambie de página.
 */
export async function completeBookfastAiChatRound(params: {
  trimmed: string;
  sessionId: string | null;
  userMsg: BookfastAiChatMessage;
  messagesWithUser: BookfastAiChatMessage[];
  sessionIdForSave: string | null;
}): Promise<
  | { ok: true }
  | { ok: false; error: string; restoreMessageText: string }
> {
  const {
    trimmed,
    sessionId,
    userMsg,
    messagesWithUser,
    sessionIdForSave,
  } = params;

  savePersistedBookfastAiChat(messagesWithUser, sessionIdForSave);
  setBookfastAiPending(userMsg.id);
  dispatchPendingChanged();
  dispatchStorageUpdated();

  try {
    const res = await fetch("/api/asistente/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: trimmed,
        sessionId: sessionId ?? undefined,
      }),
    });

    const json = (await res.json()) as ChatResponse | ChatError;

    if (!res.ok) {
      const errMsg =
        (json as ChatError).message ||
        "No se ha podido enviar el mensaje. Prueba de nuevo.";
      revertUserMessage(userMsg.id);
      clearBookfastAiPending();
      dispatchPendingChanged();
      dispatchStorageUpdated();
      return { ok: false, error: errMsg, restoreMessageText: trimmed };
    }

    const ok = json as ChatResponse;
    const assistant: BookfastAiChatMessage = {
      id: genAssistantId(),
      role: "assistant",
      content: ok.reply,
      meta: {
        toolsCalled: ok.meta?.toolsCalled ?? [],
        durationMs: ok.meta?.durationMs,
      },
    };

    const snap = loadPersistedBookfastAiChat();
    let msgs = snap?.messages ?? messagesWithUser;
    const sidStored = snap?.sessionId ?? sessionIdForSave;

    if (msgs.length === 0 || msgs[msgs.length - 1]?.id !== userMsg.id) {
      const hasUser = msgs.some((m) => m.id === userMsg.id);
      msgs = hasUser ? msgs : [...msgs, userMsg];
    }

    msgs = [...msgs, assistant];
    const newSessionId = ok.sessionId || sidStored;

    savePersistedBookfastAiChat(msgs, newSessionId);
    clearBookfastAiPending();

    if (!isBookfastAiRoute()) {
      setBookfastAiUnreadReply();
    }

    dispatchPendingChanged();
    dispatchStorageUpdated();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de red";
    revertUserMessage(userMsg.id);
    clearBookfastAiPending();
    dispatchPendingChanged();
    dispatchStorageUpdated();
    return { ok: false, error: msg, restoreMessageText: trimmed };
  }
}

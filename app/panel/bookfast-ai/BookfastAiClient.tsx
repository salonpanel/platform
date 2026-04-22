"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Send,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Wallet,
  CalendarDays,
  Users,
  Euro,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * BookFast AI — UI de chat del asistente.
 *
 * Llama a POST /api/asistente/chat con { message, sessionId? }.
 * Mantiene sessionId en estado para encadenar mensajes dentro del mismo hilo.
 *
 * No usa streaming (fase 1). Muestra un indicador mientras el turn del LLM
 * se resuelve en el servidor. En una fase posterior se migrará a SSE.
 */

type Role = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  meta?: {
    toolsCalled?: string[];
    durationMs?: number;
  };
}

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

const QUICK_PROMPTS: Array<{
  icon: typeof CalendarDays;
  label: string;
  prompt: string;
}> = [
  {
    icon: CalendarDays,
    label: "Agenda de hoy",
    prompt: "¿Qué citas tengo hoy?",
  },
  {
    icon: Wallet,
    label: "Pagos pendientes",
    prompt: "¿Cuántos pagos pendientes tengo y por qué importe?",
  },
  {
    icon: Euro,
    label: "Ingresos del mes",
    prompt: "¿Cuánto he facturado hoy, esta semana y este mes?",
  },
  {
    icon: Users,
    label: "Buscar cliente",
    prompt: "Ayúdame a buscar un cliente por nombre.",
  },
];

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Altura mínima del textarea (una línea), alineada con el botón enviar (h-10). */
const COMPOSER_MIN_HEIGHT_PX = 40;
/** A partir de esta altura de contenido se considera multilínea: botón abajo a la derecha. */
const COMPOSER_MULTILINE_THRESHOLD_PX = 46;
/** Máximo de altura del recuadro; luego scroll interno (como WhatsApp / iMessage). */
const COMPOSER_MAX_HEIGHT_PX = 160;
const COMPOSER_MAX_CHARS = 8000;

/** Persiste el hilo en localStorage para conservarlo entre rutas, pestañas y visitas. */
const CHAT_LOCAL_STORAGE_KEY = "bookfast-ai.chat.v1";

type PersistedChatStateV1 = {
  v: 1;
  messages: ChatMessage[];
  sessionId: string | null;
};

function sanitizeMessagesFromStorage(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
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
    const msg: ChatMessage = {
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

function loadPersistedChatState(): Pick<
  PersistedChatStateV1,
  "messages" | "sessionId"
> | null {
  if (typeof window === "undefined") return null;
  try {
    let raw = localStorage.getItem(CHAT_LOCAL_STORAGE_KEY);
    if (!raw) {
      const legacy = sessionStorage.getItem(CHAT_LOCAL_STORAGE_KEY);
      if (legacy) {
        localStorage.setItem(CHAT_LOCAL_STORAGE_KEY, legacy);
        sessionStorage.removeItem(CHAT_LOCAL_STORAGE_KEY);
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

function savePersistedChatState(
  messages: ChatMessage[],
  sessionId: string | null,
) {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedChatStateV1 = {
      v: 1,
      messages,
      sessionId,
    };
    localStorage.setItem(CHAT_LOCAL_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // quota, modo privado, etc.
  }
}

function clearPersistedChatState() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CHAT_LOCAL_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function dispatchBottomNavRecalc() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("bookfast-ai-composer-change"));
}

/** Hueco visual bajo el teclado (iOS/Android) para mantener el compositor visible. */
function useVisualKeyboardInset(active: boolean) {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!active) {
      setInset(0);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const bottomGap = Math.max(
        0,
        window.innerHeight - vv.height - Math.max(0, vv.offsetTop),
      );
      setInset(bottomGap);
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);

  return inset;
}

export default function BookfastAiClient() {
  const hydratedRef = useRef<{ messages: ChatMessage[]; sessionId: string | null } | null>(
    null,
  );
  if (hydratedRef.current === null) {
    const p = loadPersistedChatState();
    hydratedRef.current = {
      messages: p?.messages ?? [],
      sessionId: p?.sessionId ?? null,
    };
  }
  const [messages, setMessages] = useState<ChatMessage[]>(
    () => hydratedRef.current!.messages,
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(
    () => hydratedRef.current!.sessionId,
  );
  const [composerActive, setComposerActive] = useState(false);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [composerMultiline, setComposerMultiline] = useState(false);

  const keyboardInset = useVisualKeyboardInset(composerActive);

  useEffect(() => {
    if (messages.length === 0 && sessionId === null) {
      clearPersistedChatState();
      return;
    }
    savePersistedChatState(messages, sessionId);
  }, [messages, sessionId]);

  // Auto-scroll al final cuando se añade mensaje
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-resize del textarea hasta COMPOSER_MAX_HEIGHT_PX; luego scroll interno
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const natural = el.scrollHeight;
    const clamped = Math.min(
      Math.max(natural, COMPOSER_MIN_HEIGHT_PX),
      COMPOSER_MAX_HEIGHT_PX,
    );
    el.style.height = `${clamped}px`;
    el.style.overflowY =
      natural > COMPOSER_MAX_HEIGHT_PX ? "auto" : "hidden";
    setComposerMultiline(natural > COMPOSER_MULTILINE_THRESHOLD_PX);
  }, [input]);

  // Móvil: al escribir ocultamos la tab bar y liberamos el hueco; al salir recalculamos.
  useEffect(() => {
    if (composerActive) {
      document.documentElement.setAttribute("data-bookfast-ai-composer", "1");
      document.documentElement.style.setProperty("--bottom-nav-offset", "0px");
    } else {
      document.documentElement.removeAttribute("data-bookfast-ai-composer");
      document.documentElement.style.removeProperty("--bottom-nav-offset");
    }
    dispatchBottomNavRecalc();
    return () => {
      document.documentElement.removeAttribute("data-bookfast-ai-composer");
      document.documentElement.style.removeProperty("--bottom-nav-offset");
      dispatchBottomNavRecalc();
    };
  }, [composerActive]);

  const handleComposerFocus = useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setComposerActive(true);
  }, []);

  const handleComposerBlur = useCallback(() => {
    blurTimeoutRef.current = setTimeout(() => {
      setComposerActive(false);
      blurTimeoutRef.current = null;
    }, 180);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setError(null);
      setInput("");

      const userMsg: ChatMessage = {
        id: genId(),
        role: "user",
        content: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

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
          setError(errMsg);
          // Si hubo error, quitamos el mensaje del usuario para que pueda reintentarlo
          setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
          setInput(trimmed);
          return;
        }

        const ok = json as ChatResponse;
        if (!sessionId && ok.sessionId) setSessionId(ok.sessionId);

        const asst: ChatMessage = {
          id: genId(),
          role: "assistant",
          content: ok.reply,
          meta: {
            toolsCalled: ok.meta?.toolsCalled ?? [],
            durationMs: ok.meta?.durationMs,
          },
        };
        setMessages((prev) => [...prev, asst]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error de red";
        setError(msg);
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        setInput(trimmed);
      } finally {
        setLoading(false);
      }
    },
    [loading, sessionId],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const resetConversation = () => {
    clearPersistedChatState();
    setMessages([]);
    setSessionId(null);
    setError(null);
    setInput("");
  };

  const isEmpty = messages.length === 0;

  const composerPadBottom =
    keyboardInset > 0
      ? Math.max(10, keyboardInset)
      : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-0 pt-2 md:pt-3">
      {/* Título en TopBar/sidebar: solo acción secundaria si hay mensajes */}
      {messages.length > 0 && (
        <div className="flex shrink-0 items-center justify-end">
          <button
            type="button"
            onClick={resetConversation}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium",
              "bg-white/5 text-white/70 ring-1 ring-white/10",
              "hover:bg-white/10 hover:text-white/90 transition",
            )}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Nueva conversación
          </button>
        </div>
      )}

      {/* Área de mensajes: sin scroll en vacío (móvil); solo el hilo con mensajes hace scroll */}
      <div
        className={cn(
          "min-h-0 flex-1",
          isEmpty
            ? "flex min-h-0 flex-col overflow-hidden"
            : "overflow-y-auto",
        )}
      >
        {isEmpty ? (
          <EmptyState onPick={sendMessage} />
        ) : (
          <div className="flex flex-col gap-4 px-4 py-6 md:px-6">
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </AnimatePresence>
            {loading && <ThinkingBubble />}
            <div ref={scrollAnchorRef} />
          </div>
        )}
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              "shrink-0 flex items-start gap-2 rounded-xl px-3 py-2",
              "bg-red-500/10 ring-1 ring-red-500/30 text-red-200 text-sm",
            )}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-300/70 hover:text-red-200 text-xs"
            >
              cerrar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra de entrada fija abajo: con teclado sube y no compite con la tab bar */}
      <form
        onSubmit={handleSubmit}
        style={
          composerPadBottom !== undefined
            ? { paddingBottom: composerPadBottom }
            : undefined
        }
        className={cn(
          "shrink-0 flex gap-2 rounded-2xl px-3 py-2",
          composerMultiline ? "items-end" : "items-center",
          "bg-white/[0.04] ring-1 ring-white/10",
          "focus-within:ring-white/20 focus-within:bg-white/[0.06] transition",
          composerPadBottom === undefined && "pb-[max(0.625rem,env(safe-area-inset-bottom))] md:pb-3",
        )}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleComposerFocus}
          onBlur={handleComposerBlur}
          placeholder="Pregúntale a BookFast AI lo que necesites…"
          rows={1}
          maxLength={COMPOSER_MAX_CHARS}
          disabled={loading}
          className={cn(
            "min-h-[40px] w-full min-w-0 flex-1 resize-none bg-transparent",
            "px-0 py-2 text-sm leading-[1.35] text-white/95",
            "placeholder:text-white/35 focus:outline-none",
            "disabled:opacity-50",
          )}
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl",
            "bg-gradient-to-br from-violet-500 to-sky-500 text-white",
            "shadow-[0_6px_20px_rgba(123,92,255,0.3)] ring-1 ring-white/15",
            "hover:brightness-110 transition",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none",
          )}
          aria-label="Enviar"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>
    </div>
  );
}

// ── Subcomponentes ───────────────────────────────────────────────────────────

/**
 * Mini-Markdown en mensajes del asistente: `**negrita**`, `*cursiva*`
 * (los `**` van antes en el patrón para no confundirlos con un solo `*`).
 */
function renderAssistantMarkdown(text: string): ReactNode {
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index));
    }
    if (m[1] !== undefined) {
      nodes.push(
        <strong key={`md-b-${k++}`} className="font-semibold text-white">
          {m[1]}
        </strong>,
      );
    } else if (m[2] !== undefined) {
      nodes.push(
        <em key={`md-i-${k++}`} className="italic text-white/95">
          {m[2]}
        </em>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  if (nodes.length === 0) {
    return text;
  }
  return <>{nodes}</>;
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col justify-center px-3 py-3 text-center md:px-6 md:py-10",
        "max-md:justify-start max-md:pt-4",
      )}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl md:mb-5 md:h-14 md:w-14",
          "bg-gradient-to-br from-violet-500 to-sky-500",
          "shadow-[0_10px_40px_rgba(123,92,255,0.45)] ring-1 ring-white/20",
        )}
      >
        <Sparkles className="h-6 w-6 text-white md:h-7 md:w-7" />
      </motion.div>
      <h2 className="mb-1 font-satoshi text-base font-semibold text-white/95 md:mb-2 md:text-xl">
        ¿En qué puedo ayudarte?
      </h2>
      <p className="mx-auto mb-4 max-w-md text-xs leading-snug text-white/55 md:mb-8 md:text-sm md:leading-relaxed">
        <span className="md:hidden">
          Agenda, clientes, ingresos y más — en vivo.
        </span>
        <span className="hidden md:inline">
          Pregúntame por tu agenda, clientes, ingresos, pagos pendientes, o lo
          que necesites. Puedo consultarlo en vivo y responderte al momento.
        </span>
      </p>
      <div className="grid w-full max-w-xl grid-cols-2 gap-2 md:grid-cols-2 md:gap-3">
        {QUICK_PROMPTS.map((q) => {
          const Icon = q.icon;
          return (
            <button
              key={q.label}
              type="button"
              onClick={() => onPick(q.prompt)}
              className={cn(
                "group flex min-h-0 flex-col items-center gap-1.5 rounded-xl p-2.5 text-center md:flex-row md:items-start md:gap-3 md:p-4 md:text-left",
                "bg-white/[0.03] ring-1 ring-white/10",
                "hover:bg-white/[0.06] hover:ring-white/20 transition",
              )}
            >
              <div
                className={cn(
                  "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg md:h-8 md:w-8",
                  "bg-gradient-to-br from-violet-500/80 to-sky-500/70 ring-1 ring-white/15",
                )}
              >
                <Icon className="h-3.5 w-3.5 text-white md:h-4 md:w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium leading-tight text-white/90 md:text-sm">
                  {q.label}
                </div>
                <div className="mt-0.5 hidden text-xs leading-snug text-white/50 md:block">
                  {q.prompt}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-gradient-to-br from-violet-500/90 to-sky-500/90 text-white shadow-[0_6px_20px_rgba(123,92,255,0.3)]"
            : "bg-white/[0.05] text-white/90 ring-1 ring-white/10",
        )}
      >
        <div className="whitespace-pre-wrap break-words">
          {isUser ? message.content : renderAssistantMarkdown(message.content)}
        </div>
        {!isUser &&
          message.meta?.toolsCalled &&
          message.meta.toolsCalled.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1 border-t border-white/10 pt-2">
              {message.meta.toolsCalled.map((t, i) => (
                <span
                  key={`${t}-${i}`}
                  className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-white/60"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
      </div>
    </motion.div>
  );
}

function ThinkingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl px-4 py-3",
          "bg-white/[0.05] ring-1 ring-white/10",
        )}
      >
        <span className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/60 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/60 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/60" />
        </span>
        <span className="text-xs text-white/50">Pensando…</span>
      </div>
    </motion.div>
  );
}

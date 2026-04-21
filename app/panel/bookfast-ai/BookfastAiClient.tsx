"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

export default function BookfastAiClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll al final cuando se añade mensaje
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-resize del textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

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
    setMessages([]);
    setSessionId(null);
    setError(null);
    setInput("");
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-theme(spacing.20))] flex-col px-4 md:px-8">
      {/* Header compacto */}
      <div className="flex items-center justify-between pb-4 pt-2 md:pt-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              "bg-gradient-to-br from-violet-500 to-sky-500",
              "shadow-[0_8px_24px_rgba(123,92,255,0.35)] ring-1 ring-white/20",
            )}
          >
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white/95 font-satoshi">
              BookFast AI
            </h1>
            <p className="text-xs text-white/50">
              Tu asistente inteligente
              {sessionId ? " · conversación activa" : ""}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
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
        )}
      </div>

      {/* Chat scroll area */}
      <div className="flex-1 overflow-y-auto rounded-2xl bg-white/[0.02] ring-1 ring-white/10">
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
              "mt-3 flex items-start gap-2 rounded-xl px-3 py-2",
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

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className={cn(
          "mt-3 mb-4 flex items-end gap-2 rounded-2xl p-2",
          "bg-white/[0.04] ring-1 ring-white/10",
          "focus-within:ring-white/20 focus-within:bg-white/[0.06] transition",
        )}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pregúntale a BookFast AI lo que necesites…"
          rows={1}
          disabled={loading}
          className={cn(
            "flex-1 resize-none bg-transparent px-3 py-2 text-sm text-white/95",
            "placeholder:text-white/35 focus:outline-none",
            "disabled:opacity-50",
          )}
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl",
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

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "mb-5 flex h-14 w-14 items-center justify-center rounded-2xl",
          "bg-gradient-to-br from-violet-500 to-sky-500",
          "shadow-[0_10px_40px_rgba(123,92,255,0.45)] ring-1 ring-white/20",
        )}
      >
        <Sparkles className="h-7 w-7 text-white" />
      </motion.div>
      <h2 className="mb-2 text-xl font-semibold text-white/95 font-satoshi">
        ¿En qué puedo ayudarte?
      </h2>
      <p className="mb-8 max-w-md text-sm text-white/55 leading-relaxed">
        Pregúntame por tu agenda, clientes, ingresos, pagos pendientes, o lo que
        necesites. Puedo consultarlo en vivo y responderte al momento.
      </p>
      <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
        {QUICK_PROMPTS.map((q) => {
          const Icon = q.icon;
          return (
            <button
              key={q.label}
              type="button"
              onClick={() => onPick(q.prompt)}
              className={cn(
                "group flex items-start gap-3 rounded-xl p-4 text-left",
                "bg-white/[0.03] ring-1 ring-white/10",
                "hover:bg-white/[0.06] hover:ring-white/20 transition",
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                  "bg-gradient-to-br from-violet-500/80 to-sky-500/70 ring-1 ring-white/15",
                )}
              >
                <Icon className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-white/90">
                  {q.label}
                </div>
                <div className="mt-0.5 text-xs text-white/50 leading-snug">
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
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
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

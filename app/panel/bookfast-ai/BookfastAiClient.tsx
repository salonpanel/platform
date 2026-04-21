"use client";

import { motion } from "framer-motion";
import { Sparkles, MessageCircle, Zap, ShieldCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Client component del BookFast AI.
 *
 * Por ahora muestra un placeholder de "próximamente" con el diseño visual
 * consistente con el resto del panel (glassmorphism + gradients).
 * Se sustituirá por la UI de chat en la Fase 0 (ver PROPUESTA_ASISTENTE_IA.md).
 */
export default function BookfastAiClient() {
  const previews: Array<{
    icon: typeof Sparkles;
    title: string;
    description: string;
  }> = [
    {
      icon: MessageCircle,
      title: "Conversa con tu negocio",
      description:
        "Pregunta cualquier cosa sobre tu agenda, clientes, ingresos o equipo y obtén respuestas al instante.",
    },
    {
      icon: Zap,
      title: "Acciones automáticas",
      description:
        "Cancela, reprograma, contacta clientes por WhatsApp o email: la IA lo ejecuta por ti con una frase.",
    },
    {
      icon: ShieldCheck,
      title: "Con memoria y contexto",
      description:
        "Aprende los patrones de tus clientes y de tu barbería para anticiparse a lo que necesitas.",
    },
    {
      icon: Clock,
      title: "24/7 a tu disposición",
      description:
        "Desde tu móvil o tu ordenador, el asistente está siempre listo sin interrumpir tu trabajo.",
    },
  ];

  return (
    <div className="flex flex-col gap-8 px-4 pb-20 md:px-8 md:pb-12">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "relative overflow-hidden rounded-3xl",
          "bg-gradient-to-br from-[rgba(123,92,255,0.18)] via-[rgba(56,189,248,0.08)] to-[rgba(236,72,153,0.12)]",
          "border border-white/10",
          "px-6 py-10 md:px-12 md:py-14"
        )}
      >
        {/* Halo decorativo */}
        <div
          className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full opacity-60 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(123,92,255,0.35) 0%, transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full opacity-50 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.3) 0%, transparent 70%)",
          }}
        />

        <div className="relative flex flex-col items-start gap-5">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-2xl",
              "bg-gradient-to-br from-violet-500 to-sky-500",
              "shadow-[0_10px_40px_rgba(123,92,255,0.45)]",
              "ring-1 ring-white/20"
            )}
          >
            <Sparkles className="h-7 w-7 text-white" />
          </motion.div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest",
                  "bg-white/10 text-white/80 ring-1 ring-white/15"
                )}
              >
                Próximamente
              </span>
              <span className="text-xs font-medium text-white/50">
                Fase 0 — Base técnica
              </span>
            </div>
            <h1
              className="text-3xl md:text-5xl font-bold tracking-tight"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.65) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              BookFast AI
            </h1>
            <p className="max-w-2xl text-base md:text-lg text-white/65 leading-relaxed">
              Tu asistente inteligente, entrenado con los datos de tu barbería.
              Responde cualquier pregunta, ejecuta acciones y aprende de los
              patrones de tus clientes para anticiparse a lo que necesitas.
            </p>
          </div>

          {/* CTA simulado (deshabilitado hasta fase 0) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex flex-wrap items-center gap-3 pt-2"
          >
            <button
              type="button"
              disabled
              className={cn(
                "flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold",
                "bg-white/10 text-white/50 ring-1 ring-white/10",
                "cursor-not-allowed"
              )}
              aria-disabled="true"
            >
              <MessageCircle className="h-4 w-4" />
              Empezar conversación
            </button>
            <span className="text-xs text-white/45">
              Estará disponible muy pronto
            </span>
          </motion.div>
        </div>
      </motion.section>

      {/* Previews de capacidades */}
      <section className="space-y-4">
        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-lg md:text-xl font-semibold text-white/90 font-satoshi"
        >
          Qué podrás hacer con BookFast AI
        </motion.h2>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          {previews.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.article
                key={item.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.35 + index * 0.08,
                  duration: 0.5,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={cn(
                  "group relative overflow-hidden rounded-2xl p-5 md:p-6",
                  "bg-white/[0.03] ring-1 ring-white/10",
                  "hover:bg-white/[0.05] hover:ring-white/15",
                  "transition-all duration-300"
                )}
              >
                <div
                  className={cn(
                    "mb-4 flex h-10 w-10 items-center justify-center rounded-xl",
                    "bg-gradient-to-br from-violet-500/80 to-sky-500/70",
                    "ring-1 ring-white/15 shadow-[0_6px_20px_rgba(123,92,255,0.3)]"
                  )}
                >
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-base font-semibold text-white/95 font-satoshi">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-white/55 leading-relaxed">
                  {item.description}
                </p>
              </motion.article>
            );
          })}
        </div>
      </section>

      {/* Pie con nota técnica discreta */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="mt-4 rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-4 text-xs text-white/40 leading-relaxed"
      >
        Estamos preparando la base técnica del asistente. En las próximas
        semanas tendrás acceso a un chat conversacional capaz de leer y actuar
        sobre tu barbería con total autonomía. Si quieres seguir el progreso,
        consulta <span className="text-white/55 font-medium">PROPUESTA_ASISTENTE_IA.md</span>.
      </motion.div>
    </div>
  );
}

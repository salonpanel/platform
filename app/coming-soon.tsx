"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Gradiente de fondo animado */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{
            background: "radial-gradient(circle, rgba(79, 227, 193, 0.3) 0%, transparent 70%)",
          }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.2, 0.3, 0.2],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div 
          className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{
            background: "radial-gradient(circle, rgba(160, 107, 255, 0.3) 0%, transparent 70%)",
          }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.2, 0.3, 0.2],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            delay: 2,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Contenido principal */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
        className="relative z-10 w-full max-w-2xl"
      >
        <Card 
          variant="glass" 
          padding="lg" 
          radius="xl"
          className="text-center backdrop-blur-xl"
        >
          {/* Logo/Icono */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-8"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-aqua)] mb-6 shadow-[var(--glow-aqua)]">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
          </motion.div>

          {/* Título */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-[var(--accent-blue)] via-[var(--accent-aqua)] to-[var(--accent-purple)] bg-clip-text text-transparent"
            style={{
              fontFamily: "var(--font-heading), system-ui, sans-serif",
            }}
          >
            BookFast
          </motion.h1>

          {/* Subtítulo */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-xl md:text-2xl text-[var(--text-primary)] mb-6 font-medium"
            style={{
              fontFamily: "var(--font-body), system-ui, sans-serif",
            }}
          >
            Esta herramienta está en desarrollo
          </motion.p>

          {/* Mensaje */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="text-[var(--text-secondary)] text-base md:text-lg mb-8 leading-relaxed max-w-md mx-auto"
            style={{
              fontFamily: "var(--font-body), system-ui, sans-serif",
            }}
          >
            Vuelve más adelante para descubrir todo sobre BookFast
          </motion.p>

          {/* Indicador de carga animado */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="flex items-center justify-center gap-2"
          >
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-[var(--accent-aqua)]"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
          </motion.div>
        </Card>

        {/* Footer sutil */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="text-center mt-8 text-sm text-[var(--text-tertiary)]"
          style={{
            fontFamily: "var(--font-body), system-ui, sans-serif",
          }}
        >
          © {new Date().getFullYear()} BookFast. Todos los derechos reservados.
        </motion.p>
      </motion.div>
    </div>
  );
}


"use client";

import Link from "next/link";
import { ShieldX, ArrowLeft, Mail } from "lucide-react";
import { motion } from "framer-motion";

export default function SinPermisosPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--bg-primary)]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="max-w-md w-full mx-4"
      >
        <div className="glass p-8 rounded-[var(--radius-xl)] border border-[rgba(255,255,255,0.1)] shadow-[0px_8px_32px_rgba(0,0,0,0.3)]">
          {/* Icono */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
            className="flex justify-center mb-6"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
              <ShieldX className="w-10 h-10 text-red-400" />
            </div>
          </motion.div>

          {/* Título */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold text-[var(--text-primary)] text-center mb-3 font-satoshi"
          >
            Acceso denegado
          </motion.h1>

          {/* Descripción */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="text-[var(--text-secondary)] text-center mb-6 leading-relaxed"
          >
            No tienes permisos para ver esta página. 
            <br />
            Contacta con el propietario de tu organización para solicitar acceso.
          </motion.p>

          {/* Información adicional */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[rgba(255,255,255,0.03)] rounded-[var(--radius-lg)] p-4 mb-6 border border-[rgba(255,255,255,0.05)]"
          >
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-[var(--accent-aqua)] mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  Si crees que esto es un error, verifica tus permisos en la sección de Staff o contacta con soporte.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Botón volver */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Link
              href="/panel"
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-[var(--accent-aqua)] to-[var(--accent-purple)] text-white rounded-[var(--radius-md)] font-medium hover:shadow-[0px_4px_20px_rgba(123,92,255,0.4)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al inicio
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

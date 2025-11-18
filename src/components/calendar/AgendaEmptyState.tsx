"use client";

import { Calendar, Plus, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { parseISO } from "date-fns";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/Toast";

interface AgendaEmptyStateProps {
  selectedDate: string;
  onCreateBooking: () => void;
  bookingLink?: string;
}

export function AgendaEmptyState({
  selectedDate,
  onCreateBooking,
  bookingLink,
}: AgendaEmptyStateProps) {
  const { showToast, ToastComponent } = useToast();
  
  // Formatear fecha usando Intl.DateTimeFormat (nativo de JS, más compatible)
  const formattedDate = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parseISO(selectedDate));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex items-center justify-center h-full w-full p-6"
    >
      <div className="bg-[#15171A] rounded-2xl p-10 max-w-2xl w-full border border-white/5 shadow-[0px_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md">
        <div className="flex flex-col items-center text-center">
          {/* Ilustración premium con animación */}
          <motion.div 
            className="mb-6 relative"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.2, ease: "easeOut" }}
          >
            <div className="w-24 h-24 rounded-full bg-gradient-to-r from-[#3A6DFF] to-[#4FE3C1] flex items-center justify-center shadow-[0px_8px_32px_rgba(58,109,255,0.3)]">
              <Calendar className="h-12 w-12 text-white" strokeWidth={1.5} />
            </div>
            <motion.div 
              className="absolute -top-2 -right-2 w-9 h-9 rounded-full bg-gradient-to-br from-[#FFC107] to-[#FF6DA3] flex items-center justify-center border-2 border-[#15171A] shadow-[0px_4px_12px_rgba(255,193,7,0.4)]"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Plus className="h-4 w-4 text-white" strokeWidth={3} />
            </motion.div>
          </motion.div>

          {/* Título */}
          <motion.h3 
            className="text-2xl font-semibold text-white mb-3 font-['Plus_Jakarta_Sans'] tracking-tight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            Aún no tienes reservas para hoy
          </motion.h3>

          {/* Descripción */}
          <motion.p 
            className="text-[#d1d4dc] mb-8 max-w-md text-[15px] leading-relaxed font-['Plus_Jakarta_Sans']"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <span className="font-semibold text-white">{formattedDate}</span> está libre de citas. Puedes crear una reserva manualmente o compartir
            tu enlace de reservas online para que tus clientes reserven directamente.
          </motion.p>

          {/* Acciones */}
          <motion.div 
            className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <button
              onClick={onCreateBooking}
              className="w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-[#3A6DFF] to-[#4FE3C1] hover:shadow-[0px_4px_12px_rgba(58,109,255,0.3)] rounded-[10px] transition-all duration-150 flex items-center justify-center gap-2 font-['Plus_Jakarta_Sans']"
            >
              <Plus className="h-4 w-4" />
              Crear reserva manual
            </button>

            {bookingLink && (
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(bookingLink);
                    showToast("Enlace copiado", "success");
                  } catch (err) {
                    showToast("Error al copiar el enlace", "error");
                  }
                }}
                className="w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white bg-white/5 hover:bg-white/8 border border-white/10 rounded-[10px] transition-all duration-150 flex items-center justify-center gap-2 font-['Plus_Jakarta_Sans']"
              >
                <Share2 className="h-4 w-4" />
                Copiar enlace de reservas
              </button>
            )}
          </motion.div>

          {/* Información adicional */}
          {bookingLink && (
            <motion.div 
              className="mt-8 pt-6 border-t border-white/5 w-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <p className="text-xs font-semibold text-[#9ca3af] mb-3 font-['Plus_Jakarta_Sans'] uppercase tracking-wider">
                Tu enlace de reservas online:
              </p>
              <div className="flex items-center gap-3 p-4 bg-white/5 rounded-[14px] border border-white/5">
                <code className="text-sm text-white flex-1 truncate font-mono">
                  {bookingLink}
                </code>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(bookingLink);
                      showToast("Enlace copiado", "success");
                    } catch (err) {
                      showToast("Error al copiar el enlace", "error");
                    }
                  }}
                  className="px-4 py-2 text-xs font-semibold text-[#4FE3C1] hover:text-white hover:bg-[rgba(79,227,193,0.15)] rounded-[8px] transition-all duration-150 font-['Plus_Jakarta_Sans']"
                >
                  Copiar
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
      {ToastComponent}
    </motion.div>
  );
}


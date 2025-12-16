"use client";

import { GlassModal } from "@/components/ui/glass/GlassModal";
import { GlassButton } from "@/components/ui/glass/GlassButton";
import { format } from "date-fns";
import { Calendar, Clock, User, Bell } from "lucide-react";
import { motion } from "framer-motion";

interface BookingMoveConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  booking: {
    customer?: { name: string } | null;
    starts_at: string;
    ends_at: string;
  } | null;
  newStartTime: string;
  newEndTime: string;
}

export function BookingMoveConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  booking,
  newStartTime,
  newEndTime,
}: BookingMoveConfirmModalProps) {
  if (!booking) return null;

  const originalStart = new Date(booking.starts_at);
  const originalEnd = new Date(booking.ends_at);
  const originalTime = format(originalStart, "HH:mm");

  // Parsear newStartTime (puede ser ISO string o ya formateado)
  let newTime = "";
  try {
    if (newStartTime.includes("T")) {
      const newStartDate = new Date(newStartTime);
      newTime = format(newStartDate, "HH:mm");
    } else {
      newTime = newStartTime;
    }
  } catch {
    newTime = newStartTime;
  }

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirmar cambio de horario"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <GlassButton variant="secondary" onClick={onClose}>
            Cancelar
          </GlassButton>
          <GlassButton onClick={onConfirm}>
            Confirmar cambio
          </GlassButton>
        </div>
      }
    >
      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="p-4 rounded-[16px] bg-gradient-to-br from-[rgba(58,109,255,0.08)] to-[rgba(79,227,193,0.05)] border border-[#3A6DFF]/30 backdrop-blur-sm"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-[12px] bg-[rgba(58,109,255,0.2)] backdrop-blur-sm">
              <User className="h-5 w-5 text-[#3A6DFF]" />
            </div>
            <div>
              <p className="text-[10px] text-[#9ca3af] font-semibold font-['Plus_Jakarta_Sans'] uppercase tracking-wider">Cliente</p>
              <p className="text-base font-semibold text-white font-['Plus_Jakarta_Sans']">
                {booking.customer?.name || "Sin cliente"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/5">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[10px] text-[#9ca3af] font-semibold font-['Plus_Jakarta_Sans'] uppercase tracking-wider">
                <Clock className="h-3.5 w-3.5" />
                <span>Horario actual</span>
              </div>
              <p className="text-lg font-semibold text-white font-['Plus_Jakarta_Sans']">
                {originalTime}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[10px] text-[#9ca3af] font-semibold font-['Plus_Jakarta_Sans'] uppercase tracking-wider">
                <Calendar className="h-3.5 w-3.5 text-[#3A6DFF]" />
                <span>Nuevo horario</span>
              </div>
              <p className="text-lg font-semibold text-[#3A6DFF] font-['Plus_Jakarta_Sans']">
                {newTime}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05, duration: 0.15 }}
          className="flex items-start gap-3 p-3.5 rounded-[14px] bg-[rgba(79,227,193,0.08)] border border-[#4FE3C1]/30 backdrop-blur-sm"
        >
          <Bell className="h-5 w-5 text-[#4FE3C1] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-white mb-1 font-['Plus_Jakarta_Sans']">
              Notificación al cliente
            </p>
            <p className="text-xs text-[#d1d4dc] leading-relaxed font-['Plus_Jakarta_Sans']">
              El cliente recibirá una notificación automática por SMS o email informándole del cambio de horario de su cita.
            </p>
          </div>
        </motion.div>

        <p className="text-sm text-[#d1d4dc] text-center font-['Plus_Jakarta_Sans'] pt-2">
          ¿Estás seguro de que deseas modificar esta reserva?
        </p>
      </div>
    </GlassModal>
  );
}


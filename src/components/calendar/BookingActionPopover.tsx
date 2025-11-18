"use client";

import { useEffect, useRef, useState } from "react";
import { Edit, X, MessageSquare, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import { BookingStatus, BOOKING_STATUS_CONFIG } from "@/types/agenda";

interface BookingActionPopoverProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onSendMessage: () => void;
  onStatusChange?: (newStatus: BookingStatus) => void;
  currentStatus?: BookingStatus;
  canCancel?: boolean;
}

export function BookingActionPopover({
  isOpen,
  position,
  onClose,
  onEdit,
  onCancel,
  onSendMessage,
  onStatusChange,
  currentStatus,
  canCancel = true,
}: BookingActionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState({ x: position.x, y: position.y });

  // Ajustar posición después de renderizar
  useEffect(() => {
    if (!isOpen) {
      setAdjustedPosition({ x: position.x, y: position.y });
      return;
    }

    // Offset pequeño del puntero
    const offset = 12;
    let x = position.x + offset;
    let y = position.y + offset;

    // Ajustar después de que el popover se renderice
    const adjustPosition = () => {
      if (!popoverRef.current) {
        setAdjustedPosition({ x, y });
        return;
      }

      const popover = popoverRef.current;
      const popoverWidth = popover.offsetWidth || 200;
      const popoverHeight = popover.offsetHeight || 150;
      const padding = 10;

      // Ajustar horizontalmente si se sale por la derecha
      if (x + popoverWidth + padding > window.innerWidth) {
        x = position.x - popoverWidth - offset;
      }
      // Ajustar horizontalmente si se sale por la izquierda
      if (x < padding) {
        x = padding;
      }

      // Ajustar verticalmente si se sale por abajo
      if (y + popoverHeight + padding > window.innerHeight) {
        y = position.y - popoverHeight - offset;
      }
      // Ajustar verticalmente si se sale por arriba
      if (y < padding) {
        y = padding;
      }

      setAdjustedPosition({ x, y });
    };

    // Primero establecer posición inicial
    setAdjustedPosition({ x, y });

    // Luego ajustar después de renderizar
    const rafId = requestAnimationFrame(() => {
      adjustPosition();
    });

    return () => cancelAnimationFrame(rafId);
  }, [isOpen, position]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="fixed z-[9999] rounded-2xl p-2 min-w-[200px] bg-[#15171A] border border-white/10 shadow-[0px_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md"
          style={{
            left: `${adjustedPosition.x}px`,
            top: `${adjustedPosition.y}px`,
            transform: 'translateZ(0)',
          }}
        >
      <div className="flex flex-col gap-0.5 p-1">
        <motion.button
          whileHover={{ x: 2, backgroundColor: "rgba(58,109,255,0.12)" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            onEdit();
            onClose();
          }}
          className="w-full flex items-center justify-start gap-3 px-4 py-2.5 text-sm font-semibold text-white hover:bg-[rgba(58,109,255,0.12)] transition-all duration-150 rounded-[10px] font-['Plus_Jakarta_Sans']"
        >
          <Edit className="h-4 w-4 text-[#3A6DFF]" />
          Modificar
        </motion.button>
        
        {/* Cambio rápido de estado */}
        {onStatusChange && currentStatus && (
          <>
            <div className="border-t border-white/5 my-1" />
            <div className="px-2 py-1.5">
              <div className="text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wider mb-1.5 font-['Plus_Jakarta_Sans']">
                Cambiar estado
              </div>
              <div className="flex flex-col gap-0.5">
                {(["pending", "paid", "completed", "cancelled", "no_show"] as BookingStatus[]).map((status) => {
                  if (status === currentStatus) return null;
                  const config = BOOKING_STATUS_CONFIG[status];
                  return (
                    <motion.button
                      key={status}
                      whileHover={{ x: 2, backgroundColor: config.legendBg }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        onStatusChange(status);
                        onClose();
                      }}
                      className="w-full flex items-center justify-start gap-2 px-3 py-1.5 text-xs font-semibold text-white hover:bg-opacity-20 transition-all duration-150 rounded-[8px] font-['Plus_Jakarta_Sans']"
                      style={{
                        backgroundColor: status === currentStatus ? config.legendBg : "transparent",
                        color: config.legendColor,
                      }}
                    >
                      <Circle className="h-3 w-3" fill="currentColor" />
                      {config.label}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </>
        )}
        
        <motion.button
          whileHover={{ x: 2, backgroundColor: "rgba(79,227,193,0.12)" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            onSendMessage();
            onClose();
          }}
          className="w-full flex items-center justify-start gap-3 px-4 py-2.5 text-sm font-semibold text-white hover:bg-[rgba(79,227,193,0.12)] transition-all duration-150 rounded-[10px] font-['Plus_Jakarta_Sans']"
        >
          <MessageSquare className="h-4 w-4 text-[#4FE3C1]" />
          Enviar mensaje
        </motion.button>
        {canCancel && (
          <>
            <div className="border-t border-white/5 my-1" />
            <motion.button
              whileHover={{ x: 2, backgroundColor: "rgba(239,68,68,0.12)" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                onCancel();
                onClose();
              }}
              className="w-full flex items-center justify-start gap-3 px-4 py-2.5 text-sm font-semibold text-[#EF4444] hover:bg-[rgba(239,68,68,0.12)] transition-all duration-150 rounded-[10px] font-['Plus_Jakarta_Sans']"
            >
              <X className="h-4 w-4" />
              Cancelar cita
            </motion.button>
          </>
        )}
      </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


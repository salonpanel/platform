"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, XCircle, Ban } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AgendaActionPopoverProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onNewBooking: () => void;
  onUnavailability: () => void;
  onAbsence: () => void;
}

/**
 * Popover que muestra 3 opciones al hacer clic en un hueco vacío de la agenda:
 * - Nueva cita
 * - Añadir falta de disponibilidad
 * - Añadir ausencia
 */
export function AgendaActionPopover({
  isOpen,
  position,
  onClose,
  onNewBooking,
  onUnavailability,
  onAbsence,
}: AgendaActionPopoverProps) {
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
      const popoverWidth = popover.offsetWidth || 240;
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

  // Cerrar al hacer clic fuera
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
          className="fixed z-[9999] min-w-[240px] rounded-2xl py-2 bg-[#15171A] border border-white/10 shadow-[0px_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md"
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
            onNewBooking();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-white hover:bg-[rgba(58,109,255,0.12)] transition-all duration-150 rounded-[10px] font-['Plus_Jakarta_Sans']"
        >
          <Calendar className="h-4 w-4 text-[#3A6DFF]" />
          <span>Nueva cita</span>
        </motion.button>

        <motion.button
          whileHover={{ x: 2, backgroundColor: "rgba(255,193,7,0.12)" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            onUnavailability();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-white hover:bg-[rgba(255,193,7,0.12)] transition-all duration-150 rounded-[10px] font-['Plus_Jakarta_Sans']"
        >
          <Ban className="h-4 w-4 text-[#FFC107]" />
          <span>Añadir falta de disponibilidad</span>
        </motion.button>

        <motion.button
          whileHover={{ x: 2, backgroundColor: "rgba(255,109,163,0.12)" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            onAbsence();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-white hover:bg-[rgba(255,109,163,0.12)] transition-all duration-150 rounded-[10px] font-['Plus_Jakarta_Sans']"
        >
          <XCircle className="h-4 w-4 text-[#FF6DA3]" />
          <span>Añadir ausencia</span>
        </motion.button>
      </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


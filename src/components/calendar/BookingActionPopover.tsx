"use client";

import { useEffect, useRef, useState } from "react";
import { Edit, X, MessageSquare, Circle } from "lucide-react";
import { GlassButton } from "@/components/ui/glass/GlassButton";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookingState,
  PaymentStatus,
  BOOKING_STATE_CONFIG,
  PAYMENT_STATUS_CONFIG,
  getBookingStateFromLegacyStatus,
  getPaymentStatusFromLegacyStatus,
} from "@/types/agenda";
import { GlassCard } from "@/components/agenda/primitives/GlassCard";
import { theme } from "@/theme/ui";
import { cn } from "@/lib/utils";
import { getMobileBottomNavInsetPx } from "@/lib/mobile-viewport";

interface BookingActionPopoverProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onSendMessage: () => void;
  onBookingStateChange?: (newState: BookingState) => void;
  onPaymentStatusChange?: (newPayment: PaymentStatus) => void;
  currentBookingState?: BookingState;
  currentPaymentStatus?: PaymentStatus;
  canCancel?: boolean;
}

export function BookingActionPopover({
  isOpen,
  position,
  onClose,
  onEdit,
  onCancel,
  onSendMessage,
  onBookingStateChange,
  onPaymentStatusChange,
  currentBookingState,
  currentPaymentStatus,
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
      const viewportBottom = window.innerHeight - getMobileBottomNavInsetPx();

      // Ajustar horizontalmente si se sale por la derecha
      if (x + popoverWidth + padding > window.innerWidth) {
        x = position.x - popoverWidth - offset;
      }
      // Ajustar horizontalmente si se sale por la izquierda
      if (x < padding) {
        x = padding;
      }

      // Ajustar verticalmente si se sale por debajo (respetando tab bar móvil)
      if (y + popoverHeight + padding > viewportBottom) {
        y = position.y - popoverHeight - offset;
      }
      if (y < padding) {
        y = padding;
      }
      const maxY = viewportBottom - popoverHeight - padding;
      if (y > maxY) {
        y = Math.max(padding, maxY);
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
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          style={{
            position: 'fixed',
            left: `${adjustedPosition.x}px`,
            top: `${adjustedPosition.y}px`,
            zIndex: 9999,
            transform: 'translateZ(0)',
          }}
        >
          <GlassCard variant="popover" padding="sm" className="min-w-52">
            <div className="flex flex-col gap-0.5">
              <motion.button
                whileHover={{ x: 2, backgroundColor: theme.colors.bgGlass }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  onEdit();
                  onClose();
                }}
                className={cn(
                  "w-full flex items-center justify-start gap-3 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-150",
                  "text-primary hover:bg-glass font-sans"
                )}
              >
                <Edit className="h-4 w-4 text-accent-blue" />
                Modificar
              </motion.button>

              {/* Cambio rápido de estado */}
              {(onBookingStateChange || onPaymentStatusChange) && (currentBookingState || currentPaymentStatus) && (
                <>
                  <div className={cn("border-t my-1", "border-border-default")} />
                  <div className="px-2 py-1.5">
                    <div className={cn(
                      "text-xs font-semibold uppercase tracking-wider mb-1.5",
                      "text-tertiary font-sans"
                    )}>
                      Estado de la cita
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {(Object.keys(BOOKING_STATE_CONFIG) as BookingState[]).map((state) => {
                        if (!onBookingStateChange) return null;
                        const current = currentBookingState ?? "pending";
                        if (state === current) return null;
                        const config = BOOKING_STATE_CONFIG[state];
                        return (
                          <motion.button
                            key={state}
                            whileHover={{ x: 2, backgroundColor: theme.colors.bgGlass }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              onBookingStateChange(state);
                              onClose();
                            }}
                            className={cn(
                              "w-full flex items-center justify-start gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150",
                              "text-primary hover:bg-glass font-sans"
                            )}
                          >
                            <Circle className="h-3 w-3" fill="currentColor" />
                            {config.label}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="px-2 pb-1.5">
                    <div className={cn(
                      "text-xs font-semibold uppercase tracking-wider mb-1.5",
                      "text-tertiary font-sans"
                    )}>
                      Estado del pago
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {(Object.keys(PAYMENT_STATUS_CONFIG) as PaymentStatus[]).map((payment) => {
                        if (!onPaymentStatusChange) return null;
                        const current = currentPaymentStatus ?? "unpaid";
                        if (payment === current) return null;
                        const config = PAYMENT_STATUS_CONFIG[payment];
                        return (
                          <motion.button
                            key={payment}
                            whileHover={{ x: 2, backgroundColor: theme.colors.bgGlass }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              onPaymentStatusChange(payment);
                              onClose();
                            }}
                            className={cn(
                              "w-full flex items-center justify-start gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150",
                              "text-primary hover:bg-glass font-sans"
                            )}
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
                whileHover={{ x: 2, backgroundColor: theme.colors.bgGlass }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  onSendMessage();
                  onClose();
                }}
                className={cn(
                  "w-full flex items-center justify-start gap-3 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-150",
                  "text-primary hover:bg-glass font-sans"
                )}
              >
                <MessageSquare className="h-4 w-4 text-accent-aqua" />
                Enviar mensaje
              </motion.button>
              {canCancel && (
                <>
                  <div className={cn("border-t my-1", "border-border-default")} />
                  <motion.button
                    whileHover={{ x: 2, backgroundColor: theme.colors.bgGlass }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      onCancel();
                      onClose();
                    }}
                    className={cn(
                      "w-full flex items-center justify-start gap-3 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-150",
                      "text-status-cancelled hover:bg-glass font-sans"
                    )}
                  >
                    <X className="h-4 w-4" />
                    Cancelar cita
                  </motion.button>
                </>
              )}
            </div>
          </GlassCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";
import { MiniBookingCard } from "./MiniBookingCard";
import { Booking } from "@/types/agenda";

interface DraggableBookingCardProps {
  booking: any; // Usando el adaptador MiniBookingCardData
  position: { top: string; height: string };
  density: "default" | "compact" | "ultra-compact";
  onDragStart?: (bookingId: string) => void;
  onDragEnd?: (bookingId: string, newTime: string, newStaffId?: string) => void;
  onResizeStart?: (bookingId: string) => void;
  onResizeEnd?: (bookingId: string, newEndTime: string) => void;
  onClick?: () => void;
  conflictDetected?: boolean;
  snapToGrid?: boolean;
  dragConstraints?: {
    top: number;
    bottom: number;
    left?: number;
    right?: number;
  };
}

/**
 * DraggableBookingCard - Booking premium con drag & drop y resize
 * Características premium:
 * - Drag & drop suave con constraints
 * - Resize inteligente con snap to grid
 * - Conflict detection visual
 * - Preview states durante operaciones
 * - Animaciones premium con spring physics
 */
export function DraggableBookingCard({
  booking,
  position,
  density,
  onDragStart,
  onDragEnd,
  onResizeStart,
  onResizeEnd,
  onClick,
  conflictDetected = false,
  snapToGrid = true,
  dragConstraints,
}: DraggableBookingCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Calcular snap points para grid
  const snapPoints = useMemo(() => {
    if (!snapToGrid) return { x: 1, y: 1 };
    // Snap a cada 15 minutos (ajustable según densidad)
    const snapInterval = density === "ultra-compact" ? 30 : density === "compact" ? 45 : 60;
    return {
      x: 1, // No snap horizontal por ahora
      y: snapInterval, // Snap vertical cada X minutos
    };
  }, [density, snapToGrid]);

  // Calcular nueva posición durante drag
  const calculateNewPosition = useCallback((info: PanInfo) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return { time: booking.starts_at, staffId: booking.staff?.id };

    // Calcular nueva hora basada en posición Y
    const hourHeight = parseFloat(position.height) / (density === "ultra-compact" ? 0.5 : density === "compact" ? 0.75 : 1);
    const minutesPerPixel = 60 / hourHeight; // minutos por pixel
    const deltaY = info.offset.y;
    const deltaMinutes = deltaY * minutesPerPixel;

    // Calcular nueva hora de inicio
    const currentStart = new Date(booking.starts_at);
    const newStart = new Date(currentStart.getTime() + deltaMinutes * 60000);

    // Snap to grid si está habilitado
    if (snapToGrid) {
      const minutes = newStart.getMinutes();
      const snappedMinutes = Math.round(minutes / 15) * 15; // Snap a cada 15 minutos
      newStart.setMinutes(snappedMinutes);
    }

    return {
      time: newStart.toISOString(),
      staffId: booking.staff?.id // Por ahora no cambiamos staff
    };
  }, [booking, position.height, density, snapToGrid]);

  // Handlers para drag
  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    onDragStart?.(booking.id);
  }, [booking.id, onDragStart]);

  const handleDragEnd = useCallback((event: any, info: PanInfo) => {
    setIsDragging(false);
    const newPosition = calculateNewPosition(info);
    onDragEnd?.(booking.id, newPosition.time, newPosition.staffId);
    setDragOffset({ x: 0, y: 0 });
  }, [booking.id, calculateNewPosition, onDragEnd]);

  const handleDrag = useCallback((event: any, info: PanInfo) => {
    setDragOffset({ x: info.offset.x, y: info.offset.y });
  }, []);

  // Estados visuales premium
  const cardVariants = {
    idle: {
      scale: 1,
      opacity: 1,
      boxShadow: "var(--shadow-premium)",
    },
    dragging: {
      scale: 1.05,
      opacity: 0.9,
      boxShadow: "0px 20px 40px -10px rgba(58, 109, 255, 0.3), 0px 10px 20px -5px rgba(79, 227, 193, 0.2)",
      zIndex: 50,
    },
    conflict: {
      scale: 1,
      opacity: 0.8,
      boxShadow: "0px 0px 20px rgba(239, 68, 68, 0.4)",
      border: "2px solid var(--status-cancelled)",
    },
    resizing: {
      scale: 1.02,
      opacity: 0.95,
      boxShadow: "0px 15px 30px -10px rgba(255, 193, 7, 0.3)",
    }
  };

  const currentVariant = useMemo(() => {
    if (conflictDetected) return "conflict";
    if (isResizing) return "resizing";
    if (isDragging) return "dragging";
    return "idle";
  }, [conflictDetected, isResizing, isDragging]);

  return (
    <motion.div
      ref={cardRef}
      style={{
        position: 'absolute',
        top: position.top,
        left: 8,
        right: 8,
        height: position.height,
        zIndex: isDragging ? 50 : 10,
      }}
      variants={cardVariants}
      animate={currentVariant}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 25,
        mass: 0.8
      }}
      drag
      dragConstraints={dragConstraints}
      dragElastic={0.1}
      dragMomentum={false}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      whileHover={{
        scale: conflictDetected ? 1 : 1.02,
        transition: { duration: 0.2 }
      }}
      className="group relative"
    >
      {/* Overlay de conflicto */}
      <AnimatePresence>
        {conflictDetected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[var(--status-cancelled)]/10 rounded-[var(--radius-lg)] border-2 border-[var(--status-cancelled)]/50 pointer-events-none z-10"
          >
            <div className="absolute top-1 right-1 w-2 h-2 bg-[var(--status-cancelled)] rounded-full animate-pulse" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card principal */}
      <div
        className={cn(
          "h-full cursor-move select-none",
          isDragging && "cursor-grabbing"
        )}
        style={{
          transform: isDragging ? `translate(${dragOffset.x}px, ${dragOffset.y}px)` : undefined,
        }}
      >
        <MiniBookingCard
          booking={booking}
          density={density}
          onClick={onClick}
          className={cn(
            "h-full transition-all duration-200",
            conflictDetected && "ring-2 ring-[var(--status-cancelled)]/30"
          )}
        />
      </div>

      {/* Indicadores de drag premium */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute -top-2 -right-2 w-6 h-6 bg-[var(--accent-blue)] rounded-full flex items-center justify-center shadow-lg"
          >
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-3 h-3 border-2 border-white border-t-transparent rounded-full"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Handle de resize (bottom-right) */}
      {!isDragging && !conflictDetected && (
        <motion.div
          className="absolute bottom-1 right-1 w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
          onMouseDown={() => setIsResizing(true)}
          onMouseUp={() => setIsResizing(false)}
        >
          <div className="w-full h-full bg-[var(--accent-aqua)]/20 rounded-full border border-[var(--accent-aqua)]/40 flex items-center justify-center">
            <div className="w-2 h-2 border-r border-b border-[var(--accent-aqua)] rotate-45" />
          </div>
        </motion.div>
      )}

      {/* Tooltip de ayuda durante drag */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[var(--radius-lg)] px-3 py-2 shadow-lg whitespace-nowrap z-50"
          >
            <div className="text-xs text-[var(--text-primary)] font-medium">
              {conflictDetected ? "⚠️ Conflicto detectado" : "Suelta para confirmar"}
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[var(--bg-primary)]" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

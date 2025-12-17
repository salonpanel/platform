"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Booking } from "@/types/agenda";

interface ConflictZoneProps {
  bookings: Booking[];
  currentBooking?: Booking;
  tenantTimezone: string;
  className?: string;
}

/**
 * ConflictZone - Detector visual de conflictos premium
 * Muestra zonas de conflicto y sugerencias inteligentes
 */
export function ConflictZone({
  bookings,
  currentBooking,
  tenantTimezone,
  className
}: ConflictZoneProps) {

  // Detectar conflictos entre bookings
  const conflicts = useMemo(() => {
    const conflictList: Array<{
      booking1: Booking;
      booking2: Booking;
      overlapMinutes: number;
      severity: 'low' | 'medium' | 'high';
    }> = [];

    for (let i = 0; i < bookings.length; i++) {
      for (let j = i + 1; j < bookings.length; j++) {
        const booking1 = bookings[i];
        const booking2 = bookings[j];

        // Solo verificar conflictos si son del mismo staff
        if (booking1.staff_id !== booking2.staff_id) continue;

        const start1 = new Date(booking1.starts_at);
        const end1 = new Date(booking1.ends_at);
        const start2 = new Date(booking2.starts_at);
        const end2 = new Date(booking2.ends_at);

        // Verificar overlap
        if (start1 < end2 && start2 < end1) {
          const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
          const overlapEnd = new Date(Math.min(end1.getTime(), end2.getTime()));
          const overlapMinutes = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60));

          const severity = overlapMinutes > 30 ? 'high' : overlapMinutes > 15 ? 'medium' : 'low';

          conflictList.push({
            booking1,
            booking2,
            overlapMinutes,
            severity
          });
        }
      }
    }

    return conflictList;
  }, [bookings]);

  // Estilos por severidad
  const getConflictStyle = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'high':
        return 'bg-[var(--status-cancelled)]/15 border-[var(--status-cancelled)]/30';
      case 'medium':
        return 'bg-[var(--status-pending)]/15 border-[var(--status-pending)]/30';
      case 'low':
        return 'bg-[var(--accent-aqua)]/10 border-[var(--accent-aqua)]/20';
    }
  };

  if (conflicts.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <div className="w-2 h-2 bg-[var(--status-cancelled)] rounded-full animate-pulse" />
        <span className="font-medium">Conflictos detectados</span>
        <span className="text-xs bg-[var(--glass-bg)] px-2 py-0.5 rounded-full">
          {conflicts.length} conflicto{conflicts.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {conflicts.map((conflict, index) => (
            <motion.div
              key={`${conflict.booking1.id}-${conflict.booking2.id}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "p-3 rounded-[var(--radius-lg)] border backdrop-blur-sm",
                getConflictStyle(conflict.severity)
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                      {conflict.severity === 'high' ? 'Alto' : conflict.severity === 'medium' ? 'Medio' : 'Bajo'}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {conflict.overlapMinutes}min overlap
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-[var(--accent-blue)] rounded-full flex-shrink-0" />
                      <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {conflict.booking1.customer?.name || 'Cliente 1'}
                      </span>
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {conflict.booking1.service?.name || 'Servicio'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-[var(--accent-aqua)] rounded-full flex-shrink-0" />
                      <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {conflict.booking2.customer?.name || 'Cliente 2'}
                      </span>
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {conflict.booking2.service?.name || 'Servicio'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Acciones rápidas */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-3 py-1 text-xs bg-[var(--glass-bg)] hover:bg-[var(--glass-bg-subtle)] border border-[var(--glass-border)] rounded-[var(--radius-md)] transition-colors"
                  >
                    Resolver
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-3 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    Ver detalles
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Sugerencias inteligentes */}
      {conflicts.some(c => c.severity === 'high') && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-gradient-to-r from-[var(--accent-blue)]/10 to-[var(--accent-aqua)]/10 border border-[var(--accent-aqua)]/20 rounded-[var(--radius-lg)]"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-aqua)] rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm">💡</span>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                Sugerencia Inteligente
              </h4>
              <p className="text-xs text-[var(--text-secondary)]">
                Considera mover una de las citas conflictivas o asignar a otro staff disponible.
                El sistema puede sugerirte horarios alternativos automáticamente.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

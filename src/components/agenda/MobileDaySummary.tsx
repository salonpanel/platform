"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Booking } from "@/types/agenda";
import { AppointmentCard } from "./AppointmentCard";
import { cn } from "@/lib/utils";

interface MobileDaySummaryProps {
  bookings: Booking[];
  timezone: string;
  onBookingClick: (booking: Booking) => void;
}

/**
 * MobileDaySummary — Lista colapsable de citas del día para móvil.
 * Patrón Square: resumen visual (DayView arriba) + lista cronológica (debajo, colapsable).
 */
export function MobileDaySummary({ bookings, timezone, onBookingClick }: MobileDaySummaryProps) {
  const [expanded, setExpanded] = useState(false);

  if (bookings.length === 0) return null;

  // Sort chronologically
  const sorted = [...bookings].sort((a, b) =>
    new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );

  return (
    <div className="flex-shrink-0 border-t border-white/5 bg-[#0A0B0E]">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-[var(--bf-ink-300)] active:bg-white/5 transition-colors"
        aria-expanded={expanded}
      >
        <span className="font-semibold text-[var(--bf-ink-50)]">
          {sorted.length} {sorted.length === 1 ? "cita" : "citas"} hoy
        </span>
        <span className="flex items-center gap-1.5 text-[var(--bf-ink-400)]">
          {expanded ? "Ocultar" : "Ver lista"}
          {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </span>
      </button>

      {/* Collapsible list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div
              className="px-3 pb-4 space-y-2 max-h-[40vh] overflow-y-auto overscroll-contain"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {sorted.map((booking) => (
                <AppointmentCard
                  key={booking.id}
                  booking={booking}
                  timezone={timezone}
                  variant="list"
                  staffColor={booking.staff?.color}
                  onClick={() => onBookingClick(booking)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
       
"use client";

import { useMemo } from "react";
import { AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Booking } from "@/types/agenda";
import { cn } from "@/lib/utils";

interface NoShowAlertProps {
  bookings: Booking[];
  tenantTimezone: string;
  className?: string;
}

/**
 * NoShowAlert — Muestra alertas discretas cuando una cita pending/hold
 * lleva más de 10 minutos desde su hora de inicio sin estar confirmada.
 */
export function NoShowAlert({ bookings, tenantTimezone, className }: NoShowAlertProps) {
  const lateBookings = useMemo(() => {
    const now = new Date();
    const tenantNow = new Date(now.toLocaleString("en-US", { timeZone: tenantTimezone }));
    const nowMinutes = tenantNow.getTime();
    const LATE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

    return bookings.filter((b) => {
      if (b.status !== "pending" && b.status !== "hold") return false;
      const startTime = new Date(b.starts_at);
      return nowMinutes - startTime.getTime() > LATE_THRESHOLD_MS;
    });
  }, [bookings, tenantTimezone]);

  if (lateBookings.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className={cn("space-y-1.5", className)}
      >
        {lateBookings.map((booking) => {
          const minutesLate = Math.floor(
            (new Date().getTime() - new Date(booking.starts_at).getTime()) / 60000
          );
          return (
            <div
              key={booking.id}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs"
              style={{
                backgroundColor: "rgba(224,96,114,0.08)",
                border: "1px solid rgba(224,96,114,0.2)",
              }}
            >
              <AlertCircle size={13} style={{ color: "#E06072", flexShrink: 0 }} />
              <span style={{ color: "var(--bf-ink-300)" }}>
                <span className="font-semibold" style={{ color: "#E06072" }}>
                  {booking.customer?.name || "Cliente"}
                </span>{" "}
                · {minutesLate} min de retraso
                {booking.staff && (
                  <span className="text-[var(--bf-ink-400)]"> — {booking.staff.name}</span>
                )}
              </span>
            </div>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}

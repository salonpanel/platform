"use client";

import { format, parseISO } from "date-fns";
import { GlassBadge } from "@/components/ui/glass/GlassBadge";
import { GlassCard } from "@/components/ui/glass/GlassCard";
import { GlassEmptyState } from "@/components/ui/glass/GlassEmptyState";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, User, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

type Booking = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "hold" | "pending" | "paid" | "completed" | "cancelled" | "no_show";
  customer?: {
    name: string;
    email: string;
  };
  service?: {
    name: string;
  };
  staff?: {
    name: string;
  };
};

interface UpcomingAppointmentsProps {
  bookings: Booking[];
  limit?: number;
  timezone: string;
}

export function UpcomingAppointments({
  bookings,
  limit = 3,
  timezone,
}: UpcomingAppointmentsProps) {
  const timeFormatter = new Intl.DateTimeFormat("es-ES", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  });

  const upcoming = bookings
    .filter((b) => new Date(b.starts_at) >= new Date())
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, limit);

  // Helper to map booking status to GlassBadge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "confirmed":
      case "paid":
      case "completed":
        return "success";
      case "pending":
      case "hold":
        return "warning";
      case "cancelled":
      case "no_show":
        return "danger";
      default:
        return "default";
    }
  };

  const statusLabels: Record<string, string> = {
    confirmed: "Confirmado",
    paid: "Pagado",
    pending: "Pendiente",
    completed: "Completado",
    cancelled: "Cancelado",
    no_show: "No show",
    hold: "Reservado",
  };

  const router = useRouter();

  if (upcoming.length === 0) {
    return (
      <GlassEmptyState
        icon={Calendar}
        title="Sin reservas próximas"
        description="No tienes citas programadas para los próximos días."
        actionLabel="Ver Agenda Completa"
        onAction={() => router.push("/panel/agenda")}
        className="h-full"
      />
    );
  }

  return (
    <GlassCard className="relative p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-[var(--text-primary)] font-satoshi mb-1">
            Próximas Reservas
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">Próximas {limit} citas programadas</p>
        </div>
        <Link
          href="/panel/agenda"
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-colors duration-200 flex items-center gap-1"
        >
          Ver todas
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-2">
        {upcoming.map((booking, index) => (
          <motion.div
            key={booking.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03, duration: 0.2 }}
          >
            <Link
              href={`/panel/agenda?date=${format(parseISO(booking.starts_at), "yyyy-MM-dd")}`}
              className={cn(
                "block p-3 rounded-xl relative overflow-hidden group transition-all duration-150",
                "bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10"
              )}
            >
              <motion.div
                className="absolute inset-0 gradient-aurora-1 opacity-0 group-hover:opacity-5 transition-opacity duration-300"
              />
              <div className="flex items-start justify-between relative z-10 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-xs font-mono font-semibold text-[var(--text-primary)] font-satoshi bg-white/5 px-2 py-0.5 rounded">
                      {timeFormatter.format(new Date(booking.starts_at))}
                    </span>
                    <GlassBadge variant={getStatusVariant(booking.status)} size="sm">
                      {statusLabels[booking.status] || booking.status}
                    </GlassBadge>
                  </div>
                  <p className="text-sm font-medium text-[var(--text-primary)] font-satoshi mb-0.5 truncate">
                    {booking.customer?.name || "Sin cliente"}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {booking.service?.name || "Sin servicio"}
                  </p>
                  {booking.staff && (
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1 flex items-center gap-1">
                      <User className="h-2.5 w-2.5" />
                      {booking.staff.name}
                    </p>
                  )}
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200 flex-shrink-0" />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </GlassCard>
  );
}

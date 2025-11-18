"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { BookingStatus, BOOKING_STATUS_CONFIG } from "@/types/agenda";

interface StatusBadgeProps {
  status: BookingStatus;
  className?: string;
  size?: "xs" | "sm" | "md";
}

// Mapeo de colores para badges (más específicos que los de la leyenda)
const statusBadgeColors: Record<BookingStatus, { color: string; bgColor: string; borderColor: string }> = {
  hold: {
    color: "text-amber-300",
    bgColor: "bg-amber-500/15",
    borderColor: "border-amber-500/30",
  },
  pending: {
    color: "text-amber-300",
    bgColor: "bg-amber-500/15",
    borderColor: "border-amber-500/30",
  },
  paid: {
    color: "text-emerald-300",
    bgColor: "bg-emerald-500/15",
    borderColor: "border-emerald-500/30",
  },
  completed: {
    color: "text-[#3A6DFF]",
    bgColor: "bg-[#3A6DFF]/15",
    borderColor: "border-[#3A6DFF]/30",
  },
  cancelled: {
    color: "text-stone-300",
    bgColor: "bg-stone-500/15",
    borderColor: "border-stone-500/30",
  },
  no_show: {
    color: "text-rose-300",
    bgColor: "bg-rose-500/15",
    borderColor: "border-rose-500/30",
  },
};

export function StatusBadge({ status, className, size = "md" }: StatusBadgeProps) {
  const sizeClasses = {
    xs: "text-[10px] px-1.5 py-0.5",
    sm: "text-[11px] px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
  };
  const config = BOOKING_STATUS_CONFIG[status];
  const colors = statusBadgeColors[status];

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      className={cn(
        "inline-flex items-center rounded-[8px] font-semibold font-['Plus_Jakarta_Sans'] border backdrop-blur-sm",
        sizeClasses[size],
        colors.color,
        colors.bgColor,
        colors.borderColor,
        className
      )}
    >
      {config.label}
    </motion.span>
  );
}


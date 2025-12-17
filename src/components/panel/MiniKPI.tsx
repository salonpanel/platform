"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MiniKPIProps {
  title: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: ReactNode | string;
  onClick?: () => void;
}

export function MiniKPI({
  title,
  value,
  trend,
  trendValue,
  icon,
  onClick,
}: MiniKPIProps) {
  const trendBadgeStyles = {
    up: "bg-emerald-500/10 text-emerald-300",
    down: "bg-red-500/10 text-red-300",
    neutral: "bg-white/5 text-[var(--text-secondary)]",
  };

  const trendSymbols = {
    up: "▲",
    down: "▼",
    neutral: "•",
  };

  const content = (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
      <div className="flex-1">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-secondary)] font-satoshi mb-2">
          {title}
        </p>
        <motion.p
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
          className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] font-satoshi tracking-tight mb-1"
        >
          {value}
        </motion.p>
        {trend && trendValue && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium mt-1",
              trendBadgeStyles[trend]
            )}
          >
            <span>{trendSymbols[trend]}</span>
            {trendValue}
          </span>
        )}
      </div>
      {icon && (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 flex-shrink-0">
          {typeof icon === "string" ? (
            <span className="text-lg">{icon}</span>
          ) : (
            icon
          )}
        </div>
      )}
    </div>
  );

  const Component = onClick ? motion.button : motion.div;

  return (
    <Component
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      whileHover={onClick ? { y: -1 } : {}}
      whileTap={onClick ? { scale: 0.98 } : {}}
      className={cn(
        "w-full text-left relative overflow-hidden rounded-2xl border border-white/5",
        "bg-[rgba(15,23,42,0.85)] backdrop-blur-xl",
        "shadow-[0_18px_45px_rgba(0,0,0,0.45)]",
        "px-4 py-3 sm:px-5 sm:py-4",
        "transition-transform transition-shadow duration-150 ease-out",
        "hover:-translate-y-[1px] hover:shadow-[0_22px_55px_rgba(0,0,0,0.6)]",
        onClick && "cursor-pointer group"
      )}
    >
      {onClick && (
        <motion.div className="absolute inset-0 gradient-aurora-1 opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
      )}
      <div className="relative z-10">{content}</div>
    </Component>
  );
}

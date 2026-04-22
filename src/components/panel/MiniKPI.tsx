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
    up:      "bg-[rgba(30,161,159,0.12)] text-[var(--bf-teal-200)]",
    down:    "bg-[rgba(224,96,114,0.10)] text-[#F2A0AC]",
    neutral: "bg-[var(--bf-bg-elev)] text-[var(--bf-ink-400)]",
  };

  const trendSymbols = {
    up: "▲",
    down: "▼",
    neutral: "•",
  };

  const content = (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
      <div className="flex-1">
        <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--bf-ink-400)] mb-2" style={{ fontFamily: "var(--font-mono)" }}>
          {title}
        </p>
        <motion.p
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
          className="text-2xl sm:text-3xl font-semibold text-[var(--bf-ink-50)] tracking-tight mb-1"
          style={{ fontFamily: "var(--font-sans)", letterSpacing: "-0.025em" }}
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
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(79,161,216,0.12)] border border-[rgba(79,161,216,0.25)] flex-shrink-0">
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
        "w-full text-left relative overflow-hidden rounded-[var(--r-xl)] border border-[var(--bf-border)]",
        "bg-[var(--bf-surface)]",
        "shadow-[var(--bf-shadow-card)]",
        "px-4 py-3 sm:px-5 sm:py-4",
        "transition-transform transition-shadow duration-150 ease-out",
        "hover:-translate-y-[1px] hover:border-[var(--bf-border-2)]",
        onClick && "cursor-pointer group"
      )}
    >
      {onClick && (
        <div className="absolute inset-0 bg-[rgba(79,161,216,0.03)] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
      )}
      <div className="relative z-10">{content}</div>
    </Component>
  );
}

"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

export interface KPICardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  variant?: "default" | "aurora";
  className?: string;
  onClick?: () => void;
  density?: "default" | "compact" | "ultra-compact";
}

export function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  variant = "default",
  className,
  onClick,
  density = "default",
}: KPICardProps) {
  const paddingStyles = {
    default: "p-4",
    compact: "p-3",
    "ultra-compact": "p-2",
  };

  const titleStyles = {
    default: "text-sm mb-2",
    compact: "text-xs mb-1.5",
    "ultra-compact": "text-[10px] mb-1",
  };

  const valueStyles = {
    default: "text-2xl",
    compact: "text-xl",
    "ultra-compact": "text-lg",
  };
  const content = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      whileHover={onClick ? { scale: 1.02 } : {}}
      className={cn(
        "rounded-[var(--radius-lg)] border transition-all h-full",
        paddingStyles[density],
        variant === "aurora"
          ? "bg-[var(--gradient-primary)] border-transparent"
          : density === "ultra-compact" 
          ? "glass border-[var(--glass-border)] backdrop-blur-sm"
          : "glass border-[var(--glass-border)]",
        onClick && "cursor-pointer",
        className
      )}
      style={{
        boxShadow:
          variant === "aurora"
            ? "var(--glow-aqua), inset 0px 1px 0px rgba(255,255,255,0.15)"
            : "var(--shadow-card)",
        transitionDuration: "var(--duration-base)",
      }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p
            className={cn("font-semibold", titleStyles[density])}
            style={{
              fontFamily: "var(--font-heading)",
              color: variant === "aurora" ? "rgba(255,255,255,0.9)" : "var(--text-secondary)",
            }}
          >
            {title}
          </p>
          <p
            className={cn("font-semibold", valueStyles[density])}
            style={{
              fontFamily: "var(--font-kpi)",
              color: variant === "aurora" ? "#FFFFFF" : "var(--text-primary)",
            }}
          >
            {value}
          </p>
          {trend && (
            <div className="mt-3 flex items-center gap-2">
              <span
                className={cn(
                  "text-xs font-semibold",
                  trend.positive !== false
                    ? "text-[var(--color-success)]"
                    : "text-[var(--color-danger)]"
                )}
                style={{ fontFamily: "var(--font-body)" }}
              >
                {trend.positive !== false ? "↑" : "↓"} {Math.abs(trend.value)}%
              </span>
              <span
                className="text-xs"
                style={{
                  fontFamily: "var(--font-body)",
                  color: variant === "aurora" ? "rgba(255,255,255,0.7)" : "var(--text-tertiary)",
                }}
              >
                {trend.label}
              </span>
            </div>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "rounded-[var(--radius-md)] p-3",
              variant === "aurora"
                ? "bg-white/20"
                : "bg-[var(--accent-aqua-glass)] border border-[var(--accent-aqua-border)]"
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5",
                variant === "aurora" ? "text-white" : "text-[var(--accent-aqua)]"
              )}
            />
          </div>
        )}
      </div>
    </motion.div>
  );

  return content;
}


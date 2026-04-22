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
        "rounded-[var(--r-lg)] border transition-all h-full",
        paddingStyles[density],
        variant === "aurora"
          ? "bg-[var(--bf-primary)] border-transparent"
          : "bg-[var(--bf-surface)] border-[var(--bf-border)]",
        onClick && "cursor-pointer",
        className
      )}
      style={{
        boxShadow:
          variant === "aurora"
            ? "var(--bf-shadow-glow), inset 0 1px 0 rgba(255,255,255,0.12)"
            : "var(--bf-shadow-card)",
        transitionDuration: "var(--duration-base)",
      }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p
            className={cn("font-semibold", titleStyles[density])}
            style={{
              fontFamily: "var(--font-mono)",
              color: variant === "aurora" ? "var(--bf-ink)" : "var(--bf-ink-400)",
              fontSize: "10px",
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
            }}
          >
            {title}
          </p>
          <p
            className={cn("font-semibold", valueStyles[density])}
            style={{
              fontFamily: "var(--font-sans)",
              color: variant === "aurora" ? "var(--bf-ink)" : "var(--bf-ink-50)",
              letterSpacing: "-0.025em",
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
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {trend.positive !== false ? "↑" : "↓"} {Math.abs(trend.value)}%
              </span>
              <span
                className="text-xs"
                style={{
                  fontFamily: "var(--font-sans)",
                  color: variant === "aurora" ? "var(--bf-ink)" : "var(--bf-ink-400)",
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
              "rounded-[var(--r-md)] p-3",
              variant === "aurora"
                ? "bg-[rgba(255,255,255,0.2)]"
                : "bg-[rgba(79,161,216,0.12)] border border-[rgba(79,161,216,0.35)]"
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5",
                variant === "aurora" ? "text-[var(--bf-ink)]" : "text-[var(--bf-primary)]"
              )}
            />
          </div>
        )}
      </div>
    </motion.div>
  );

  return content;
}


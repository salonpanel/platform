"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

export interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  variant?: "default" | "glass";
  className?: string;
  density?: "default" | "compact" | "ultra-compact";
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  action,
  variant = "default",
  className,
  density = "default",
}: StatCardProps) {
  const paddingStyles = {
    default: "p-6",
    compact: "p-4",
    "ultra-compact": "p-3",
  };

  const titleStyles = {
    default: "text-[10px] mb-2 tracking-[0.08em] uppercase",
    compact: "text-[10px] mb-1.5 tracking-[0.08em] uppercase",
    "ultra-compact": "text-[9px] mb-1 tracking-[0.08em] uppercase",
  };

  const valueStyles = {
    default: "text-4xl",
    compact: "text-3xl",
    "ultra-compact": "text-2xl",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className={cn(
        "rounded-[var(--r-lg)] border transition-all",
        paddingStyles[density],
        variant === "glass"
          ? "bg-[var(--bf-bg-elev)]/80 backdrop-blur-md border-[var(--bf-border-2)]"
          : "bg-[var(--bf-surface)] border-[var(--bf-border)]",
        className
      )}
      style={{
        boxShadow: "var(--bf-shadow-card)",
        transitionDuration: "var(--duration-base)",
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p
            className={cn("font-semibold", titleStyles[density])}
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--bf-ink-400)",
            }}
          >
            {title}
          </p>
          <p
            className={cn("font-semibold", valueStyles[density])}
            style={{
              fontFamily: "var(--font-sans)",
              color: "var(--bf-ink-50)",
              letterSpacing: "-0.025em",
            }}
          >
            {value}
          </p>
          {description && (
            <p
              className="mt-2 text-xs"
              style={{
                fontFamily: "var(--font-sans)",
                color: "var(--bf-ink-400)",
              }}
            >
              {description}
            </p>
          )}
          {action && (
            <div className="mt-4">
              {action.href ? (
                <a
                  href={action.href}
                  className="text-sm font-medium text-[var(--bf-primary)] hover:text-[var(--bf-cyan-300)] transition-colors"
                  style={{
                    fontFamily: "var(--font-sans)",
                    transitionDuration: "var(--duration-base)",
                  }}
                >
                  {action.label} →
                </a>
              ) : (
                <button
                  onClick={action.onClick}
                  className="text-sm font-medium text-[var(--bf-primary)] hover:text-[var(--bf-cyan-300)] transition-colors"
                  style={{
                    fontFamily: "var(--font-sans)",
                    transitionDuration: "var(--duration-base)",
                  }}
                >
                  {action.label} →
                </button>
              )}
            </div>
          )}
        </div>
        {Icon && (
          <div className="rounded-[var(--r-md)] bg-[rgba(79,161,216,0.12)] border border-[rgba(79,161,216,0.35)] p-3">
            <Icon className="h-5 w-5 text-[var(--bf-primary)]" />
          </div>
        )}
      </div>
    </motion.div>
  );
}


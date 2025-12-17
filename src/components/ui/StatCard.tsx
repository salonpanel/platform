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
    default: "text-sm mb-1",
    compact: "text-xs mb-0.5",
    "ultra-compact": "text-[10px] mb-0.5",
  };

  const valueStyles = {
    default: "text-2xl",
    compact: "text-xl",
    "ultra-compact": "text-lg",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className={cn(
        "rounded-[var(--radius-lg)] border transition-all",
        paddingStyles[density],
        variant === "glass"
          ? density === "ultra-compact"
            ? "glass border-[var(--glass-border)] backdrop-blur-sm"
            : "glass border-[var(--glass-border)]"
          : "bg-[var(--bg-card)] border-[var(--glass-border)] backdrop-blur-sm",
        className
      )}
      style={{
        boxShadow: "var(--shadow-card)",
        transitionDuration: "var(--duration-base)",
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p
            className={cn("font-semibold", titleStyles[density])}
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--text-secondary)",
            }}
          >
            {title}
          </p>
          <p
            className={cn("font-semibold", valueStyles[density])}
            style={{
              fontFamily: "var(--font-kpi)",
              color: "var(--text-primary)",
            }}
          >
            {value}
          </p>
          {description && (
            <p
              className="mt-2 text-xs"
              style={{
                fontFamily: "var(--font-body)",
                color: "var(--text-tertiary)",
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
                  className="text-sm font-medium text-[var(--accent-aqua)] hover:text-[var(--accent-aqua)]/80 transition-colors"
                  style={{
                    fontFamily: "var(--font-body)",
                    transitionDuration: "var(--duration-base)",
                  }}
                >
                  {action.label} →
                </a>
              ) : (
                <button
                  onClick={action.onClick}
                  className="text-sm font-medium text-[var(--accent-aqua)] hover:text-[var(--accent-aqua)]/80 transition-colors"
                  style={{
                    fontFamily: "var(--font-body)",
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
          <div className="rounded-[var(--radius-md)] bg-[var(--accent-aqua-glass)] border border-[var(--accent-aqua-border)] p-3">
            <Icon className="h-5 w-5 text-[var(--accent-aqua)]" />
          </div>
        )}
      </div>
    </motion.div>
  );
}


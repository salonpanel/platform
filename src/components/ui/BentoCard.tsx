"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

export interface BentoCardProps {
  children: ReactNode;
  priority?: "high" | "medium" | "low";
  density?: "default" | "compact" | "ultra-compact";
  icon?: LucideIcon;
  title?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * Componente BentoCard para diseño tipo "Bento grid"
 * Variantes visuales según importancia del contenido
 */
export function BentoCard({
  children,
  priority = "medium",
  density = "default",
  icon: Icon,
  title,
  className,
  onClick,
}: BentoCardProps) {
  const paddingClass = density === "ultra-compact" ? "p-3" : density === "compact" ? "p-4" : "p-6";
  const titleSize = density === "ultra-compact" ? "text-xs" : density === "compact" ? "text-sm" : "text-base";

  // Variantes visuales según prioridad
  const variantStyles = {
    high: {
      container: "bg-[var(--bf-primary)] border-transparent",
      shadow: "var(--bf-shadow-glow), inset 0 1px 0 rgba(255,255,255,0.12)",
      icon: "text-[var(--bf-ink)]",
    },
    medium: {
      container: "bg-[var(--bf-surface)] border-[var(--bf-border)]",
      shadow: "var(--bf-shadow-card)",
      icon: "text-[var(--bf-primary)]",
    },
    low: {
      container: "bg-[var(--bf-bg-elev)] border-[var(--bf-border)]",
      shadow: "var(--bf-shadow-card)",
      icon: "text-[var(--bf-ink-400)]",
    },
  };

  const styles = variantStyles[priority];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={onClick ? { scale: 1.02, y: -2 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      onClick={onClick}
      className={cn(
        "rounded-[var(--r-xl)] border transition-all duration-300",
        styles.container,
        paddingClass,
        onClick && "cursor-pointer",
        className
      )}
      style={{
        boxShadow: styles.shadow,
      }}
    >
      {(Icon || title) && (
        <div className="flex items-center gap-2 mb-3">
          {Icon && (
            <div
              className={cn(
                "p-2 rounded-[var(--r-md)]",
                priority === "high" ? "bg-[rgba(255,255,255,0.15)]" : "bg-[rgba(79,161,216,0.12)] border border-[rgba(79,161,216,0.35)]"
              )}
            >
              <Icon className={cn("h-4 w-4", styles.icon)} />
            </div>
          )}
          {title && (
            <h3
              className={cn(
                "font-semibold",
                titleSize,
                priority === "high" ? "text-[var(--bf-ink)]" : "text-[var(--bf-ink-50)]"
              )}
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {title}
            </h3>
          )}
        </div>
      )}
      <div className={cn(priority === "high" && "text-[var(--bf-ink)]")}>{children}</div>
    </motion.div>
  );
}


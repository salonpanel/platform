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
      container: "bg-[var(--gradient-primary)] border-transparent",
      shadow: "var(--glow-aqua), inset 0px 1px 0px rgba(255,255,255,0.15)",
      icon: "text-white",
    },
    medium: {
      container: "glass border-[var(--glass-border)]",
      shadow: "var(--shadow-card)",
      icon: "text-[var(--accent-aqua)]",
    },
    low: {
      container: "bg-[var(--bg-card)] border-[var(--glass-border)] backdrop-blur-sm",
      shadow: "var(--shadow-card-subtle)",
      icon: "text-[var(--text-secondary)]",
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
        "rounded-[var(--radius-xl)] border transition-all duration-300",
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
                "p-2 rounded-[var(--radius-md)]",
                priority === "high" ? "bg-white/10" : "bg-[var(--accent-aqua-glass)] border border-[var(--accent-aqua-border)]"
              )}
            >
              <Icon className={cn("h-4 w-4", styles.icon)} />
            </div>
          )}
          {title && (
            <h3
              className={cn(
                "font-semibold font-satoshi",
                titleSize,
                priority === "high" ? "text-white" : "text-[var(--text-primary)]"
              )}
              style={{
                fontFamily: "var(--font-heading)",
              }}
            >
              {title}
            </h3>
          )}
        </div>
      )}
      <div className={cn(priority === "high" && "text-white/90")}>{children}</div>
    </motion.div>
  );
}


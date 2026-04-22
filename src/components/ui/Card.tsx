"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg" | "none" | "compact" | "ultra-compact" | "mini";
  onClick?: () => void;
  variant?: "default" | "aurora" | "glass";
  hover?: boolean;
  radius?: "sm" | "md" | "lg" | "xl"; // Capsule radius options
  density?: "default" | "compact" | "ultra-compact";
}

export function Card({ 
  children, 
  className, 
  padding = "md",
  onClick,
  variant = "default",
  hover = true,
  radius = "lg",
  density = "default",
}: CardProps) {
  // Si density está definido, sobreescribe padding
  const effectivePadding = density === "ultra-compact" 
    ? "ultra-compact" 
    : density === "compact" 
    ? "compact" 
    : padding;

  const paddingStyles = {
    none: "",
    mini: "p-1.5",
    "ultra-compact": "p-2",
    compact: "p-3",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  const radiusStyles = {
    sm: "rounded-[var(--r-md)]",
    md: "rounded-[var(--r-lg)]",
    lg: "rounded-[var(--r-lg)]",
    xl: "rounded-[var(--r-xl)]",
  };

  /**
   * Variantes de Card:
   * - default: Surface sólida suave (menos transparencia, menos blur) - Para contenido general, formularios
   * - glass: Versión más "cristal" (más transparencia/blur) - Para overlays, modales, elementos flotantes
   * - aurora: Gradiente protagonista - Para hero sections, KPIs destacados, elementos premium
   */
  const variantStyles = {
    default: "bg-[var(--bf-surface)] border-[var(--bf-border)]",
    glass: "bg-[var(--bf-bg-elev)]/80 backdrop-blur-md border-[var(--bf-border-2)]",
    aurora: "bg-[var(--gradient-primary)] border-transparent",
  };

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
      whileHover={hover && onClick ? { 
        scale: 1.01,
      } : {}}
      className={cn(
        "border transition-all",
        variantStyles[variant],
        paddingStyles[effectivePadding],
        radiusStyles[radius],
        onClick && "cursor-pointer",
        !onClick && hover && "hover:shadow-[var(--shadow-card-hover)] hover:border-[var(--bf-border-2)]",
        className
      )}
      style={{
        boxShadow:
          variant === "aurora"
            ? "var(--bf-shadow-glow), inset 0 1px 0 rgba(255,255,255,0.08)"
            : "var(--bf-shadow-card)",
        transitionDuration: "var(--duration-base)",
      }}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );

  return content;
}

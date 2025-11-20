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
    sm: "rounded-[var(--radius-md)]",
    md: "rounded-[var(--radius-lg)]",
    lg: "rounded-[var(--radius-lg)]",
    xl: "rounded-[var(--radius-xl)]",
  };

  /**
   * Variantes de Card:
   * - default: Surface sólida suave (menos transparencia, menos blur) - Para contenido general, formularios
   * - glass: Versión más "cristal" (más transparencia/blur) - Para overlays, modales, elementos flotantes
   * - aurora: Gradiente protagonista - Para hero sections, KPIs destacados, elementos premium
   */
  const variantStyles = {
    default: "bg-[var(--bg-card)] border-[var(--glass-border)] backdrop-blur-sm",
    glass: "glass border-[var(--glass-border)]",
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
        !onClick && hover && "hover:shadow-[var(--shadow-card-hover)] hover:border-[var(--glass-border-strong)]",
        className
      )}
      style={{
        boxShadow: variant === "aurora" 
          ? "var(--glow-aqua), inset 0px 1px 0px rgba(255,255,255,0.15)" 
          : variant === "glass"
          ? "var(--shadow-card)"
          : "var(--shadow-card)",
        transitionDuration: "var(--duration-base)",
      }}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );

  return content;
}

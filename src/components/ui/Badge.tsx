"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "glowing" | "aqua" | "purple" | "blue" | "pink";
  size?: "sm" | "md" | "lg";
  className?: string;
  shape?: "default" | "pill"; // Capsule shape option
  density?: "default" | "compact" | "ultra-compact";
}

const variantStyles = {
  default: "glass border-[var(--glass-border)] text-[var(--text-primary)]",
  success: "bg-[var(--color-success-glass)] border-[var(--color-success)]/30 text-[var(--color-success)] backdrop-blur-sm",
  warning: "bg-[var(--color-warning-glass)] border-[var(--color-warning)]/30 text-[var(--color-warning)] backdrop-blur-sm",
  danger: "bg-[var(--color-danger-glass)] border-[var(--color-danger)]/30 text-[var(--color-danger)] backdrop-blur-sm",
  info: "bg-[var(--color-info-glass)] border-[var(--color-info)]/30 text-[var(--color-info)] backdrop-blur-sm",
  aqua: "bg-[var(--accent-aqua-glass)] border-[var(--accent-aqua-border)] text-[var(--accent-aqua)] backdrop-blur-sm",
  purple: "bg-[var(--accent-purple-glass)] border-[var(--accent-purple-border)] text-[var(--accent-purple)] backdrop-blur-sm",
  blue: "bg-[var(--accent-blue-glass)] border-[var(--accent-blue-border)] text-[var(--accent-blue)] backdrop-blur-sm",
  pink: "bg-[var(--accent-pink-glass)] border-[var(--accent-pink-border)] text-[var(--accent-pink)] backdrop-blur-sm",
  glowing: "bg-[var(--gradient-primary)] border-transparent text-white shadow-[var(--glow-aqua)] backdrop-blur-sm",
};

const sizeStyles = {
  sm: "text-xs px-2 py-0.5",
  md: "text-xs px-2.5 py-1",
  lg: "text-sm px-3 py-1.5",
};

const densityStyles = {
  default: "",
  compact: "text-xs px-1.5 py-0.5",
  "ultra-compact": "text-[10px] px-1 py-0.5",
};

export function Badge({
  children,
  variant = "default",
  size = "md",
  shape = "pill", // Default to pill for capsule shape
  className,
  density = "default",
}: BadgeProps) {
  const effectiveSize = density === "ultra-compact" 
    ? "ultra-compact" 
    : density === "compact" 
    ? "compact" 
    : size;
  const radiusClass = shape === "pill" ? "rounded-[var(--radius-pill)]" : "rounded-[var(--radius-sm)]";
  
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "inline-flex items-center font-semibold border",
        variantStyles[variant],
        density !== "default" ? densityStyles[density] : sizeStyles[size],
        density === "ultra-compact" ? "backdrop-blur-sm" : "backdrop-blur-sm",
        radiusClass,
        className
      )}
      style={{
        fontFamily: "var(--font-body)",
      }}
    >
      {children}
    </motion.span>
  );
}


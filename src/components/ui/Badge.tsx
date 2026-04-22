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
  default: "bg-[var(--bf-bg-elev)] border-[var(--bf-border)] text-[var(--bf-ink-200)]",
  success: "bg-[rgba(30,161,159,0.12)] border-[rgba(30,161,159,0.35)] text-[var(--bf-teal-200)]",
  warning: "bg-[rgba(232,176,74,0.1)] border-[rgba(232,176,74,0.3)] text-[#F2C87A]",
  danger: "bg-[rgba(224,96,114,0.1)] border-[rgba(224,96,114,0.3)] text-[#F2A0AC]",
  info: "bg-[rgba(79,161,216,0.12)] border-[rgba(79,161,216,0.35)] text-[var(--bf-cyan-200)]",
  aqua: "bg-[rgba(79,161,216,0.12)] border-[rgba(79,161,216,0.35)] text-[var(--bf-cyan-200)]",
  purple: "bg-[rgba(79,161,216,0.12)] border-[rgba(79,161,216,0.35)] text-[var(--bf-cyan-200)]",
  blue: "bg-[rgba(79,161,216,0.12)] border-[rgba(79,161,216,0.35)] text-[var(--bf-cyan-200)]",
  pink: "bg-[rgba(224,96,114,0.1)] border-[rgba(224,96,114,0.3)] text-[#F2A0AC]",
  glowing: "bg-[var(--bf-success)] border-transparent text-[var(--bf-ink)]",
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


"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "glowing";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const variantStyles = {
  default: "bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.1)] text-[var(--text-primary)] backdrop-blur-sm",
  success: "bg-[rgba(16,185,129,0.15)] border-[rgba(16,185,129,0.3)] text-[#10B981] backdrop-blur-sm",
  warning: "bg-[rgba(245,158,11,0.15)] border-[rgba(245,158,11,0.3)] text-[#F59E0B] backdrop-blur-sm",
  danger: "bg-[rgba(239,68,68,0.15)] border-[rgba(239,68,68,0.3)] text-[#EF4444] backdrop-blur-sm",
  info: "bg-[rgba(58,109,255,0.15)] border-[rgba(58,109,255,0.3)] text-[#3A6DFF] backdrop-blur-sm",
  glowing: "gradient-aurora-1 border-transparent text-white shadow-[0px_4px_16px_rgba(58,109,255,0.4)] backdrop-blur-sm",
};

const sizeStyles = {
  sm: "text-xs px-2 py-0.5",
  md: "text-xs px-2.5 py-1",
  lg: "text-sm px-3 py-1.5",
};

export function Badge({
  children,
  variant = "default",
  size = "md",
  className,
}: BadgeProps) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      className={cn(
        "inline-flex items-center rounded-lg font-semibold font-satoshi border",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      style={{
        borderRadius: "var(--radius-md)",
      }}
    >
      {children}
    </motion.span>
  );
}


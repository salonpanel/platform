"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "destructive";
  size?: "sm" | "md" | "lg";
  shape?: "default" | "pill"; // Capsule shape option
  density?: "default" | "compact";
  onClick?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  icon?: ReactNode;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  shape = "default",
  density = "default",
  onClick,
  disabled = false,
  isLoading = false,
  className,
  icon,
}: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center gap-2 font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  // Usar variables CSS para tipografía
  const fontStyle = {
    fontFamily: "var(--font-heading)",
  };

  const variants = {
    primary: "bg-[var(--gradient-primary)] text-white shadow-[var(--glow-aqua)] hover:shadow-[var(--glow-aqua),0px_0px_24px_rgba(79,227,193,0.6)] focus:ring-[var(--accent-aqua)]/30 backdrop-blur-sm",
    secondary: "glass text-[var(--text-primary)] border-[var(--glass-border)] hover:border-[var(--accent-aqua-border)] hover:bg-[var(--accent-aqua-glass)] focus:ring-[var(--accent-aqua)]/30",
    outline: "bg-transparent text-[var(--text-primary)] border-2 border-[var(--accent-aqua-border)] hover:bg-[var(--accent-aqua-glass)] hover:border-[var(--accent-aqua)] focus:ring-[var(--accent-aqua)]/30",
    ghost: "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-subtle)] focus:ring-[var(--accent-blue)]/30",
    danger: "bg-[var(--color-danger-glass)] text-[var(--color-danger)] border border-[var(--color-danger)]/30 hover:bg-[rgba(239,68,68,0.18)] hover:border-[var(--color-danger)]/50 focus:ring-[var(--color-danger)]/30 backdrop-blur-sm",
    destructive: "bg-[var(--color-danger)] text-white border border-[var(--color-danger)] hover:bg-[rgba(239,68,68,0.9)] hover:shadow-[0px_0px_16px_rgba(239,68,68,0.4)] focus:ring-[var(--color-danger)]/30",
  };

  const sizes = {
    sm: density === "compact" ? "px-[10px] py-[6px] text-xs" : "px-4 py-2 text-sm",
    md: density === "compact" ? "px-[10px] py-[6px] text-xs" : "px-6 py-3 text-sm",
    lg: density === "compact" ? "px-4 py-2 text-sm" : "px-8 py-4 text-base",
  };

  const radiusClass = shape === "pill" ? "rounded-[var(--radius-pill)]" : "rounded-[var(--radius-md)]";

  const buttonContent = (
    <>
      {isLoading ? (
        <div className="flex items-center gap-2">
          <svg
            className="animate-spin h-4 w-4"
            style={{ color: variant === "primary" ? "white" : "rgb(148, 163, 184)" }}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="opacity-70">Cargando...</span>
        </div>
      ) : (
        <>
          {icon && <span className="flex-shrink-0">{icon}</span>}
          {children}
        </>
      )}
    </>
  );

  return (
    <motion.button
      whileHover={!disabled && !isLoading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !isLoading ? { scale: 0.98 } : {}}
      transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        radiusClass,
        className
      )}
      style={fontStyle}
      onClick={onClick}
      disabled={disabled || isLoading}
    >
      {buttonContent}
    </motion.button>
  );
}

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
  onClick?: (e: React.MouseEvent) => void;
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
  const baseStyles =
    "inline-flex items-center justify-center gap-2 font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bf-bg)] disabled:opacity-50 disabled:cursor-not-allowed";
  
  // Usar variables CSS para tipografía
  const fontStyle = {
    fontFamily: "var(--font-heading)",
  };

  const variants = {
    primary:
      "bg-[var(--bf-primary)] text-[var(--bf-ink)] border border-transparent hover:bg-[var(--bf-cyan-300)] focus:ring-[rgba(79,161,216,0.3)]",
    secondary:
      "bg-[var(--bf-surface)] text-[var(--bf-ink-50)] border border-[var(--bf-border-2)] hover:border-[var(--bf-cyan-600)] hover:text-[var(--bf-primary)] focus:ring-[rgba(79,161,216,0.25)]",
    outline:
      "bg-transparent text-[var(--bf-ink-100)] border border-[var(--bf-border-2)] hover:bg-[rgba(255,255,255,0.01)] hover:border-[var(--bf-cyan-600)] focus:ring-[rgba(79,161,216,0.25)]",
    ghost:
      "bg-transparent text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)] hover:bg-[var(--bf-bg-elev)] focus:ring-[rgba(79,161,216,0.2)]",
    danger:
      "bg-transparent text-[var(--bf-danger)] border border-[rgba(224,96,114,0.4)] hover:border-[rgba(224,96,114,0.55)] hover:bg-[rgba(224,96,114,0.08)] focus:ring-[rgba(224,96,114,0.25)]",
    destructive:
      "bg-[var(--bf-danger)] text-[var(--bf-ink)] border border-transparent hover:bg-[rgba(224,96,114,0.9)] focus:ring-[rgba(224,96,114,0.25)]",
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

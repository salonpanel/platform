"use client";

import { forwardRef, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration" | "onDragStart" | "onDrag" | "onDragEnd"> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: ReactNode;
  variant?: "default" | "glass" | "error" | "success";
  density?: "default" | "compact";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, icon, variant = "default", density = "default", ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label 
            className="mb-2 block text-sm font-semibold text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {label}
            {props.required && <span className="text-[var(--color-danger)] ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              {icon}
            </div>
          )}
          <motion.input
            ref={ref}
            whileFocus={{ 
              scale: 1.01,
            }}
            transition={{ duration: 0.15, ease: "easeInOut" as const }}
            className={cn(
              "w-full rounded-[var(--radius-md)] border font-semibold",
              density === "compact" 
                ? "h-9 py-1.5 text-xs backdrop-blur-sm" 
                : "py-2.5 text-sm",
              icon 
                ? (density === "compact" ? "pl-8 pr-3" : "pl-10 pr-4")
                : (density === "compact" ? "px-3" : "px-4"),
              "focus:outline-none focus:ring-2 focus:ring-offset-2",
              "transition-all",
              // Variantes
              variant === "glass" && (density === "compact" ? "glass backdrop-blur-sm" : "glass backdrop-blur-md"),
              variant === "default" && "bg-[var(--bg-card)] border-[var(--glass-border)] backdrop-blur-sm",
              variant === "error" || error
                ? "border-[var(--color-danger)]/40 bg-[var(--color-danger-glass)] text-[var(--color-danger)] focus:ring-[var(--color-danger)]/30 focus:border-[var(--color-danger)]/60"
                : variant === "success"
                ? "border-[var(--color-success)]/40 bg-[var(--color-success-glass)] text-[var(--color-success)] focus:ring-[var(--color-success)]/30 focus:border-[var(--color-success)]/60"
                : variant === "default"
                ? density === "compact"
                  ? "border-[var(--glass-border)] bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-aqua-border)] focus:ring-[var(--accent-aqua)]/20"
                  : "border-[var(--glass-border)] bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-aqua-border)] focus:ring-[var(--accent-aqua)]/30 focus:shadow-[var(--shadow-input-focus)]"
                : density === "compact"
                ? "border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-aqua-border)] focus:ring-[var(--accent-aqua)]/20 focus:bg-[var(--glass-bg-strong)]"
                : "border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-aqua-border)] focus:ring-[var(--accent-aqua)]/30 focus:bg-[var(--glass-bg-strong)] focus:shadow-[var(--shadow-input-focus)]",
              className
            )}
            style={{ 
              fontFamily: "var(--font-body)",
              transitionDuration: "var(--duration-base)",
            }}
            {...props}
          />
        </div>
        {error && (
          <motion.p 
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" as const }}
            className="mt-2 text-xs text-[var(--color-danger)] font-semibold"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {error}
          </motion.p>
        )}
        {helperText && !error && (
          <p 
            className="mt-2 text-xs text-[var(--text-secondary)] font-medium"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

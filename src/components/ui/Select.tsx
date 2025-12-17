"use client";

import { forwardRef, SelectHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { motion } from "framer-motion";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  children: ReactNode;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, children, placeholder, ...props }, ref) => {
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
          <select
            ref={ref}
            className={cn(
              "w-full rounded-[var(--radius-md)] border px-4 py-3 text-sm font-semibold appearance-none",
              "focus:outline-none focus:ring-2 focus:ring-offset-2",
              "transition-all cursor-pointer glass backdrop-blur-md",
              "pr-10",
              error
                ? "border-[var(--color-danger)]/40 bg-[var(--color-danger-glass)] text-[var(--color-danger)] focus:ring-[var(--color-danger)]/30 focus:border-[var(--color-danger)]/60"
                : "border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-primary)] focus:border-[var(--accent-aqua-border)] focus:ring-[var(--accent-aqua)]/30 focus:bg-[var(--glass-bg-strong)] focus:shadow-[var(--shadow-input-focus)]",
              className
            )}
            style={{
              fontFamily: "var(--font-body)",
              transitionDuration: "var(--duration-base)",
            }}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {children}
          </select>
          <motion.div 
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            animate={{ rotate: props.value ? 180 : 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" />
          </motion.div>
        </div>
        {error && (
          <p 
            className="mt-1 text-xs text-[var(--color-danger)]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p 
            className="mt-1 text-xs text-[var(--text-secondary)]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";


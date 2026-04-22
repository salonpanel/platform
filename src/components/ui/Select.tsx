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
              "w-full rounded-[var(--r-md)] border px-4 py-3 text-sm font-medium appearance-none",
              "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bf-bg)]",
              "transition-all cursor-pointer",
              "pr-10",
              error
                ? "border-[rgba(224,96,114,0.4)] bg-[rgba(224,96,114,0.08)] text-[var(--bf-danger)] focus:ring-[rgba(224,96,114,0.25)] focus:border-[rgba(224,96,114,0.6)]"
                : "border-[var(--bf-border-2)] bg-[var(--bf-bg-elev)] text-[var(--bf-ink-50)] focus:border-[var(--bf-primary)] focus:ring-[rgba(79,161,216,0.15)] focus:shadow-[var(--shadow-input-focus)]",
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
            <ChevronDown className="h-4 w-4 text-[var(--bf-ink-400)]" />
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


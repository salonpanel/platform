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
          <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)] font-satoshi">
            {label}
            {props.required && <span className="text-red-400 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              "w-full rounded-xl border px-4 py-3 text-sm font-semibold appearance-none font-satoshi",
              "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]",
              "transition-all duration-200 cursor-pointer backdrop-blur-md",
              "pr-10",
              error
                ? "glass border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.1)] text-red-200 focus:ring-[rgba(239,68,68,0.4)] focus:border-[rgba(239,68,68,0.6)]"
                : "glass border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] text-[var(--text-primary)] focus:border-[#3A6DFF] focus:ring-[#3A6DFF]/30 focus:bg-[rgba(255,255,255,0.08)]",
              className
            )}
            style={{
              borderRadius: "var(--radius-md)",
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
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" />
          </motion.div>
        </div>
        {error && (
          <p className="mt-1 text-xs text-red-400">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{helperText}</p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";


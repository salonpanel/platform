"use client";

import { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, ...props }, ref) => {
    return (
      <motion.div 
        className="w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {label && (
          <label className="mb-2 block text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
            {label}
            {props.required && <span className="text-[#EF4444] ml-1">*</span>}
          </label>
        )}
        <motion.input
          ref={ref}
          whileFocus={{ 
            scale: 1.01,
            boxShadow: "0px 0px 0px 3px rgba(58, 109, 255, 0.1)",
          }}
          className={cn(
            "w-full rounded-[10px] border px-4 py-2.5 text-sm font-semibold font-['Plus_Jakarta_Sans']",
            "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#15171A]",
            "transition-all duration-150",
            "backdrop-blur-md",
            error
              ? "border-[#EF4444]/40 bg-[rgba(239,68,68,0.08)] text-[#EF4444] focus:ring-[#EF4444]/30 focus:border-[#EF4444]/60"
              : "border-white/5 bg-white/5 text-white placeholder:text-[#9ca3af] focus:border-[#3A6DFF] focus:ring-[#3A6DFF]/30 focus:bg-white/8",
            className
          )}
          {...props}
        />
        {error && (
          <motion.p 
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="mt-2 text-xs text-[#EF4444] font-semibold font-['Plus_Jakarta_Sans']"
          >
            {error}
          </motion.p>
        )}
        {helperText && !error && (
          <p className="mt-2 text-xs text-[#9ca3af] font-medium font-['Plus_Jakarta_Sans']">
            {helperText}
          </p>
        )}
      </motion.div>
    );
  }
);

Input.displayName = "Input";

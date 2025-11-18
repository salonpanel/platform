"use client";

import { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  description?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, description, checked, ...props }, ref) => {
    return (
      <div className="flex items-start gap-3">
        <div className="relative inline-flex items-center">
          <input
            ref={ref}
            type="checkbox"
            className="sr-only peer"
            checked={checked}
            {...props}
          />
          <div
            className={cn(
              "w-11 h-6 rounded-full transition-all duration-300 relative",
              "bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.15)]",
              "peer-checked:bg-gradient-to-r peer-checked:from-[#3A6DFF] peer-checked:to-[#4FE3C1] peer-checked:border-transparent",
              "peer-checked:shadow-[0px_4px_16px_rgba(58,109,255,0.4)]",
              "peer-focus:ring-2 peer-focus:ring-[#3A6DFF]/30 peer-focus:ring-offset-2 peer-focus:ring-offset-[var(--bg-primary)]",
              "peer-disabled:opacity-50 peer-disabled:cursor-not-allowed",
              "cursor-pointer backdrop-blur-sm",
              className
            )}
          >
            <motion.div
              className={cn(
                "absolute top-0.5 left-0.5 w-5 h-5 rounded-full",
                "bg-white shadow-lg"
              )}
              animate={{
                x: checked ? 20 : 2,
              }}
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 30,
              }}
            />
          </div>
        </div>
        {(label || description) && (
          <div className="flex-1">
            {label && (
              <label
                htmlFor={props.id}
                className="block text-sm font-medium text-[var(--color-text-primary)] font-satoshi cursor-pointer"
              >
                {label}
              </label>
            )}
            {description && (
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{description}</p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Switch.displayName = "Switch";


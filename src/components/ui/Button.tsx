"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
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
  onClick,
  disabled = false,
  isLoading = false,
  className,
  icon,
}: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center gap-2 font-['Plus_Jakarta_Sans'] font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#15171A] disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-gradient-to-r from-[#3A6DFF] to-[#4FE3C1] text-white shadow-[0px_4px_20px_rgba(58,109,255,0.4)] hover:shadow-[0px_8px_32px_rgba(79,227,193,0.5)] focus:ring-[#3A6DFF]/30 backdrop-blur-sm",
    secondary: "bg-white/5 text-white border border-white/10 hover:border-white/20 hover:bg-white/8 focus:ring-[#4FE3C1]/30 backdrop-blur-md",
    ghost: "text-[#d1d4dc] hover:text-white hover:bg-white/5 focus:ring-[#3A6DFF]/30 transition-all",
    danger: "bg-[rgba(239,68,68,0.12)] text-[#EF4444] border border-[#EF4444]/30 hover:bg-[rgba(239,68,68,0.18)] hover:border-[#EF4444]/50 focus:ring-[#EF4444]/30 backdrop-blur-sm",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm rounded-[10px]",
    md: "px-6 py-3 text-sm rounded-[10px]",
    lg: "px-8 py-4 text-base rounded-[14px]",
  };

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
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        className
      )}
      onClick={onClick}
      disabled={disabled || isLoading}
    >
      {buttonContent}
    </motion.button>
  );
}

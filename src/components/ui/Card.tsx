"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg" | "none";
  onClick?: () => void;
  variant?: "default" | "aurora" | "glass";
  hover?: boolean;
}

export function Card({ 
  children, 
  className, 
  padding = "md",
  onClick,
  variant = "default",
  hover = true,
}: CardProps) {
  const paddingStyles = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  const variantStyles = {
    default: "bg-white/3 border-white/5",
    aurora: "bg-gradient-to-r from-[#3A6DFF] to-[#4FE3C1] border-transparent",
    glass: "bg-white/3 border-white/5 backdrop-blur-md",
  };

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      whileHover={hover && onClick ? { 
        scale: 1.01,
        boxShadow: "0px 8px 32px rgba(58, 109, 255, 0.15)",
      } : {}}
      className={cn(
        "rounded-[14px] border transition-all duration-150",
        variantStyles[variant],
        paddingStyles[padding],
        onClick && "cursor-pointer",
        !onClick && hover && "hover:shadow-[0px_4px_16px_rgba(0,0,0,0.25)] hover:border-white/10",
        className
      )}
      style={{
        boxShadow: variant === "aurora" 
          ? "0px 6px 32px rgba(58,109,255,0.3), inset 0px 1px 0px rgba(255,255,255,0.15)" 
          : "0px 2px 8px rgba(0,0,0,0.25), inset 0px 1px 0px rgba(255,255,255,0.08)",
      }}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );

  return content;
}

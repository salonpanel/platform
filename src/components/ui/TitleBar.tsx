"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export interface TitleBarProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
  density?: "default" | "compact" | "ultra-compact";
}

/**
 * Componente de título principal con jerarquía visual clara
 * Usa Plus Jakarta / Satoshi para headings según densidad
 */
export function TitleBar({ title, subtitle, children, className, density = "default" }: TitleBarProps) {
  const titleSize = density === "ultra-compact" ? "text-xl" : density === "compact" ? "text-2xl" : "text-3xl";
  const subtitleSize = density === "ultra-compact" ? "text-xs" : density === "compact" ? "text-sm" : "text-base";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
      className={cn("flex items-center justify-between gap-4", className)}
    >
      <div className="flex-1 min-w-0">
        <h1
          className={cn(
            "font-bold tracking-tight font-satoshi",
            titleSize
          )}
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--text-primary)",
            background: "linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={cn(
              "mt-1 font-medium",
              subtitleSize
            )}
            style={{
              fontFamily: "var(--font-body)",
              color: "var(--text-secondary)",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {children && <div className="flex-shrink-0">{children}</div>}
    </motion.div>
  );
}


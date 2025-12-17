"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useHeightAware } from "./HeightAwareContainer";

interface PanelSectionProps {
  title?: string;
  children: ReactNode;
  variant?: "default" | "glass" | "aurora";
  density?: "default" | "compact" | "ultra-compact" | "auto";
  className?: string;
  padding?: "none" | "sm" | "md" | "lg" | "compact" | "ultra-compact";
  scrollable?: boolean;
}

export function PanelSection({
  title,
  children,
  variant = "default",
  density = "auto",
  className,
  padding = "md",
  scrollable = false,
}: PanelSectionProps) {
  const heightAware = useHeightAware();
  
  // Auto-detectar densidad si es "auto"
  const effectiveDensity = density === "auto" ? heightAware.density : density;

  const variantStyles = {
    default: "bg-[var(--bg-card)] border-[var(--glass-border)] backdrop-blur-sm",
    glass: "glass border-[var(--glass-border)]",
    aurora: "bg-[var(--gradient-primary)] border-transparent",
  };

  // Padding según densidad
  const paddingStyles = {
    none: "",
    "ultra-compact": effectiveDensity === "ultra-compact" ? "p-2" : "p-3",
    compact: effectiveDensity === "compact" || effectiveDensity === "ultra-compact" ? "p-3" : "p-4",
    sm: effectiveDensity === "ultra-compact" ? "p-2" : effectiveDensity === "compact" ? "p-3" : "p-4",
    md: effectiveDensity === "ultra-compact" ? "p-3" : effectiveDensity === "compact" ? "p-4" : "p-6",
    lg: effectiveDensity === "ultra-compact" ? "p-4" : effectiveDensity === "compact" ? "p-5" : "p-8",
  };

  // Gaps según densidad (mapear "default" a "normal")
  const gapStyles = {
    normal: "gap-4",
    default: "gap-4",
    compact: "gap-3",
    "ultra-compact": "gap-2",
  } as const;
  
  // Mapear effectiveDensity a valores válidos
  const mappedDensity = effectiveDensity === "default" ? "normal" : effectiveDensity === "normal" ? "normal" : effectiveDensity;

  return (
    <div
      className={cn(
        "flex flex-col rounded-[var(--radius-xl)] border transition-all",
        variantStyles[variant],
        paddingStyles[padding],
        scrollable ? "overflow-auto" : "overflow-hidden",
        className
      )}
      style={{
        boxShadow: variant === "aurora" 
          ? "var(--glow-aqua), inset 0px 1px 0px rgba(255,255,255,0.15)" 
          : "var(--shadow-card)",
        transitionDuration: "var(--duration-base)",
      }}
    >
      {title && (
        <h3
          className={cn(
            "mb-3 font-semibold",
            effectiveDensity === "ultra-compact" ? "text-sm mb-2" : effectiveDensity === "compact" ? "text-base mb-2" : "text-lg mb-3"
          )}
          style={{
            fontFamily: "var(--font-heading)",
            color: variant === "aurora" ? "rgba(255,255,255,0.9)" : "var(--text-primary)",
          }}
        >
          {title}
        </h3>
      )}
      <div className={cn("flex flex-col", gapStyles[mappedDensity as keyof typeof gapStyles])}>
        {children}
      </div>
    </div>
  );
}


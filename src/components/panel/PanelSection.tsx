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
    default: "bg-[var(--bf-surface)] border-[var(--bf-border)]",
    glass:   "bg-[var(--bf-bg-elev)]/80 backdrop-blur-sm border-[var(--bf-border-2)]",
    aurora:  "bg-[var(--bf-primary)] border-transparent",
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
        "flex flex-col rounded-[var(--r-xl)] border transition-all",
        variantStyles[variant],
        paddingStyles[padding],
        scrollable ? "overflow-auto" : "overflow-hidden",
        className
      )}
      style={{
        boxShadow: variant === "aurora"
          ? "var(--bf-shadow-glow), inset 0 1px 0 rgba(255,255,255,0.12)"
          : "var(--bf-shadow-card)",
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
            fontFamily: "var(--font-sans)",
            color: variant === "aurora" ? "var(--bf-ink)" : "var(--bf-ink-50)",
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


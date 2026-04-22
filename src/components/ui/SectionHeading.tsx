"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionHeadingProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  density?: "default" | "compact" | "ultra-compact";
}

/**
 * Componente de encabezado de sección con jerarquía visual clara
 */
export function SectionHeading({ title, description, children, className, density = "default" }: SectionHeadingProps) {
  const titleSize = density === "ultra-compact" ? "text-sm" : density === "compact" ? "text-base" : "text-lg";
  const descriptionSize = density === "ultra-compact" ? "text-[10px]" : density === "compact" ? "text-xs" : "text-sm";

  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex-1 min-w-0">
        <h2
          className={cn(
            "font-semibold",
            titleSize
          )}
          style={{
            fontFamily: "var(--font-sans)",
            color: "var(--bf-ink-50)",
          }}
        >
          {title}
        </h2>
        {description && (
          <p
            className={cn(
              "mt-1",
              descriptionSize
            )}
            style={{
              fontFamily: "var(--font-sans)",
              color: "var(--bf-ink-300)",
            }}
          >
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex-shrink-0">{children}</div>}
    </div>
  );
}


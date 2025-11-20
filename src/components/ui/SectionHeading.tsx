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
            "font-semibold font-satoshi",
            titleSize
          )}
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--text-primary)",
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
              fontFamily: "var(--font-body)",
              color: "var(--text-secondary)",
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


import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  padding?: "none" | "sm" | "md" | "lg";
  density?: "dense" | "default" | "relaxed";
  className?: string;
  /** Alineado con SidebarNav: menos padding horizontal cuando la barra lateral está colapsada (desktop). */
  sidebarCollapsed?: boolean;
}

/**
 * Contenedor de página del panel: márgenes horizontales fluidos + **safe-area** (notch / bordes curvos)
 * mediante `max(env(safe-area-inset-*), clamp(...))`. El scroll vertical y `pb-nav-safe` siguen en `layout-client` (`main`).
 */
export function PageContainer({
  children,
  maxWidth = "full",
  padding = "md",
  density = "default",
  className,
  sidebarCollapsed = false,
}: PageContainerProps) {
  const maxWidthClasses = {
    sm: "max-w-2xl",
    md: "max-w-4xl",
    lg: "max-w-6xl",
    xl: "max-w-7xl",
    "2xl": "max-w-[1600px]",
    full: "max-w-full",
  };

  const paddingVerticalClasses = {
    none: "",
    sm:
      density === "dense"
        ? "py-2"
        : density === "relaxed"
          ? "py-4"
          : "py-3",
    md:
      density === "dense"
        ? "py-3"
        : density === "relaxed"
          ? "py-6 md:py-8"
          : "py-4 md:py-6",
    lg:
      density === "dense"
        ? "py-4"
        : density === "relaxed"
          ? "py-8 md:py-12"
          : "py-6 md:py-8",
  };

  const horizontalSafe = sidebarCollapsed
    ? "pl-[max(env(safe-area-inset-left,0px),clamp(1rem,3vw,2rem))] pr-[max(env(safe-area-inset-right,0px),clamp(1rem,3vw,2rem))]"
    : "pl-[max(env(safe-area-inset-left,0px),clamp(1.5rem,4vw,3rem))] pr-[max(env(safe-area-inset-right,0px),clamp(1rem,3vw,2rem))]";

  return (
    <div
      className={cn(
        "min-h-full w-full mx-auto transition-[padding] duration-300 flex flex-col min-h-0",
        maxWidthClasses[maxWidth],
        padding !== "none" && paddingVerticalClasses[padding],
        padding !== "none" && horizontalSafe,
        className
      )}
    >
      {children}
    </div>
  );
}

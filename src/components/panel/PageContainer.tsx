"use client";

import { ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  padding?: "none" | "sm" | "md" | "lg";
  density?: "dense" | "default" | "relaxed";
  className?: string;
  sidebarCollapsed?: boolean;
}

export function PageContainer({
  children,
  maxWidth = "full",
  padding = "md",
  density = "default",
  className,
  sidebarCollapsed = false,
}: PageContainerProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const maxWidthClasses = {
    sm: "max-w-2xl",
    md: "max-w-4xl",
    lg: "max-w-6xl",
    xl: "max-w-7xl",
    "2xl": "max-w-[1600px]",
    full: "max-w-full",
  };

  // ZERO SCROLL: Padding reducido según densidad
  const paddingClasses = {
    none: "",
    sm: density === "dense" ? "px-3 py-2" : density === "relaxed" ? "px-4 py-4" : "px-4 py-3",
    md: density === "dense" ? "px-4 py-3" : density === "relaxed" ? "px-8 py-6 md:px-12 md:py-8" : "px-6 py-4 md:px-8 md:py-6",
    lg: density === "dense" ? "px-6 py-4" : density === "relaxed" ? "px-12 py-8 md:px-16 md:py-12" : "px-8 py-6 md:px-12 md:py-8",
  };

  return (
    <div
      className={cn(
        "h-full w-full mx-auto transition-all duration-300 flex flex-col min-h-0",
        maxWidthClasses[maxWidth],
        paddingClasses[padding],
        className
      )}
      style={{
        paddingLeft: isMounted
          ? (sidebarCollapsed ? "clamp(1rem, 3vw, 2rem)" : "clamp(1.5rem, 4vw, 3rem)")
          : "clamp(1.5rem, 4vw, 3rem)",
        paddingRight: "clamp(1rem, 3vw, 2rem)",
      }}
    >
      {children}
    </div>
  );
}

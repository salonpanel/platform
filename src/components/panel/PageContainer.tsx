"use client";

import { ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
  sidebarCollapsed?: boolean;
}

export function PageContainer({
  children,
  maxWidth = "full",
  padding = "md",
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

  const paddingClasses = {
    none: "",
    sm: "px-4 py-4",
    md: "px-6 py-6 md:px-8 md:py-8",
    lg: "px-8 py-8 md:px-12 md:py-12",
  };

  return (
    <div
      className={cn(
        "w-full mx-auto transition-all duration-300",
        maxWidthClasses[maxWidth],
        paddingClasses[padding],
        className
      )}
      style={{
        paddingLeft: isMounted
          ? (sidebarCollapsed ? "clamp(1.5rem, 4vw, 3rem)" : "clamp(1.5rem, 6vw, 4rem)")
          : "clamp(1.5rem, 6vw, 4rem)",
        paddingRight: "clamp(1.5rem, 4vw, 3rem)",
      }}
    >
      {children}
    </div>
  );
}

"use client";

import { ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ScrollAreaProps {
  children: ReactNode;
  className?: string;
  orientation?: "vertical" | "horizontal" | "both";
}

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ children, className, orientation = "vertical" }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "scrollbar-hide",
          orientation === "vertical" && "overflow-y-auto",
          orientation === "horizontal" && "overflow-x-auto",
          orientation === "both" && "overflow-auto",
          className
        )}
      >
        {children}
      </div>
    );
  }
);

ScrollArea.displayName = "ScrollArea";









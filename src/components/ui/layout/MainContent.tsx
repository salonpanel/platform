"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MainContentProps {
  children: ReactNode;
  className?: string;
}

export function MainContent({ children, className }: MainContentProps) {
  return (
    <main
      className={cn(
        "flex-1 overflow-y-auto bg-gray-50",
        className
      )}
    >
      <div className="max-w-7xl mx-auto p-6">{children}</div>
    </main>
  );
}









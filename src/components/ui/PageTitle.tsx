"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageTitleProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageTitle({ title, subtitle, actions, className }: PageTitleProps) {
  return (
    <div className={cn("flex items-start justify-between mb-6", className)}>
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {subtitle && (
          <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2">{actions}</div>
      )}
    </div>
  );
}









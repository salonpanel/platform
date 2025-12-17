"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface IconProps {
  icon: LucideIcon;
  size?: number | string;
  className?: string;
  color?: string;
}

export function Icon({ icon: IconComponent, size = 20, className, color }: IconProps) {
  return (
    <IconComponent
      className={cn("flex-shrink-0", className)}
      size={size}
      style={color ? { color } : undefined}
    />
  );
}









"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type GlassVariant = "default" | "elevated" | "inset" | "modal" | "popover";

interface GlassCardProps {
  children: React.ReactNode;
  variant?: GlassVariant;
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  shadow?: "none" | "sm" | "md" | "lg" | "glow";
  borderRadius?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
}

/* Brand-kit aligned surface system */
const variantStyle: Record<GlassVariant, React.CSSProperties> = {
  default:  { background: "var(--bf-surface)",   border: "1px solid var(--bf-border)",   boxShadow: "var(--bf-shadow-card)" },
  elevated: { background: "var(--bf-surface)",   border: "1px solid var(--bf-border)",   boxShadow: "var(--bf-shadow-card)" },
  inset:    { background: "var(--bf-bg-elev)",   border: "1px solid var(--bf-border)" },
  modal:    { background: "var(--bf-surface)",   border: "1px solid var(--bf-border)",   boxShadow: "var(--bf-shadow-card)" },
  popover:  { background: "var(--bf-surface-2)", border: "1px solid var(--bf-border-2)", boxShadow: "var(--bf-shadow-card)" },
};

const paddingVariants = {
  none: "",
  sm:   "p-3",
  md:   "p-4",
  lg:   "p-6",
  xl:   "p-8",
};

const borderRadiusVariants = {
  sm:   "rounded-[var(--r-sm)]",
  md:   "rounded-[var(--r-md)]",
  lg:   "rounded-[var(--r-lg)]",
  xl:   "rounded-[var(--r-xl)]",
  full: "rounded-full",
};

export function GlassCard({
  children,
  variant = "default",
  padding = "md",
  shadow = "sm",
  borderRadius = "lg",
  className,
  interactive = false,
  onClick,
}: GlassCardProps) {
  const baseClasses = cn(
    "transition-all duration-200",
    paddingVariants[padding],
    borderRadiusVariants[borderRadius],
    className
  );

  const style = variantStyle[variant];

  if (interactive) {
    return (
      <motion.div
        className={cn(baseClasses, "cursor-pointer")}
        style={style}
        whileHover={{ scale: 1.01, y: -1 }}
        whileTap={{ scale: 0.99 }}
        onClick={onClick}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={baseClasses} style={style} onClick={onClick}>
      {children}
    </div>
  );
}

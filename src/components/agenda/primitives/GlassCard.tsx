"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { theme } from "@/theme/ui";

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

const glassVariants = {
  default: {
    background: theme.glassmorphism.background,
    backdropFilter: `blur(${theme.glassmorphism.backdropBlur})`,
    border: theme.glassmorphism.border,
  },
  elevated: {
    background: theme.glassmorphism.background,
    backdropFilter: `blur(${theme.glassmorphism.backdropBlur})`,
    border: theme.glassmorphism.border,
  },
  inset: {
    background: theme.colors.bgSecondary,
    border: `1px solid ${theme.colors.borderDefault}`,
  },
  modal: {
    background: theme.colors.bgPrimary,
    backdropFilter: `blur(${theme.glassmorphism.backdropBlur})`,
    border: theme.glassmorphism.border,
  },
  popover: {
    background: theme.glassmorphism.background,
    backdropFilter: `blur(${theme.glassmorphism.backdropBlur})`,
    border: theme.glassmorphism.border,
  },
};

const shadowVariants = {
  none: "",
  sm: theme.shadows.sm,
  md: theme.shadows.md,
  lg: theme.shadows.lg,
  glow: theme.shadows.neon,
};

const paddingVariants = {
  none: "",
  sm: "p-3", // 12px
  md: "p-4", // 16px
  lg: "p-6", // 24px
  xl: "p-8", // 32px
};

const borderRadiusVariants = {
  sm: "rounded-lg", // 8px
  md: "rounded-xl", // 12px
  lg: "rounded-2xl", // 16px
  xl: "rounded-3xl", // 20px
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
    "backdrop-blur-md transition-all duration-200",
    paddingVariants[padding],
    borderRadiusVariants[borderRadius],
    className
  );

  const style = {
    background: glassVariants[variant].background,
    border: glassVariants[variant].border,
    boxShadow: shadow !== "none" ? shadowVariants[shadow] : undefined,
    ...(glassVariants[variant] as any).backdropFilter && {
      backdropFilter: (glassVariants[variant] as any).backdropFilter
    },
  };

  if (interactive) {
    return (
      <motion.div
        className={cn(baseClasses, "cursor-pointer")}
        style={style}
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.98 }}
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

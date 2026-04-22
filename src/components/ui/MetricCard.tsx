'use client';

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
    direction: 'up' | 'down' | 'neutral';
  };
  icon?: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  variant = 'default',
  size = 'md',
  className,
  onClick
}: MetricCardProps) {
  const variants = {
    default: {
      bg: "bg-[var(--bf-surface)]",
      border: "border-[var(--bf-border)]",
      text: "text-[var(--bf-ink-200)]",
      titleColor: "text-[var(--bf-ink-400)]",
      valueColor: "text-[var(--bf-ink-50)]"
    },
    success: {
      bg: "bg-[rgba(30,161,159,0.10)]",
      border: "border-[rgba(30,161,159,0.30)]",
      text: "text-[var(--bf-teal-200)]",
      titleColor: "text-[var(--bf-success)]",
      valueColor: "text-[var(--bf-teal-100)]"
    },
    warning: {
      bg: "bg-[rgba(232,176,74,0.10)]",
      border: "border-[rgba(232,176,74,0.30)]",
      text: "text-[#F2C87A]",
      titleColor: "text-[var(--bf-warn)]",
      valueColor: "text-[#F2C87A]"
    },
    danger: {
      bg: "bg-[rgba(224,96,114,0.10)]",
      border: "border-[rgba(224,96,114,0.30)]",
      text: "text-[#F2A0AC]",
      titleColor: "text-[var(--bf-danger)]",
      valueColor: "text-[#F2A0AC]"
    },
    info: {
      bg: "bg-[rgba(79,161,216,0.10)]",
      border: "border-[rgba(79,161,216,0.30)]",
      text: "text-[var(--bf-cyan-200)]",
      titleColor: "text-[var(--bf-primary)]",
      valueColor: "text-[var(--bf-cyan-100)]"
    }
  };

  const sizes = {
    sm: {
      padding: "p-3",
      titleSize: "text-xs",
      valueSize: "text-lg",
      subtitleSize: "text-xs"
    },
    md: {
      padding: "p-4",
      titleSize: "text-sm",
      valueSize: "text-xl",
      subtitleSize: "text-xs"
    },
    lg: {
      padding: "p-6",
      titleSize: "text-base",
      valueSize: "text-2xl",
      subtitleSize: "text-sm"
    }
  };

  const style = variants[variant];
  const sizeStyle = sizes[size];

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up':
        return <ArrowUpRight className="h-3 w-3" />;
      case 'down':
        return <ArrowDownRight className="h-3 w-3" />;
      default:
        return <Minus className="h-3 w-3" />;
    }
  };

  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'up':   return 'text-[var(--bf-success)]';
      case 'down': return 'text-[var(--bf-danger)]';
      default:     return 'text-[var(--bf-ink-400)]';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      whileHover={{ scale: 1.02 }}
      className={cn(
        "relative overflow-hidden rounded-[var(--r-lg)] border",
        "transition-all duration-300 hover:shadow-lg",
        style.bg,
        style.border,
        sizeStyle.padding,
        onClick && "cursor-pointer hover:border-opacity-60",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {icon && (
              <div className={cn("flex-shrink-0", style.text)}>
                {icon}
              </div>
            )}
            <h3 className={cn(
              "font-medium truncate",
              sizeStyle.titleSize,
              style.titleColor
            )}>
              {title}
            </h3>
          </div>

          <p className={cn(
            "font-bold tracking-tight mb-1",
            sizeStyle.valueSize,
            style.valueColor
          )}>
            {value}
          </p>

          {subtitle && (
            <p className={cn(
              "opacity-75",
              sizeStyle.subtitleSize,
              style.text
            )}>
              {subtitle}
            </p>
          )}
        </div>

        {trend && (
          <div className="flex-shrink-0 ml-4">
            <div className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border",
              getTrendColor(trend.direction),
              trend.direction === 'up'      && "bg-[rgba(30,161,159,0.10)] border-[rgba(30,161,159,0.30)]",
              trend.direction === 'down'    && "bg-[rgba(224,96,114,0.10)] border-[rgba(224,96,114,0.30)]",
              trend.direction === 'neutral' && "bg-[var(--bf-bg-elev)] border-[var(--bf-border)]"
            )}>
              {getTrendIcon(trend.direction)}
              <span>{trend.value}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Hover effect overlay */}
      <div className="absolute inset-0 bg-[rgba(79,161,216,0.03)] opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-[var(--r-lg)]" />
    </motion.div>
  );
}

interface MetricsGridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export function MetricsGrid({
  children,
  columns = 2,
  className
}: MetricsGridProps) {
  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
  };

  return (
    <div className={cn(
      "grid gap-4",
      gridCols[columns],
      className
    )}>
      {children}
    </div>
  );
}

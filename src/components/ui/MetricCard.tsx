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
      bg: "bg-slate-800/50",
      border: "border-slate-700/50",
      text: "text-slate-200",
      titleColor: "text-slate-400",
      valueColor: "text-white"
    },
    success: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      text: "text-emerald-300",
      titleColor: "text-emerald-400",
      valueColor: "text-emerald-200"
    },
    warning: {
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      text: "text-amber-300",
      titleColor: "text-amber-400",
      valueColor: "text-amber-200"
    },
    danger: {
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      text: "text-red-300",
      titleColor: "text-red-400",
      valueColor: "text-red-200"
    },
    info: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      text: "text-blue-300",
      titleColor: "text-blue-400",
      valueColor: "text-blue-200"
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
      case 'up':
        return 'text-emerald-400';
      case 'down':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      whileHover={{ scale: 1.02 }}
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-lg)] border backdrop-blur-sm",
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
              trend.direction === 'up' && "bg-emerald-500/10 border-emerald-500/30",
              trend.direction === 'down' && "bg-red-500/10 border-red-500/30",
              trend.direction === 'neutral' && "bg-slate-500/10 border-slate-500/30"
            )}>
              {getTrendIcon(trend.direction)}
              <span>{trend.value}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Hover effect overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-[var(--radius-lg)]" />
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

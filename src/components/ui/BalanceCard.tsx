'use client';

import { ReactNode, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Clock, CheckCircle2, TrendingUp, TrendingDown, Info } from "lucide-react";
import { Button } from "@/components/ui";

interface BalanceCardProps {
  title: string;
  amount: number;
  currency: string;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
    label: string;
  };
  icon?: ReactNode;
  variant?: "pending" | "available" | "total";
  className?: string;
  onClick?: () => void;
  tooltip?: ReactNode;
}

export function BalanceCard({
  title,
  amount,
  currency,
  subtitle,
  trend,
  icon,
  variant = "available",
  className,
  onClick,
  tooltip
}: BalanceCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const formatCurrency = (amount: number, currency: string = "eur") => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const variants = {
    pending: {
      bg: "bg-amber-500/5",
      border: "border-amber-500/20",
      glow: "glow-amber",
      iconColor: "text-amber-400",
      titleColor: "text-amber-200",
      amountColor: "text-amber-100",
      subtitleColor: "text-amber-300/70"
    },
    available: {
      bg: "bg-emerald-500/5",
      border: "border-emerald-500/20",
      glow: "glow-emerald",
      iconColor: "text-emerald-400",
      titleColor: "text-emerald-200",
      amountColor: "text-emerald-100",
      subtitleColor: "text-emerald-300/70"
    },
    total: {
      bg: "bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10",
      border: "border-purple-500/20",
      glow: "glow-purple",
      iconColor: "text-purple-400",
      titleColor: "text-purple-200",
      amountColor: "text-white",
      subtitleColor: "text-purple-300/70"
    }
  };

  const style = variants[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      whileHover={{ scale: 1.02 }}
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-xl)] p-6 border backdrop-blur-sm cursor-pointer",
        "transition-all duration-300 hover:shadow-[var(--glow-blue)]",
        style.bg,
        style.border,
        className
      )}
      onClick={onClick}
    >
      {/* Glow effect */}
      <div className={cn("absolute inset-0 opacity-0 transition-opacity duration-300", style.glow)} />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className={cn(
                "rounded-[var(--radius-lg)] p-2.5 border",
                variant === "total" ? "bg-purple-500/20 border-purple-500/30" : "bg-white/5 border-white/10"
              )}>
                <div className={style.iconColor}>
                  {icon}
                </div>
              </div>
            )}
            <div>
              <h3 className={cn("text-sm font-semibold", style.titleColor)}>
                {title}
              </h3>
              {subtitle && (
                <p className={cn("text-xs mt-0.5", style.subtitleColor)}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Tooltip trigger */}
          {tooltip && (
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <Info className="h-4 w-4 text-white/60" />
            </button>
          )}
        </div>

        {/* Amount */}
        <div className="mb-3">
          <p className={cn(
            "text-3xl font-bold tracking-tight",
            style.amountColor
          )}>
            {formatCurrency(amount, currency)}
          </p>
        </div>

        {/* Trend */}
        {trend && (
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
              trend.isPositive
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-red-500/20 text-red-300 border border-red-500/30"
            )}>
              {trend.isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{trend.isPositive ? "+" : ""}{trend.value}%</span>
            </div>
            <span className="text-xs text-white/60">
              {trend.label}
            </span>
          </div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && showTooltip && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50"
        >
          <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl max-w-xs">
            {tooltip}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

interface BalanceGridProps {
  children: ReactNode;
  className?: string;
}

export function BalanceGrid({ children, className }: BalanceGridProps) {
  return (
    <div className={cn(
      "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",
      className
    )}>
      {children}
    </div>
  );
}

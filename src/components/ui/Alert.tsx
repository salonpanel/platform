"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertProps {
  type?: "success" | "error" | "warning" | "info";
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export function Alert({
  type = "info",
  title,
  children,
  onClose,
  className,
}: AlertProps) {
  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertCircle,
    info: Info,
  };

  const styles = {
    success: {
      bg: "bg-[rgba(30,161,159,0.10)]",
      border: "border-[rgba(30,161,159,0.30)]",
      text: "text-[var(--bf-teal-200)]",
      titleText: "text-[var(--bf-teal-100)]",
      icon: "text-[var(--bf-success)]",
    },
    error: {
      bg: "bg-[rgba(224,96,114,0.10)]",
      border: "border-[rgba(224,96,114,0.30)]",
      text: "text-[#F2A0AC]",
      titleText: "text-[var(--bf-ink-100)]",
      icon: "text-[var(--bf-danger)]",
    },
    warning: {
      bg: "bg-[rgba(232,176,74,0.10)]",
      border: "border-[rgba(232,176,74,0.30)]",
      text: "text-[#F2C87A]",
      titleText: "text-[var(--bf-ink-100)]",
      icon: "text-[var(--bf-warn)]",
    },
    info: {
      bg: "bg-[rgba(79,161,216,0.10)]",
      border: "border-[rgba(79,161,216,0.30)]",
      text: "text-[var(--bf-cyan-200)]",
      titleText: "text-[var(--bf-cyan-100)]",
      icon: "text-[var(--bf-primary)]",
    },
  };

  const Icon = icons[type];
  const style = styles[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "relative rounded-[var(--r-lg)] px-4 py-3 border",
        style.bg,
        style.border,
        className
      )}
      style={{ borderRadius: "var(--r-lg)" }}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", style.icon)} />
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className={cn("text-sm font-semibold mb-1", style.titleText)} style={{ fontFamily: "var(--font-sans)" }}>
              {title}
            </h4>
          )}
          <div className={cn("text-sm font-medium", style.text)}>
            {children}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={cn(
              "flex-shrink-0 p-1 rounded-[var(--r-sm)] hover:bg-[rgba(255,255,255,0.08)] transition-colors duration-200",
              style.text,
              "hover:text-white"
            )}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}







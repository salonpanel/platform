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
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      text: "text-emerald-300",
      titleText: "text-emerald-200",
      icon: "text-emerald-400",
    },
    error: {
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      text: "text-red-300",
      titleText: "text-red-200",
      icon: "text-red-400",
    },
    warning: {
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      text: "text-amber-300",
      titleText: "text-amber-200",
      icon: "text-amber-400",
    },
    info: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      text: "text-blue-300",
      titleText: "text-blue-200",
      icon: "text-blue-400",
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
        "relative rounded-[var(--radius-lg)] px-4 py-3 border backdrop-blur-sm",
        style.bg,
        style.border,
        className
      )}
      style={{
        borderRadius: "var(--radius-lg)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", style.icon)} />
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className={cn("text-sm font-semibold mb-1 font-satoshi", style.titleText)}>
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
              "flex-shrink-0 p-1 rounded-[var(--radius-sm)] hover:bg-[rgba(255,255,255,0.1)] transition-colors duration-200",
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







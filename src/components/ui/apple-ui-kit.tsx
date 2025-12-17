"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* =========================================================================
   BUTTON
   -------------------------------------------------------------------------
   - Variantes: primary, secondary, ghost, danger
   - Tamaños:  sm, md, lg
   - Estilo: Apple / glass / pill, con micro animación
   ========================================================================= */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
}

export const UiButton: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  loading,
  className,
  children,
  disabled,
  ...props
}) => {
  const isDisabled = disabled || loading;

  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] focus-visible:ring-offset-0 disabled:opacity-40 disabled:cursor-not-allowed";

  const variantClasses: Record<ButtonVariant, string> = {
    primary:
      "bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-aqua)] text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.6)] hover:brightness-110 active:scale-[0.97]",
    secondary:
      "bg-[var(--glass-bg)] text-[var(--text-primary)] border border-[var(--glass-border)] shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:bg-[rgba(255,255,255,0.12)] active:scale-[0.97]",
    ghost:
      "bg-transparent text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.06)] active:bg-[rgba(255,255,255,0.1)]",
    danger:
      "bg-[rgba(239,68,68,0.1)] text-red-400 border border-red-500/30 hover:bg-[rgba(239,68,68,0.16)] active:scale-[0.97]",
  };

  const sizeClasses: Record<ButtonSize, string> = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-2.5 text-sm",
  };

  return (
    <motion.button
      whileHover={!isDisabled ? { y: -1 } : undefined}
      whileTap={!isDisabled ? { scale: 0.97 } : undefined}
      className={cn(base, variantClasses[variant], sizeClasses[size], className)}
      disabled={isDisabled}
      {...(props as any)} // Type assertion to avoid motion props conflicts
    >
      {leftIcon && !loading && (
        <span className="inline-flex items-center justify-center">
          {leftIcon}
        </span>
      )}
      <span className="inline-flex items-center">
        {loading && (
          <span className="mr-2 h-3 w-3 animate-spin rounded-full border-[2px] border-white/40 border-t-white" />
        )}
        {children}
      </span>
      {rightIcon && !loading && (
        <span className="inline-flex items-center justify-center">
          {rightIcon}
        </span>
      )}
    </motion.button>
  );
};

/* =========================================================================
   CARD
   -------------------------------------------------------------------------
   - Superficie glass / elevada
   - Uso: contenedores de secciones, bloques de información, etc.
   ========================================================================= */

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

export const UiCard: React.FC<CardProps> = ({
  elevated = true,
  padding = "md",
  className,
  children,
  ...props
}) => {
  const paddingMap = {
    none: "",
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  };

  return (
    <div
      className={cn(
        "rounded-2xl bg-[var(--bg-card)]/95 border border-[var(--glass-border)] backdrop-blur-xl",
        elevated && "shadow-[0_18px_45px_rgba(0,0,0,0.6)]",
        paddingMap[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

/* =========================================================================
   BADGE / STATUS
   -------------------------------------------------------------------------
   - Para estados de cita, etiquetas de pago, etc.
   ========================================================================= */

type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "highlight";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  soft?: boolean;
}

export const UiBadge: React.FC<BadgeProps> = ({
  tone = "neutral",
  soft = true,
  className,
  children,
  ...props
}) => {
  const base =
    "inline-flex items-center gap-1 rounded-full text-[11px] font-medium px-2.5 py-1 whitespace-nowrap";

  const toneMap: Record<BadgeTone, string> = {
    neutral: soft
      ? "bg-white/6 text-[var(--text-secondary)]"
      : "bg-white/16 text-[var(--text-primary)]",
    success: soft
      ? "bg-emerald-500/10 text-emerald-300"
      : "bg-emerald-500 text-emerald-50",
    warning: soft
      ? "bg-amber-500/12 text-amber-300"
      : "bg-amber-500 text-amber-50",
    danger: soft
      ? "bg-red-500/13 text-red-300"
      : "bg-red-500 text-red-50",
    info: soft
      ? "bg-sky-500/12 text-sky-300"
      : "bg-sky-500 text-sky-50",
    highlight: soft
      ? "bg-[var(--accent-aqua)]/14 text-[var(--accent-aqua)]"
      : "bg-[var(--accent-aqua)] text-slate-950",
  };

  return (
    <span className={cn(base, toneMap[tone], className)} {...props}>
      {children}
    </span>
  );
};

/* =========================================================================
   INPUT + FORM FIELD
   -------------------------------------------------------------------------
   - Inputs estilo iOS: pill, glass, sin bordes agresivos
   ========================================================================= */

interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: string;
}

export const UiInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ leftIcon, rightIcon, error, className, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        <div
          className={cn(
            "flex h-10 items-center gap-2 rounded-full bg-white/4 px-3 text-sm text-[var(--text-primary)] shadow-[0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-md transition-all focus-within:bg-white/6 focus-within:shadow-[0_0_0_1px_rgba(148,163,255,0.8)]",
            error && "shadow-[0_0_0_1px_rgba(248,113,113,0.9)]",
            className
          )}
        >
          {leftIcon && (
            <span className="flex items-center text-[var(--text-secondary)]">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60 outline-none border-none"
            {...props}
          />
          {rightIcon && (
            <span className="flex items-center text-[var(--text-secondary)]">
              {rightIcon}
            </span>
          )}
        </div>
        {error && (
          <p className="text-[11px] text-red-400 leading-tight">
            {error}
          </p>
        )}
      </div>
    );
  }
);
UiInput.displayName = "UiInput";

interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  labelRight?: React.ReactNode;
  required?: boolean;
  hint?: string;
  error?: string;
}

export const UiField: React.FC<FieldProps> = ({
  label,
  labelRight,
  required,
  hint,
  error,
  className,
  children,
  ...props
}) => {
  return (
    <div className={cn("w-full space-y-1.5", className)} {...props}>
      {(label || labelRight) && (
        <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
          <div className="flex items-center gap-1">
            {label && <span>{label}</span>}
            {required && (
              <span className="text-red-400">*</span>
            )}
          </div>
          {labelRight && <div>{labelRight}</div>}
        </div>
      )}
      {children}
      {!error && hint && (
        <p className="text-[11px] text-[var(--text-secondary)]/70 leading-tight">
          {hint}
        </p>
      )}
      {error && (
        <p className="text-[11px] text-red-400 leading-tight">
          {error}
        </p>
      )}
    </div>
  );
};

/* =========================================================================
   TABS PILL (Day / Week / Month / List)
   -------------------------------------------------------------------------
   - Tabs estilo iOS segmented control
   ========================================================================= */

type TabValue = string;

interface TabsProps {
  value: TabValue;
  onChange: (value: TabValue) => void;
  tabs: { value: TabValue; label: string; badge?: React.ReactNode }[];
  className?: string;
}

export const UiPillTabs: React.FC<TabsProps> = ({
  value,
  onChange,
  tabs,
  className,
}) => {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full bg-white/4 p-1 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.5)]",
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.value === value;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={cn(
              "relative flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
              isActive
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-secondary)]"
            )}
          >
            {isActive && (
              <motion.span
                layoutId="pillTabsHighlight"
                className="absolute inset-0 rounded-full bg-[rgba(255,255,255,0.18)] shadow-[0_8px_20px_rgba(0,0,0,0.45)]"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
            {tab.badge && (
              <span className="relative z-10">{tab.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

/* =========================================================================
   MODAL BASE
   -------------------------------------------------------------------------
   - Fondo blur, card central, animación Apple-like
   ========================================================================= */

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  footer?: React.ReactNode;
  hideCloseIcon?: boolean;
}

export const UiModal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  size = "lg",
  children,
  footer,
  hideCloseIcon,
}) => {
  const sizeClass =
    size === "sm"
      ? "max-w-md"
      : size === "md"
      ? "max-w-2xl"
      : "max-w-4xl";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-[18px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={cn(
              "relative w-full rounded-3xl bg-[rgba(15,16,20,0.96)] border border-white/6 shadow-[0_32px_120px_rgba(0,0,0,0.9)]",
              "flex flex-col",
              sizeClass
            )}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {(title || subtitle || !hideCloseIcon) && (
              <div className="flex items-start justify-between px-6 pt-5 pb-3">
                <div className="space-y-1">
                  {title && (
                    <h2 className="text-base font-semibold text-white">
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <p className="text-xs text-[var(--text-secondary)]">
                      {subtitle}
                    </p>
                  )}
                </div>
                {!hideCloseIcon && (
                  <button
                    onClick={onClose}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-[var(--text-secondary)] hover:bg-white/10"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            )}

            <div className="px-6 pb-5 pt-1 overflow-y-auto max-h-[70vh]">
              {children}
            </div>

            {footer && (
              <div className="flex items-center justify-end gap-3 border-t border-white/4 px-6 py-4 bg-gradient-to-t from-white/5 to-transparent">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* =========================================================================
   FLOATING ACTION BUTTON (FAB)
   -------------------------------------------------------------------------
   - Botón flotante inferior derecho para "Nueva cita"
   ========================================================================= */

interface FabProps {
  onClick?: () => void;
  icon?: React.ReactNode;
  label?: string;
}

/* =========================================================================
   TOAST / NOTIFICATION
   -------------------------------------------------------------------------
   - Apple-style toast notifications with slide animation
   ========================================================================= */

type ToastTone = "success" | "warning" | "danger" | "info";

interface ToastProps {
  message: string;
  tone?: ToastTone;
  icon?: React.ReactNode;
  onClose?: () => void;
  duration?: number;
}

export const UiToast: React.FC<ToastProps> = ({
  message,
  tone = "info",
  icon,
  onClose,
  duration = 4000,
}) => {
  const [isVisible, setIsVisible] = React.useState(true);

  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose || (() => {}), 300);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const toneStyles: Record<ToastTone, string> = {
    success: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
    warning: "bg-amber-500/10 border-amber-500/20 text-amber-300",
    danger: "bg-red-500/10 border-red-500/20 text-red-300",
    info: "bg-blue-500/10 border-blue-500/20 text-blue-300",
  };

  const defaultIcons: Record<ToastTone, React.ReactNode> = {
    success: "✓",
    warning: "⚠",
    danger: "✕",
    info: "ℹ",
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn(
            "fixed top-4 right-4 z-50 max-w-sm rounded-2xl border backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.6)] p-4",
            toneStyles[tone]
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {icon || (
                <span className="text-lg font-semibold">
                  {defaultIcons[tone]}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-5">{message}</p>
            </div>
            {onClose && (
              <button
                onClick={() => {
                  setIsVisible(false);
                  setTimeout(onClose, 300);
                }}
                className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Cerrar notificación"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* =========================================================================
   FLOATING ACTION BUTTON (FAB)
   -------------------------------------------------------------------------
   - Botón flotante inferior derecho para "Nueva cita"
   ========================================================================= */

interface FabProps {
  onClick?: () => void;
  icon?: React.ReactNode;
  label?: string;
}

export const UiFab: React.FC<FabProps> = ({
  onClick,
  icon,
  label = "Nuevo",
}) => {
  return (
    <motion.button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-[70] flex items-center gap-2 rounded-full bg-[rgba(21,23,26,0.96)] px-4 py-2.5 text-sm font-medium text-white shadow-[0_18px_45px_rgba(0,0,0,0.8)] border border-white/10 backdrop-blur-xl"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, boxShadow: "0 22px 55px rgba(0,0,0,0.9)" }}
      whileTap={{ scale: 0.96 }}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-aqua)] shadow-[0_0_25px_rgba(56,189,248,0.5)]">
        {icon ?? (
          <span className="text-lg leading-none font-semibold">+</span>
        )}
      </span>
      <span>{label}</span>
    </motion.button>
  );
};

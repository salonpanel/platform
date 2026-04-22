"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, XCircle, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
}

const toastIcons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const toastStyles = {
  success: "bg-[rgba(30,161,159,0.12)] border-[rgba(30,161,159,0.35)] text-[var(--bf-teal-200)]",
  error:   "bg-[rgba(224,96,114,0.12)] border-[rgba(224,96,114,0.35)] text-[#F2A0AC]",
  warning: "bg-[rgba(232,176,74,0.10)] border-[rgba(232,176,74,0.30)] text-[#F2C87A]",
  info:    "bg-[rgba(79,161,216,0.12)] border-[rgba(79,161,216,0.35)] text-[var(--bf-cyan-200)]",
};

export function Toast({ message, type = "info", duration = 3000, onClose }: ToastProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (duration > 0 && mounted) {
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(() => onClose?.(), 300); // Esperar a que termine la animación
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose, mounted]);

  if (!mounted) return null;

  const Icon = toastIcons[type];

  const toastContent = (
    <div
      className={cn(
        "fixed top-4 right-4 z-[100] flex items-center gap-3 rounded-[var(--r-lg)] border px-4 py-3",
        "bg-[var(--bf-surface)] shadow-[var(--bf-shadow-card)]",
        "transition-all duration-300 ease-out",
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2",
        toastStyles[type],
        "min-w-[300px] max-w-md"
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <p className="flex-1 text-sm font-medium" style={{ fontFamily: "var(--font-sans)" }}>{message}</p>
      {onClose && (
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(() => onClose(), 300);
          }}
          className="text-current opacity-70 hover:opacity-100 transition-smooth rounded-full p-1 hover:bg-[rgba(255,255,255,0.1)]"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return createPortal(toastContent, document.body);
}

// Hook para usar toasts fácilmente
export function useToast() {
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  const showToast = (message: string, type: ToastType = "info") => {
    setToast({ message, type });
  };

  const ToastComponent = toast ? (
    <Toast
      message={toast.message}
      type={toast.type}
      onClose={() => setToast(null)}
    />
  ) : null;

  return { showToast, ToastComponent };
}


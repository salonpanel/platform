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
  success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 backdrop-blur-sm",
  error: "bg-red-500/10 border-red-500/30 text-red-400 backdrop-blur-sm",
  warning: "bg-amber-500/10 border-amber-500/30 text-amber-400 backdrop-blur-sm",
  info: "bg-blue-500/10 border-blue-500/30 text-blue-400 backdrop-blur-sm",
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
        "fixed top-4 right-4 z-[100] flex items-center gap-3 rounded-[var(--radius-lg)] border px-4 py-3 shadow-glass",
        "transition-all duration-300 ease-out glass",
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2",
        toastStyles[type],
        "min-w-[300px] max-w-md"
      )}
      style={{ borderRadius: "var(--radius-lg)" }}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <p className="flex-1 text-sm font-medium font-satoshi">{message}</p>
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


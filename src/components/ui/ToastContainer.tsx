"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback silencioso para evitar errores durante SSR o renderizado inicial
    console.warn("useToast must be used within ToastProvider. Using fallback.");
    return {
      showToast: () => {},
      removeToast: () => {},
    };
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(7);
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000,
    };

    setToasts((prev) => [...prev, newToast]);

    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, newToast.duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const styles = {
    success: {
      bg: "bg-[var(--color-success-glass)]",
      border: "border-[var(--color-success)]/30",
      text: "text-[var(--color-success)]",
      icon: "text-[var(--color-success)]",
    },
    error: {
      bg: "bg-[var(--color-danger-glass)]",
      border: "border-[var(--color-danger)]/30",
      text: "text-[var(--color-danger)]",
      icon: "text-[var(--color-danger)]",
    },
    warning: {
      bg: "bg-[var(--color-warning-glass)]",
      border: "border-[var(--color-warning)]/30",
      text: "text-[var(--color-warning)]",
      icon: "text-[var(--color-warning)]",
    },
    info: {
      bg: "bg-[var(--color-info-glass)]",
      border: "border-[var(--color-info)]/30",
      text: "text-[var(--color-info)]",
      icon: "text-[var(--color-info)]",
    },
  };

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-md">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type];
          const style = styles[toast.type];

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              className={cn(
                "rounded-[var(--radius-lg)] border px-4 py-3 shadow-[var(--shadow-modal)] backdrop-blur-md",
                style.bg,
                style.border
              )}
            >
              <div className="flex items-start gap-3">
                <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", style.icon)} />
                <div className="flex-1 min-w-0">
                  <h4
                    className={cn("text-sm font-semibold mb-1", style.text)}
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {toast.title}
                  </h4>
                  {toast.message && (
                    <p
                      className={cn("text-sm", style.text)}
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {toast.message}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onRemove(toast.id)}
                  className={cn(
                    "flex-shrink-0 p-1 rounded-[var(--radius-sm)] hover:bg-[rgba(255,255,255,0.1)] transition-colors",
                    style.text
                  )}
                  style={{ transitionDuration: "var(--duration-base)" }}
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/**
 * ============================================================================
 * TOASTCONTAINER COMPONENT
 * ============================================================================
 * 
 * USO RECOMENDADO:
 * - Notificaciones de éxito/error
 * - Feedback de acciones del usuario
 * - Mensajes temporales
 * 
 * SETUP REQUERIDO:
 * 1. Envolver la app con ToastProvider:
 * ```tsx
 * <ToastProvider>
 *   <App />
 * </ToastProvider>
 * ```
 * 
 * 2. Usar el hook useToast en componentes:
 * ```tsx
 * const { showToast } = useToast();
 * 
 * const handleSave = async () => {
 *   try {
 *     await saveData();
 *     showToast({
 *       type: "success",
 *       title: "Guardado",
 *       message: "Los datos se han guardado correctamente",
 *     });
 *   } catch (error) {
 *     showToast({
 *       type: "error",
 *       title: "Error",
 *       message: "No se pudo guardar",
 *     });
 *   }
 * };
 * ```
 * 
 * PROPS DEL TOAST:
 * - type: "success" | "error" | "warning" | "info"
 * - title: string - Título del toast
 * - message?: string - Mensaje opcional
 * - duration?: number - Duración en ms (default: 5000, 0 = no auto-close)
 * 
 * EJEMPLO DE USO:
 * ```tsx
 * showToast({
 *   type: "success",
 *   title: "Cliente creado",
 *   message: "El cliente se ha creado correctamente",
 *   duration: 3000,
 * });
 * ```
 */


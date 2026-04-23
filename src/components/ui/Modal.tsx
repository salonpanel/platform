"use client";

import { ReactNode, useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { BF_EASE_OUT, BF_MODAL_SPRING } from "@/lib/motion";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  preventClose?: boolean;
  preventCloseMessage?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  ariaLabelledBy,
  ariaDescribedBy,
  preventClose = false,
  preventCloseMessage = "¿Estás seguro de que quieres cerrar sin guardar los cambios?",
}: ModalProps) {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Helper para manejar cierre con preventClose
  const handleClose = () => {
    if (preventClose) {
      if (window.confirm(preventCloseMessage)) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  // Focus trap y gestión de focus
  useEffect(() => {
    if (!mounted || !isOpen) return;

    // Guardar el elemento activo antes de abrir el modal
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Enfocar el modal al abrir
    const modalElement = modalRef.current;
    if (modalElement) {
      // Buscar el primer elemento focusable dentro del modal
      const focusableElements = modalElement.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstFocusable = focusableElements[0];
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        modalElement.focus();
      }
    }

    // Focus trap: mantener el focus dentro del modal
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !modalElement) return;

      const focusableElements = Array.from(
        modalElement.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => {
        // Filtrar elementos ocultos o deshabilitados
        return !el.hasAttribute("disabled") && 
               !el.hasAttribute("aria-hidden") &&
               el.offsetParent !== null;
      });

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTabKey);

    return () => {
      document.removeEventListener("keydown", handleTabKey);
      // Restaurar focus al elemento anterior cuando se cierra el modal
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, mounted]);

  useEffect(() => {
    if (!mounted) return;
    
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, mounted]);

  useEffect(() => {
    if (!mounted) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleClose, mounted]);

  if (!mounted) return null;

  const sizes = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  const backdropTransition = reduceMotion
    ? { duration: 0.08 }
    : { duration: 0.18, ease: BF_EASE_OUT };

  const panelTransition = reduceMotion
    ? { duration: 0.12, ease: "easeOut" as const }
    : BF_MODAL_SPRING;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div
          key="modal-root"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleClose();
            }
          }}
        >
          {/* Backdrop con blur premium */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal content - Premium */}
          <motion.div
            ref={modalRef}
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.96, y: 10 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.97, y: 6 }
            }
            transition={panelTransition}
            className={cn(
              "relative z-[60] w-full rounded-[var(--r-xl)] bg-[var(--bf-surface)] border border-[var(--bf-border)]",
              "shadow-[var(--bf-shadow-card)]",
              sizes[size]
            )}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={ariaLabelledBy || titleId.current}
            aria-describedby={ariaDescribedBy}
            tabIndex={-1}
          >
            {/* Header - Premium */}
            <div className="flex items-center justify-between border-b border-[var(--bf-border)] px-6 py-5">
              <h2 
                id={ariaLabelledBy || titleId.current}
                className="text-xl font-semibold text-[var(--bf-ink-50)] tracking-tight"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {title}
              </h2>
              <motion.button
                whileHover={{ scale: 1.05, rotate: 90 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleClose}
                className="p-2 rounded-[var(--r-md)] text-[var(--bf-ink-300)] hover:text-[var(--bf-ink-50)] hover:bg-[var(--bf-bg-elev)] transition-all"
                style={{ transitionDuration: "var(--duration-base)" }}
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </motion.button>
            </div>

            {/* Content - Premium */}
            <div 
              className="px-6 py-5 text-[var(--bf-ink-50)] max-h-[70vh] overflow-y-auto scrollbar-hide"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {children}
            </div>

            {/* Footer - Premium */}
            {footer && (
              <div className="flex items-center justify-end gap-3 border-t border-[var(--bf-border)] px-6 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}

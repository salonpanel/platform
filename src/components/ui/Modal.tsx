"use client";

import { ReactNode, useEffect, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { SheetModalFrame } from "@/components/ui/sheet-modal-frame";

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
  const [mounted, setMounted] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = useCallback(() => {
    if (preventClose) {
      if (window.confirm(preventCloseMessage)) {
        onClose();
      }
    } else {
      onClose();
    }
  }, [preventClose, preventCloseMessage, onClose]);

  useEffect(() => {
    if (!mounted || !isOpen) return;

    previousActiveElement.current = document.activeElement as HTMLElement;

    const modalElement = modalRef.current;
    if (modalElement) {
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

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !modalElement) return;

      const focusableElements = Array.from(
        modalElement.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => {
        return (
          !el.hasAttribute("disabled") &&
          !el.hasAttribute("aria-hidden") &&
          el.offsetParent !== null
        );
      });

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTabKey);

    return () => {
      document.removeEventListener("keydown", handleTabKey);
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
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
  }, [isOpen, mounted, handleClose]);

  if (!mounted) return null;

  return (
    <SheetModalFrame
      isOpen={isOpen}
      onClose={handleClose}
      onBackdropClick={handleClose}
      size={size}
      sheetRef={modalRef}
      titleId={ariaLabelledBy || titleId.current}
      ariaDescribedBy={ariaDescribedBy}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--bf-border)] px-6 py-4 md:py-5">
          <h2
            id={ariaLabelledBy || titleId.current}
            className="pr-3 text-lg font-semibold tracking-tight text-[var(--bf-ink-50)] md:text-xl"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {title}
          </h2>
          <motion.button
            whileHover={{ scale: 1.05, rotate: 90 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={handleClose}
            className="rounded-[var(--r-md)] p-2 text-[var(--bf-ink-300)] transition-all hover:bg-[var(--bf-bg-elev)] hover:text-[var(--bf-ink-50)]"
            style={{ transitionDuration: "var(--duration-base)" }}
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </motion.button>
        </div>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-6 py-5 text-[var(--bf-ink-50)] scrollbar-hide",
            "pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
          )}
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {children}
        </div>

        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[var(--bf-border)] px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
            {footer}
          </div>
        )}
      </div>
    </SheetModalFrame>
  );
}

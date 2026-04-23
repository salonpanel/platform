"use client";

import {
  ReactNode,
  useEffect,
  useState,
  useRef,
  useCallback,
  Ref,
} from "react";
import { createPortal } from "react-dom";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useDragControls,
  PanInfo,
} from "framer-motion";
import { cn } from "@/lib/utils";
import { BF_EASE_OUT, BF_MODAL_SPRING } from "@/lib/motion";

const CLOSE_DRAG_PX = 88;
const CLOSE_VELOCITY = 420;

const SIZE_MAX: Record<"sm" | "md" | "lg" | "xl", string> = {
  sm: "md:max-w-md",
  md: "md:max-w-lg",
  lg: "md:max-w-2xl",
  xl: "md:max-w-4xl",
};

export interface SheetModalFrameProps {
  isOpen: boolean;
  onClose: () => void;
  /** Clic / toque en el velo (por defecto onClose). Usar p. ej. handleClose con confirmación. */
  onBackdropClick?: () => void;
  size?: "sm" | "md" | "lg" | "xl";
  zClass?: string;
  className?: string;
  sheetClassName?: string;
  backdropClassName?: string;
  /** Arrastrar la pestaña hacia abajo para cerrar (respeta onClose del padre). */
  allowDragDismiss?: boolean;
  showDragHandle?: boolean;
  titleId?: string;
  ariaDescribedBy?: string;
  sheetRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}

/**
 * Marco común: hoja inferior (estilo panel de notificaciones de agenda),
 * animación de entrada/salida, velo y cierre arrastrando la pestaña superior.
 */
export function SheetModalFrame({
  isOpen,
  onClose,
  onBackdropClick,
  size = "md",
  zClass = "z-[60]",
  className,
  sheetClassName,
  backdropClassName,
  allowDragDismiss = true,
  showDragHandle = true,
  titleId,
  ariaDescribedBy,
  sheetRef,
  children,
}: SheetModalFrameProps) {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const dragControls = useDragControls();
  const innerRef = useRef<HTMLDivElement | null>(null);

  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      innerRef.current = el;
      if (typeof sheetRef === "function") {
        sheetRef(el);
      } else if (sheetRef && "current" in sheetRef) {
        (sheetRef as React.MutableRefObject<HTMLDivElement | null>).current =
          el;
      }
    },
    [sheetRef]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, mounted]);

  const backdropHandler = onBackdropClick ?? onClose;

  const onDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (!allowDragDismiss || reduceMotion) return;
      if (info.offset.y > CLOSE_DRAG_PX || info.velocity.y > CLOSE_VELOCITY) {
        onClose();
      }
    },
    [allowDragDismiss, reduceMotion, onClose]
  );

  const dragEnabled = allowDragDismiss && !reduceMotion;

  const backdropTransition = reduceMotion
    ? { duration: 0.08 }
    : { duration: 0.2, ease: BF_EASE_OUT };

  const sheetTransition = reduceMotion
    ? { duration: 0.2, ease: "easeOut" as const }
    : { ...BF_MODAL_SPRING, damping: 34, stiffness: 360 };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className={cn("fixed inset-0 pointer-events-none", zClass, className)}
          aria-hidden={!isOpen}
        >
          <motion.button
            type="button"
            aria-label="Cerrar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
            className={cn(
              "pointer-events-auto absolute inset-0 bg-[var(--bf-ink)]/70 backdrop-blur-sm",
              backdropClassName
            )}
            onClick={() => backdropHandler()}
          />

          <div className="absolute inset-0 flex items-end justify-center p-0 pointer-events-none">
            <motion.div
              ref={setRefs}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={ariaDescribedBy}
              tabIndex={-1}
              initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
              animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
              transition={sheetTransition}
              drag={dragEnabled ? "y" : false}
              dragControls={dragEnabled ? dragControls : undefined}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={dragEnabled ? { top: 0, bottom: 0.2 } : undefined}
              dragMomentum={false}
              onDragEnd={onDragEnd}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "pointer-events-auto flex w-full min-h-0 flex-col",
                "bg-[var(--bf-surface)] shadow-[var(--bf-shadow-card)]",
                "rounded-t-[var(--r-xl)] border-t border-[var(--bf-border)]",
                "max-h-[min(88dvh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1rem))]",
                SIZE_MAX[size],
                "outline-none",
                sheetClassName
              )}
            >
              {showDragHandle && dragEnabled && (
                <div className="flex shrink-0 justify-center pt-2 pb-1">
                  <button
                    type="button"
                    className={cn(
                      "flex cursor-grab touch-none items-center justify-center rounded-full py-2 outline-none",
                      "active:cursor-grabbing",
                      "focus-visible:ring-2 focus-visible:ring-[var(--bf-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bf-surface)]"
                    )}
                    aria-label="Arrastra hacia abajo para cerrar"
                    onPointerDown={(e) => dragControls.start(e)}
                  >
                    <span className="block h-1 w-10 shrink-0 rounded-full bg-[var(--bf-border-2)]" />
                  </button>
                </div>
              )}
              {showDragHandle && !dragEnabled && (
                <div
                  className="flex shrink-0 justify-center pt-2 pb-1"
                  aria-hidden
                >
                  <span className="block h-1 w-10 shrink-0 rounded-full bg-[var(--bf-border-2)] opacity-50" />
                </div>
              )}
              {children}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

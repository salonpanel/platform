"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SheetModalFrame } from "@/components/ui/sheet-modal-frame";
import { GlassButton } from "@/components/ui/glass";

interface SmartModalStep {
  id: string;
  title: string;
  description?: string;
  required?: boolean;
  completed?: boolean;
}

interface SmartModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  steps?: SmartModalStep[];
  currentStep?: number;
  onStepChange?: (step: number) => void;
  showProgress?: boolean;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  variant?: "default" | "guided" | "minimal";
  children: React.ReactNode;
  actions?: React.ReactNode;
  context?: {
    type: "booking" | "customer" | "service" | "staff" | "availability" | "conflict";
    data?: any;
  };
  /** Bloquea cierre por velo, arrastre y Escape (p. ej. formulario sucio). */
  preventClose?: boolean;
}

function mapFrameSize(size: SmartModalProps["size"]): {
  frame: "sm" | "md" | "lg" | "xl";
  sheetClassName?: string;
} {
  switch (size) {
    case "sm":
      return { frame: "sm" };
    case "md":
      return { frame: "lg" };
    case "lg":
      return { frame: "xl" };
    case "xl":
      return { frame: "xl", sheetClassName: "md:max-w-6xl" };
    case "full":
      return {
        frame: "xl",
        sheetClassName: "md:max-w-[min(96rem,calc(100vw-1.5rem))]",
      };
    default:
      return { frame: "md" };
  }
}

/**
 * SmartModal — hoja inferior con pestaña arrastrable (mismo marco que el resto de modales).
 */
export function SmartModal({
  isOpen,
  onClose,
  title,
  steps = [],
  currentStep = 0,
  onStepChange,
  showProgress = false,
  size = "md",
  variant = "default",
  children,
  actions,
  context,
  preventClose = false,
}: SmartModalProps) {
  const [localStep, setLocalStep] = useState(currentStep);
  const titleId = useRef(`smart-modal-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    setLocalStep(currentStep);
  }, [currentStep]);

  useEffect(() => {
    if (!isOpen || preventClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, preventClose]);

  const { frame, sheetClassName } = mapFrameSize(size);

  const progressPercentage = useMemo(() => {
    if (!steps.length) return 0;
    return ((localStep + 1) / steps.length) * 100;
  }, [localStep, steps.length]);

  const handleStepChange = (newStep: number) => {
    setLocalStep(newStep);
    onStepChange?.(newStep);
  };

  const canGoNext = useMemo(() => {
    if (!steps.length) return true;
    const currentStepData = steps[localStep];
    return !currentStepData?.required || currentStepData?.completed;
  }, [steps, localStep]);

  const canGoPrev = localStep > 0;

  const getContextTheme = () => {
    switch (context?.type) {
      case "booking":
        return { accent: "var(--bf-primary)" as const };
      case "customer":
        return { accent: "var(--bf-primary)" as const };
      case "service":
        return { accent: "var(--bf-primary)" as const };
      case "staff":
        return { accent: "var(--accent-pink)" as const };
      case "availability":
        return { accent: "var(--accent-green)" as const };
      case "conflict":
        return { accent: "var(--accent-orange)" as const };
      default:
        return { accent: "var(--bf-primary)" as const };
    }
  };

  const theme = getContextTheme();

  return (
    <SheetModalFrame
      isOpen={isOpen}
      onClose={onClose}
      onBackdropClick={() => {
        if (!preventClose) onClose();
      }}
      allowDragDismiss={!preventClose}
      size={frame}
      sheetClassName={sheetClassName}
      titleId={titleId.current}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--glass-border-subtle)] p-5 md:p-6">
          <div className="min-w-0 flex-1 pr-2">
            <h2
              id={titleId.current}
              className="font-[var(--font-sans)] text-lg font-semibold text-[var(--bf-ink-50)] md:text-xl"
            >
              {title}
            </h2>

            {variant === "guided" && steps.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="text-sm text-[var(--bf-ink-300)]">
                  Paso {localStep + 1} de {steps.length}
                </span>
                <div className="flex gap-1">
                  {steps.map((_, index) => (
                    <motion.span
                      key={index}
                      className={cn(
                        "h-2 w-2 rounded-full",
                        index > localStep && "bg-[var(--bf-border)]"
                      )}
                      style={
                        index <= localStep
                          ? { backgroundColor: theme.accent }
                          : undefined
                      }
                      initial={false}
                      animate={{
                        scale: index === localStep ? 1.2 : 1,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (!preventClose) onClose();
            }}
            disabled={preventClose}
            className={cn(
              "shrink-0 rounded-lg p-2 text-[var(--bf-ink-300)] transition-colors hover:bg-[var(--bf-bg-elev)] hover:text-[var(--bf-ink-50)]",
              preventClose && "cursor-not-allowed opacity-50"
            )}
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {showProgress && steps.length > 0 && (
          <div className="shrink-0 bg-[var(--bf-bg-elev)] px-5 py-2 md:px-6">
            <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--bf-bg-elev)]">
              <motion.div
                className="h-full rounded-full bg-[var(--bf-primary)]"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            <div className="mt-1 flex justify-between text-xs text-[var(--bf-ink-400)]">
              <span>{Math.round(progressPercentage)}% completado</span>
              <span>{steps.length - localStep - 1} pasos restantes</span>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 md:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={localStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {variant === "guided" && steps.length > 0 ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-[var(--bf-border)] bg-[var(--bf-bg-elev)] p-4">
                    <h3 className="mb-1 font-semibold text-[var(--bf-ink-50)]">
                      {steps[localStep]?.title}
                    </h3>
                    {steps[localStep]?.description && (
                      <p className="text-sm text-[var(--bf-ink-300)]">
                        {steps[localStep].description}
                      </p>
                    )}
                    {steps[localStep]?.required && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-[var(--accent-orange)]">
                        <AlertCircle className="h-3 w-3" />
                        Campo requerido
                      </div>
                    )}
                  </div>
                  {children}
                </div>
              ) : (
                children
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[var(--glass-border-subtle)] px-5 pt-5 pb-[max(1rem,env(safe-area-inset-bottom,0px))] md:px-6">
          <div className="flex flex-wrap gap-2">
            {variant === "guided" && steps.length > 0 && (
              <>
                <GlassButton
                  variant="ghost"
                  onClick={() => handleStepChange(localStep - 1)}
                  disabled={!canGoPrev}
                  className="flex items-center gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </GlassButton>

                <GlassButton
                  onClick={() => handleStepChange(localStep + 1)}
                  disabled={!canGoNext}
                  className="flex items-center gap-2"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </GlassButton>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {actions ? (
              actions
            ) : (
              variant !== "guided" && (
                <GlassButton
                  variant="ghost"
                  onClick={() => {
                    if (!preventClose) onClose();
                  }}
                  disabled={preventClose}
                >
                  Cancelar
                </GlassButton>
              )
            )}

            {variant === "guided" && localStep === steps.length - 1 && (
              <GlassButton
                onClick={onClose}
                className="border-0 bg-[var(--bf-primary)] text-[var(--bf-ink)]"
              >
                <Check className="mr-2 h-4 w-4" />
                Completar
              </GlassButton>
            )}
          </div>
        </div>
      </div>
    </SheetModalFrame>
  );
}

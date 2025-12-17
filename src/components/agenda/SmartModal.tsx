"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassModal } from "@/components/ui/glass/GlassModal";
import { GlassButton } from "@/components/ui/glass";
import { Button } from "@/components/ui/Button";
import { Booking, Staff } from "@/types/agenda";

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
}

/**
 * SmartModal - Modales inteligentes y contextuales premium
 * Características:
 * - Modo guiado con steps
 * - Contexto inteligente
 * - Progress indicators
 * - Responsive design
 * - Animaciones premium
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
}: SmartModalProps) {
  const [localStep, setLocalStep] = useState(currentStep);

  useEffect(() => {
    setLocalStep(currentStep);
  }, [currentStep]);

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
    full: "max-w-full mx-4"
  };

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

  // Context-aware styling
  const getContextTheme = () => {
    switch (context?.type) {
      case "booking":
        return {
          accent: "var(--accent-blue)",
          bg: "bg-[var(--accent-blue-glass)]",
          border: "border-[var(--accent-blue-border)]",
        };
      case "customer":
        return {
          accent: "var(--accent-aqua)",
          bg: "bg-[var(--accent-aqua-glass)]",
          border: "border-[var(--accent-aqua-border)]",
        };
      case "service":
        return {
          accent: "var(--accent-purple)",
          bg: "bg-[var(--accent-purple-glass)]",
          border: "border-[var(--accent-purple-border)]",
        };
      case "staff":
        return {
          accent: "var(--accent-pink)",
          bg: "bg-[var(--accent-pink-glass)]",
          border: "border-[var(--accent-pink-border)]",
        };
      case "availability":
        return {
          accent: "var(--accent-green)",
          bg: "bg-[var(--accent-green-glass)]",
          border: "border-[var(--accent-green-border)]",
        };
      case "conflict":
        return {
          accent: "var(--accent-orange)",
          bg: "bg-[var(--accent-orange-glass)]",
          border: "border-[var(--accent-orange-border)]",
        };
      default:
        return {
          accent: "var(--accent-blue)",
          bg: "bg-[var(--glass-bg-default)]",
          border: "border-[var(--glass-border)]",
        };
    }
  };

  const theme = getContextTheme();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={cn(
            "relative w-full rounded-[var(--radius-xl)] shadow-2xl overflow-hidden",
            sizeClasses[size],
            theme.bg,
            theme.border
          )}
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[var(--glass-border-subtle)]">
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-[var(--text-primary)] font-[var(--font-heading)]">
                {title}
              </h2>

              {/* Step indicator for guided mode */}
              {variant === "guided" && steps.length > 0 && (
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-sm text-[var(--text-secondary)]">
                    Paso {localStep + 1} de {steps.length}
                  </span>
                  <div className="flex gap-1">
                    {steps.map((_, index) => (
                      <motion.div
                        key={index}
                        className={cn(
                          "w-2 h-2 rounded-full transition-colors",
                          index <= localStep
                            ? theme.accent.replace("var(--", "").replace(")", "")
                            : "bg-[var(--glass-border)]"
                        )}
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
              onClick={onClose}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-subtle)] transition-colors"
              aria-label="Cerrar modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Progress bar */}
          {showProgress && steps.length > 0 && (
            <div className="px-6 py-2 bg-[var(--glass-bg-subtle)]">
              <div className="w-full bg-[var(--glass-bg)] rounded-full h-1 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-aqua)] rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
              <div className="flex justify-between text-xs text-[var(--text-tertiary)] mt-1">
                <span>{Math.round(progressPercentage)}% completado</span>
                <span>{steps.length - localStep - 1} pasos restantes</span>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
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
                    {/* Step info */}
                    <div className="p-4 rounded-lg bg-[var(--glass-bg-subtle)] border border-[var(--glass-border)]">
                      <h3 className="font-semibold text-[var(--text-primary)] mb-1">
                        {steps[localStep]?.title}
                      </h3>
                      {steps[localStep]?.description && (
                        <p className="text-sm text-[var(--text-secondary)]">
                          {steps[localStep].description}
                        </p>
                      )}
                      {steps[localStep]?.required && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-[var(--accent-orange)]">
                          <AlertCircle className="h-3 w-3" />
                          Campo requerido
                        </div>
                      )}
                    </div>

                    {/* Step content */}
                    {children}
                  </div>
                ) : (
                  children
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer with actions */}
          <div className="flex items-center justify-between p-6 border-t border-[var(--glass-border-subtle)]">
            <div className="flex gap-2">
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

            <div className="flex gap-2">
              {actions ? (
                actions
              ) : (
                variant !== "guided" && (
                  <GlassButton variant="ghost" onClick={onClose}>
                    Cancelar
                  </GlassButton>
                )
              )}

              {variant === "guided" && localStep === steps.length - 1 && (
                <GlassButton
                  onClick={onClose}
                  className="bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-aqua)] text-white border-0"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Completar
                </GlassButton>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
